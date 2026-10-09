import { readFileSync } from 'node:fs';
import { test, expect, openEditor, saved, STORAGE_KEY } from './fixtures';

const graphics: Array<{ id: string; label: string; src: string; category: string }> = JSON.parse(
  readFileSync(new URL('../data/graphics.json', import.meta.url), 'utf8'),
);

test('the landing page has production metadata and links into the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Wireflow - Free Wire / User Flow Tool');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  expect(await meta('meta[name="description"]')).toBe(
    'Wireflow is a free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills required.',
  );
  expect(await meta('meta[property="og:title"]')).toBe('Wireflow - Free Wire / User Flow Tool');
  expect(await meta('meta[property="og:image"]')).toBe('https://wireflow.co/icon-512.png');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary');
  expect(await meta('meta[name="theme-color"]')).toBe('#465BFF');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Free Wire /User Flow Tool');
  // Every gallery card deep-links into the editor.
  const links = page.locator('a[href^="/app?card="]');
  await expect(links).toHaveCount(graphics.length);

  await page.getByRole('link', { name: 'Start designing' }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page).toHaveTitle('Wireflow - Flow Editor');
});

test('a gallery link opens the editor with that card', async ({ page }) => {
  const graphic = graphics.find((g) => g.id === 'e-commerce-cart') ?? graphics[20];
  await openEditor(page, `?card=${graphic.id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__node img')).toHaveAttribute('src', graphic.src);
});

test('the manifest, icons and template graphics are served', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ short_name: 'Wireflow', start_url: '/', display: 'standalone', theme_color: '#465BFF' });
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
  for (const g of [graphics[0], graphics[graphics.length - 1]]) {
    const res = await request.get(g.src);
    expect(res.status(), g.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
  }
});

test('unknown paths get the 404 page, and /blog is left alone', async ({ request }) => {
  for (const path of ['/no-such-page', '/blog/', '/blog/some-post/']) {
    const res = await request.get(path, { maxRedirects: 0 });
    // Not the editor, not the landing page: either Next's 404 or (for /blog/
    // without a trailing-slash route) its redirect to the 404.
    expect([308, 404], path).toContain(res.status());
    if (res.status() === 404) expect(await res.text()).toContain('This page could not be found.');
  }
});

test('a dropped card and a connection are saved in production format', async ({ page }) => {
  await openEditor(page);
  const tiles = page.locator('aside button[draggable="true"]');
  await expect(tiles).toHaveCount(graphics.length);

  // Click two templates to add them.
  await tiles.nth(0).click();
  await tiles.nth(20).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  const [a, b] = await page.locator('.react-flow__node').all();
  const source = a.locator('.react-flow__handle-bottom');
  const target = b.locator('.react-flow__handle-top');
  await a.hover();
  await source.hover();
  await page.mouse.down();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  await expect.poll(async () => (await saved(page))?.edges.length).toBe(1);
  const data = (await saved(page))!;
  expect(data.nodes).toHaveLength(2);
  for (const node of data.nodes) {
    expect(node).toMatchObject({ type: 'flow', position: { x: expect.any(Number), y: expect.any(Number) } });
    const graphic = graphics.find((g) => g.id === node.data.graphicId)!;
    expect(node.data).toMatchObject({ graphicId: graphic.id, src: graphic.src, label: graphic.label });
  }
  expect(data.edges[0]).toMatchObject({ markerEnd: { type: 'arrowclosed' } });
  expect(new Set([data.edges[0].source, data.edges[0].target])).toEqual(new Set(data.nodes.map((n) => n.id)));

  // It survives a reload.
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  expect(await page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true);
});
