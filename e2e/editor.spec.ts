import { test, expect, openEditor, saved, STORAGE_KEY, card } from './fixtures';
import type { Page } from '@playwright/test';

const SAMPLE = {
  nodes: [
    {
      id: 'article-article-1-1791567208054-ppqgj',
      type: 'flow',
      position: { x: 180, y: 50 },
      data: { graphicId: 'article-article-1', src: '/graphics/article/article-1.svg', label: 'Article', headerText: 'Article', showHeader: true },
      measured: { width: 220, height: 198 },
    },
    {
      id: 'e-commerce-cart-1791567209999-abcde',
      type: 'flow',
      position: { x: 180, y: 400 },
      data: { graphicId: 'e-commerce-cart', src: '/graphics/e-commerce/cart.svg', label: 'Cart', headerText: 'My cart', showHeader: true },
      measured: { width: 220, height: 198 },
    },
  ],
  edges: [
    {
      markerEnd: { type: 'arrowclosed' },
      source: 'article-article-1-1791567208054-ppqgj',
      target: 'e-commerce-cart-1791567209999-abcde',
      id: 'xy-edge__article-article-1-1791567208054-ppqgjb-e-commerce-cart-1791567209999-abcde',
    },
  ],
};

async function seed(page: Page, value: unknown) {
  await page.goto('/');
  await page.evaluate(([key, v]) => localStorage.setItem(key as string, typeof v === 'string' ? v : JSON.stringify(v)), [STORAGE_KEY, value] as const);
}

const raw = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

// Drag with the mouse in small steps (React Flow uses d3-drag).
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

const centre = async (page: Page, locator: ReturnType<Page['locator']>) => {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test('a diagram saved by production opens unchanged, and opening it writes nothing', async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(card(page, 'Cart').locator('.flow-node-header')).toHaveText('My cart');
  await expect(page.getByText('2 cards · 1 connections')).toBeVisible();
  await page.waitForTimeout(800);
  expect(await raw(page)).toBe(JSON.stringify(SAMPLE));
});

test('moving a card is one undo step, and undo is saved and survives a reload', async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const article = card(page, 'Article');
  const start = await centre(page, article.locator('img'));
  await drag(page, start, { x: start.x + 150, y: start.y + 40 });
  const moved = (await saved(page))!.nodes.find((n) => n.data.graphicId === 'article-article-1')!;
  expect(moved.position).not.toEqual({ x: 180, y: 50 });

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.data.graphicId === 'article-article-1')!.position).toEqual({ x: 180, y: 50 });

  // The undone state is what reloads, and redo is still available after the reload.
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  expect((await saved(page))!.nodes.find((n) => n.data.graphicId === 'article-article-1')!.position).toEqual({ x: 180, y: 50 });
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.data.graphicId === 'article-article-1')!.position).toEqual(moved.position);
});

test('a connection dropped on empty canvas creates nothing; dropped on a card it connects', async ({ page }) => {
  await seed(page, { nodes: SAMPLE.nodes, edges: [] });
  await openEditor(page);
  const article = card(page, 'Article');
  const source = await centre(page, article.locator('.react-flow__handle-bottom'));
  const before = await raw(page);
  await drag(page, source, { x: source.x + 300, y: source.y + 80 });
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  expect(await raw(page)).toBe(before);

  const target = await centre(page, card(page, 'Cart').locator('.react-flow__handle-top'));
  await drag(page, source, target);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect.poll(async () => (await saved(page))!.edges.length).toBe(1);
});

test('edges saved with a missing end are removed on load, with a message', async ({ page }) => {
  await seed(page, { ...SAMPLE, edges: [...SAMPLE.edges, { id: 'loose', source: SAMPLE.nodes[0].id, target: { x: 500, y: 520 } }, { id: 'gone', source: SAMPLE.nodes[0].id, target: 'deleted' }] });
  await openEditor(page);
  await expect(page.getByRole('status').filter({ hasText: "Removed 2 connections that didn't connect two cards." })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  // Nothing is written until the user changes something.
  expect(JSON.parse((await raw(page))!).edges).toHaveLength(3);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText("Removed 2 connections")).toHaveCount(0);
});

test('deleting a card removes its connections, and one undo brings both back', async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  await card(page, 'Cart').locator('img').click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.edges.length).toBe(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect.poll(async () => (await saved(page))!.nodes.length).toBe(2);
});

test('H hides a header and undo shows it again; typing in the header is not a shortcut', async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const cart = card(page, 'Cart');
  await cart.locator('img').click();
  await page.keyboard.press('h');
  await expect(cart.locator('.flow-node-header')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(cart.locator('.flow-node-header')).toHaveText('My cart');

  await cart.locator('.flow-node-header button').dblclick();
  const input = page.getByRole('textbox', { name: 'Card header' });
  await input.fill('Shopping cart');
  await expect(cart.locator('.flow-node-header')).toHaveCount(1);
  await input.press('Enter');
  await expect(cart.locator('.flow-node-header')).toHaveText('Shopping cart');
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.data.graphicId === 'e-commerce-cart')!.data.headerText).toBe('Shopping cart');

  // Escape cancels an edit.
  await cart.locator('.flow-node-header button').dblclick();
  await page.getByRole('textbox', { name: 'Card header' }).fill('Never mind');
  await page.keyboard.press('Escape');
  await expect(cart.locator('.flow-node-header')).toHaveText('Shopping cart');
  expect((await saved(page))!.nodes.find((n) => n.data.graphicId === 'e-commerce-cart')!.data.headerText).toBe('Shopping cart');
});

test('unreadable saved data is kept in a backup key, not overwritten', async ({ page }) => {
  await seed(page, '{"nodes": [broken');
  await openEditor(page);
  await expect(page.getByRole('alert').filter({ hasText: "Your saved diagram couldn't be read" })).toBeVisible();
  await page.locator('aside button[draggable="true"]').first().click();
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(`${key}.unreadable`), STORAGE_KEY)).toBe('{"nodes": [broken');
});

test('a diagram from a newer version is shown but never overwritten', async ({ page }) => {
  const newer = JSON.stringify({ ...SAMPLE, version: 99 });
  await seed(page, newer);
  await openEditor(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.getByRole('alert').filter({ hasText: 'newer version of Wireflow' })).toBeVisible();
  await card(page, 'Cart').locator('img').click();
  await page.keyboard.press('h');
  await expect(page.getByText('Not saved in this browser')).toBeVisible();
  expect(await raw(page)).toBe(newer);
});
