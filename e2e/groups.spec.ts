import type { Page } from '@playwright/test';
import { test, expect, openEditor, saved, STORAGE_KEY, card } from './fixtures';

const node = (id: string, graphicId: string, src: string, label: string, x: number, y: number) => ({
  id,
  type: 'flow',
  position: { x, y },
  data: { graphicId, src, label, headerText: label, showHeader: true },
});
const DIAGRAM = {
  nodes: [node('art', 'article-article-1', '/graphics/article/article-1.svg', 'Article', 0, 0), node('cart', 'e-commerce-cart', '/graphics/e-commerce/cart.svg', 'Cart', 320, 0)],
  edges: [{ id: 'e1', source: 'art', target: 'cart', markerEnd: { type: 'arrowclosed' } }],
};

async function seed(page: Page) {
  await page.goto('/');
  await page.evaluate(([key, v]) => localStorage.setItem(key, v), [STORAGE_KEY, JSON.stringify(DIAGRAM)]);
  await openEditor(page);
}

async function selectBoth(page: Page) {
  await card(page, 'Article').locator('img').click();
  await card(page, 'Cart').locator('img').click({ modifiers: ['Control'] });
}

test('two selected cards can be grouped, renamed and ungrouped; each is one undo step', async ({ page }) => {
  await seed(page);
  await selectBoth(page);
  await page.getByRole('button', { name: 'Group', exact: true }).click();
  const frame = page.locator('.react-flow__node-group');
  await expect(frame).toHaveCount(1);
  await expect(frame).toContainText('Group');
  let data = (await saved(page))!;
  const group = data.nodes.find((n) => n.type === 'group')!;
  expect(data.nodes.filter((n) => n.parentId === group.id)).toHaveLength(2);

  // The frame wraps both cards.
  const fb = (await frame.boundingBox())!;
  for (const label of ['Article', 'Cart']) {
    const b = (await card(page, label).boundingBox())!;
    expect(b.x).toBeGreaterThan(fb.x);
    expect(b.y + b.height).toBeLessThan(fb.y + fb.height);
  }

  await frame.getByRole('button', { name: 'Group' }).dblclick();
  await page.getByRole('textbox', { name: 'Group label' }).fill('Checkout');
  await page.keyboard.press('Enter');
  await expect(frame).toContainText('Checkout');
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.type === 'group')!.data.label).toBe('Checkout');

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(frame).toHaveCount(0);
  data = (await saved(page))!;
  expect(data.nodes.map((n) => n.position)).toEqual([{ x: 0, y: 0 }, { x: 320, y: 0 }]);

  await page.keyboard.press('Control+y');
  await expect(frame).toHaveCount(1);
  await frame.click({ position: { x: 5, y: 60 } });
  await page.getByRole('button', { name: 'Ungroup' }).click();
  await expect(frame).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  expect((await saved(page))!.nodes.every((n) => n.parentId === undefined)).toBe(true);
});

test('dragging a card out of its group takes it out; dropping it on the frame puts it back', async ({ page }) => {
  await seed(page);
  await selectBoth(page);
  await page.keyboard.press('Control+g');
  await expect(page.locator('.react-flow__node-group')).toHaveCount(1);
  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });

  const img = card(page, 'Cart').locator('img');
  const b = (await img.boundingBox())!;
  const before = (await page.locator('.react-flow__node-group').boundingBox())!;
  const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Just below the frame, so the card's centre stays on screen.
  await page.mouse.move(from.x, before.y + before.height + 40, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === 'cart')!.parentId).toBeUndefined();

  // Back onto the (now smaller) frame.
  const frame = (await page.locator('.react-flow__node-group').boundingBox())!;
  const now = (await img.boundingBox())!;
  await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
  await page.mouse.down();
  await expect(page.locator('.flow-group.drop-target')).toHaveCount(0);
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, { steps: 20 });
  await expect(page.locator('.flow-group.drop-target')).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === 'cart')!.parentId).toBeTruthy();
});

test('copy and paste brings the connection along, as one undo step', async ({ page }) => {
  await seed(page);
  await selectBoth(page);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  const data = (await saved(page))!;
  const copies = data.nodes.filter((n) => !['art', 'cart'].includes(n.id));
  const copiedEdge = data.edges.find((e) => e.id !== 'e1')!;
  expect(new Set([copiedEdge.source, copiedEdge.target])).toEqual(new Set(copies.map((n) => n.id)));
  // The copy is selected, so pasting again stacks a further copy.
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});
