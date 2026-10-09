// Phone viewport (Pixel 7) with real touch events. See e2e/touch.ts.
import { test, expect, openEditor, saved } from './fixtures';
import { Finger, centre } from './touch';

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
  await finger.drag(tile, { x: pane.x + pane.width / 2, y: pane.y + pane.height / 3 });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
});
