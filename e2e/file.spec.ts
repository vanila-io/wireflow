import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, openEditor, saved, STORAGE_KEY, card } from './fixtures';

const node = (id: string, graphicId: string, src: string, label: string, x: number, y: number) => ({
  id,
  type: 'flow',
  position: { x, y },
  data: { graphicId, src, label, headerText: label, showHeader: true },
});
const EXISTING = { nodes: [node('old', 'misc-404', '/graphics/misc/404.svg', '404', 0, 0)], edges: [] };

async function open(page: Page, name: string, content: string | object) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open file' }).first().click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)) });
}

const rawStorage = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

async function seed(page: Page, value: unknown, key = STORAGE_KEY) {
  await page.goto('/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(value)]);
  await openEditor(page);
}

test('a saved file opens again in a fresh browser, with stable template ids', async ({ page }) => {
  await openEditor(page);
  const tiles = page.locator('aside button[draggable="true"]');
  await tiles.nth(0).click();
  await tiles.nth(30).click();
  const [a, b] = await page.locator('.react-flow__node').all();
  await a.locator('.react-flow__handle-bottom').hover();
  await page.mouse.down();
  const t = (await b.locator('.react-flow__handle-top').boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
  await page.mouse.up();
  await a.locator('.flow-node-header button').dblclick();
  await page.getByRole('textbox', { name: 'Card header' }).fill('Landing');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await saved(page))?.edges.length).toBe(1);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('wireflow.json');
  const text = readFileSync(await file.path(), 'utf8');
  const json = JSON.parse(text);
  expect(json).toMatchObject({ format: 'wireflow', version: 2 });
  expect(json.diagram.nodes.map((n: { data: { graphicId: string } }) => n.data.graphicId)).toHaveLength(2);
  expect(text).not.toContain('/graphics/');
  const before = (await saved(page))!;

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await open(page, 'wireflow.json', text);
  await expect(page.getByRole('status').filter({ hasText: 'Opened wireflow.json.' })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByText('Landing', { exact: true })).toBeVisible();
  // Images come from this build's catalog.
  for (const img of await page.locator('.react-flow__node img').all()) expect(await img.getAttribute('src')).toMatch(/^\/graphics\//);
  const after = (await saved(page))!;
  expect(after.nodes.map((n) => [n.id, n.data])).toEqual(before.nodes.map((n) => [n.id, n.data]));
  await page.reload();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});

test('opening over a diagram asks first; cancel keeps it, replace is one undo step', async ({ page }) => {
  await seed(page, EXISTING);
  const incoming = { format: 'wireflow', version: 2, diagram: { nodes: [node('new', 'e-commerce-cart', '', 'Cart', 0, 0)], edges: [] } };

  await open(page, 'cart.json', incoming);
  const dialog = page.getByRole('dialog', { name: 'Replace the current diagram?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(card(page, '404')).toBeVisible();
  expect(JSON.parse((await rawStorage(page))!).nodes[0].id).toBe('old');

  await open(page, 'cart.json', incoming);
  await dialog.getByRole('button', { name: 'Replace' }).click();
  await expect(card(page, 'Cart')).toBeVisible();
  await expect(card(page, '404')).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.nodes.map((n) => n.id)).toEqual(['new']);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(card(page, '404')).toBeVisible();
  await expect.poll(async () => (await saved(page))!.nodes.map((n) => n.id)).toEqual(['old']);
});

test('files Wireflow cannot open show why and change nothing', async ({ page }) => {
  await seed(page, EXISTING);
  const storage = await rawStorage(page);
  const cases: Array<[string, string, RegExp]> = [
    ['notes.json', 'not json at all', /Couldn't open notes\.json\. It isn't a JSON file\./],
    ['package.json', '{"name":"x","version":"1.0.0"}', /doesn't contain a Wireflow diagram/],
    ['future.json', '{"format":"wireflow","version":9,"diagram":{"nodes":[]}}', /newer version of Wireflow/],
    ['loop.json', '{"nodes":[],"edges":[],"groups":[{"id":"a","parent":"b"},{"id":"b","parent":"a"}]}', /inside itself/],
    ['unknown.json', '{"format":"wireflow","version":1,"diagram":{"nodes":[{"id":"n","x":1,"y":1,"template":"Misc/Spaceship"}],"edges":[]}}', /doesn't have: "Misc\/Spaceship"/],
  ];
  for (const [name, content, message] of cases) {
    await open(page, name, content);
    await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await expect(card(page, '404')).toBeVisible();
  expect(await rawStorage(page)).toBe(storage);
});

test("opens production's export and the previous editor's files, dropping loose connections with a message", async ({ page }) => {
  await openEditor(page);
  const production = { nodes: [node('p1', 'article-article-1', '/graphics/article/article-1.svg', 'Article', 0, 0), node('p2', 'blog-articles-2', '/graphics/blog/articles-2.svg', 'Blog', 0, 300)], edges: [{ id: 'xy-edge__p1-p2', source: 'p1', target: 'p2', markerEnd: { type: 'arrowclosed' } }] };
  await open(page, 'wireflow.json', production);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  const v1 = {
    format: 'wireflow',
    version: 1,
    diagram: {
      nodes: [
        { id: 'a1', type: 'node', x: 100, y: 100, shape: 'node-image-header', label: 'Sign in', template: 'Sign in/Sign in 1', parent: 'g1' },
        { id: 'a2', type: 'node', x: 260, y: 100, shape: 'node-image-without-header', label: 'Cart', template: 'E-Commerce/Cart', parent: 'g1' },
      ],
      edges: [
        { id: 'e1', source: 'a1', target: 'a2', color: '#e8590c', label: 'Add' },
        { id: 'e2', source: 'a2', target: { x: 400, y: 500 } },
      ],
      groups: [{ id: 'g1', label: 'Shop' }],
    },
  };
  await open(page, 'old.json', v1);
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('status').filter({ hasText: "Removed 1 connection that didn't connect two cards." })).toBeVisible();
  await expect(page.locator('.react-flow__node-group')).toContainText('Shop');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByText('Add', { exact: true })).toBeVisible();
  // A file with __proto__ keys doesn't reach Object.prototype.
  await open(page, 'proto.json', '{"nodes":[{"id":"x","type":"flow","position":{"x":0,"y":0},"data":{"graphicId":"misc-404","__proto__":{"polluted":true}},"__proto__":{"polluted":true}}],"edges":[]}');
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
  await expect(card(page, 'Not Found 404')).toBeVisible();
  expect(await page.evaluate(() => (Object.prototype as Record<string, unknown>).polluted)).toBeUndefined();
});

test("a diagram too big for this browser's storage isn't opened, and the previous one stays", async ({ page }) => {
  await seed(page, EXISTING);
  // Make storage refuse anything larger than the current diagram, like a full quota.
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (value.length > 600) throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  const big = { nodes: Array.from({ length: 12 }, (_, i) => node(`n${i}`, 'article-article-1', '', 'Article', i * 260, 0)), edges: [] };
  const storage = await rawStorage(page);
  await open(page, 'big.json', big);
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "Couldn't open big.json. It's too big to keep in this browser's storage" })).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(card(page, '404')).toBeVisible();
  expect(await rawStorage(page)).toBe(storage);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
});

test("the previous editor's autosave is brought over once, and left in place", async ({ page }) => {
  const g6 = {
    nodes: [
      { type: 'node', size: [96, 88], shape: 'node-image-header', img: '/static/media/Cart.2ae03932.svg', label: 'My cart', x: 200, y: 150, id: 'c1' },
      { type: 'node', size: [96, 88], shape: 'node-image-header', img: '/assets/Article 1-Ab12Cd34.svg', label: 'Read', x: 400, y: 150, id: 'c2' },
    ],
    edges: [{ id: 'e', source: 'c1', target: 'c2', color: '#a4b2c0' }],
  };
  await seed(page, g6, 'data');
  await expect(page.getByRole('status').filter({ hasText: 'Brought over the diagram from the previous Wireflow editor' })).toBeVisible();
  await expect(page.getByText('My cart', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  expect((await saved(page))!.nodes).toHaveLength(2);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('data')))!)).toEqual(g6);
  await page.reload();
  await expect(page.getByText('Brought over')).toHaveCount(0);
  await expect(page.getByText('My cart', { exact: true })).toBeVisible();
});
