import { test, expect, openEditor, saved } from './fixtures';

const sidebar = (page: import('@playwright/test').Page) => page.getByRole('complementary', { name: 'Screen templates' });
const tiles = (page: import('@playwright/test').Page) => sidebar(page).locator('button[draggable="true"]');

test('search looks in every category, whatever category is picked', async ({ page }) => {
  await openEditor(page);
  const chips = sidebar(page).getByRole('group', { name: 'Categories' });
  await chips.getByRole('button', { name: 'Blog' }).click();
  await expect(chips.getByRole('button', { name: 'Blog' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tiles(page).first().getByRole('img')).toHaveAttribute('alt', 'Blog');

  const search = sidebar(page).getByRole('textbox', { name: 'Search graphics in all categories' });
  await search.fill('cart');
  const names = await tiles(page).getByRole('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /cart/i.test(n!))).toBe(true);
  await expect(chips.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sidebar(page).getByRole('status')).toHaveText(`${names.length} ${names.length === 1 ? 'graphic matches' : 'graphics match'}`);

  // A category name matches too.
  await search.fill('sign in');
  expect(await tiles(page).count()).toBe(6);
  await search.fill('zzz');
  await expect(sidebar(page).getByText('No graphics match “zzz”')).toBeVisible();

  // Picking a category ends the search.
  await chips.getByRole('button', { name: 'Gallery' }).click();
  await expect(search).toHaveValue('');
  await expect(chips.getByRole('button', { name: 'Gallery' })).toHaveAttribute('aria-pressed', 'true');
});

test('a new search starts at the top of the list', async ({ page }) => {
  await openEditor(page);
  const list = tiles(page).first().locator('..');
  await list.evaluate((el) => el.scrollTo({ top: 2000 }));
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await sidebar(page).getByRole('textbox').fill('a');
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
});

test('a template drags from anywhere on its tile, and Enter adds one from the keyboard', async ({ page }) => {
  await openEditor(page);
  const tile = tiles(page).nth(3);
  // Press in the tile's padding, not on the image.
  await tile.dragTo(page.locator('.react-flow__pane'), { sourcePosition: { x: 3, y: 3 }, targetPosition: { x: 300, y: 200 } });
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  await tiles(page).nth(5).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
});

test('the canvas starts exactly where the sidebar ends (one width variable)', async ({ page }) => {
  await openEditor(page);
  const width = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim());
  expect(width).toBe('16rem');
  const side = (await sidebar(page).boundingBox())!;
  const pane = (await page.locator('.react-flow').boundingBox())!;
  expect(side.width).toBe(256);
  expect(pane.x).toBe(side.x + side.width);
});
