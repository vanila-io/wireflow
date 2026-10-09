// Phone viewport (Pixel 7, 412 x 915) with real touch events. See e2e/touch.ts.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, saved, STORAGE_KEY, card } from './fixtures';
import { Finger, centre } from './touch';

const node = (id: string, graphicId: string, label: string, x: number, y: number) => ({
  id,
  type: 'flow',
  position: { x, y },
  data: { graphicId, src: '', label, headerText: label, showHeader: true },
});
const TWO = { nodes: [node('a', 'article-article-1', 'Article', 0, 0), node('b', 'e-commerce-cart', 'Cart', 0, 420)], edges: [] };

async function seed(page: Page, value: unknown) {
  await page.goto('/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(value)]);
  await openEditor(page);
  // Wait for the opening fit and the images.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
}

test('the editor fits a phone screen: no sideways scrolling, every toolbar button on screen', async ({ page }) => {
  await openEditor(page);
  const { innerWidth, scrollWidth } = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(scrollWidth).toBe(innerWidth);
  for (const name of ['Undo', 'Redo', 'Zoom out', 'Zoom in', 'Fit view', 'Open file', 'Export JSON', 'Clear canvas']) {
    const b = (await page.getByRole('button', { name, exact: true }).last().boundingBox())!;
    expect(b.x, name).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, name).toBeLessThanOrEqual(innerWidth);
  }
  await expect(page.getByRole('button', { name: 'AI assistant' })).toBeVisible();
  // The sidebar leaves most of the screen to the canvas.
  const side = (await page.getByRole('complementary', { name: 'Screen templates' }).boundingBox())!;
  expect(side.width).toBeLessThan(innerWidth / 2);
  // The category chips are one row that scrolls sideways, so the templates start near the top.
  const tops = await page.getByRole('group', { name: 'Categories' }).getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
});

test('a tap adds a template; a sideways swipe drags one onto the canvas; an up-down swipe scrolls', async ({ page }) => {
  await openEditor(page);
  const finger = await Finger.on(page);
  const tiles = page.locator('aside button[draggable="true"]');

  await finger.tap(await centre(tiles.nth(0)));
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  const list = tiles.first().locator('..');
  const from = await centre(tiles.nth(2));
  await finger.drag(from, { x: from.x, y: from.y - 200 });
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  const tile = await centre(tiles.nth(4));
  // Sideways: a mostly vertical swipe scrolls the list instead.
  await finger.drag(tile, { x: pane.x + pane.width / 2, y: tile.y });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
});

test('a finger moves a card, as one undo step', async ({ page }) => {
  await seed(page, TWO);
  const finger = await Finger.on(page);
  const from = await centre(card(page, 'Article').locator('img'));
  await finger.drag(from, { x: from.x + 40, y: from.y + 60 });
  await expect.poll(async () => (await saved(page))?.nodes.find((n) => n.id === 'a')!.position).not.toEqual({ x: 0, y: 0 });
  await finger.tap(await centre(page.getByRole('button', { name: 'Undo' })));
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 0, y: 0 });
});

test('a finger connects two cards by dragging from a handle, and by tapping one handle then the other', async ({ page }) => {
  await seed(page, TWO);
  const finger = await Finger.on(page);
  const source = await centre(card(page, 'Article').locator('.react-flow__handle-bottom'));
  const target = await centre(card(page, 'Cart').locator('.react-flow__handle-top'));

  // Released on empty canvas: nothing.
  await finger.drag(source, { x: source.x + 60, y: source.y + 40 });
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  await finger.drag(source, target);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect.poll(async () => (await saved(page))?.edges.length).toBe(1);

  // Tap to connect (React Flow's connectOnClick), after undoing the first one.
  await finger.tap(await centre(page.getByRole('button', { name: 'Undo' })));
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await finger.tap(source);
  await finger.tap(target);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  expect((await saved(page))!.edges[0]).toMatchObject({ source: 'a', target: 'b' });
});
