import { readFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect, saved, templates, panelTitle, nodeLabelInput, onCanvas, dropTemplate } from './helpers.js';

// Proof of concept for #60: the editor on React Flow behind `?engine=rf`, editing the
// same localStorage diagram (G6 format) as the gg-editor app.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/checkout-flow.json', import.meta.url), 'utf8'));
const CART = 19;

const node = (page, id) => page.locator(`.react-flow__node[data-id="${id}"]`);
const handle = (page, id, side) => node(page, id).locator(`.react-flow__handle-${side}`);
const rfPanelTitle = (page) => page.locator('.details .ant-card-head-title');

async function seed(page, data = fixture) {
  await page.addInitScript((d) => {
    if (localStorage.getItem('data') === null) localStorage.setItem('data', JSON.stringify(d));
  }, data);
}

async function openReactFlow(page) {
  await page.goto('/?engine=rf');
  await expect(page.locator('.rf-canvas .react-flow__pane')).toBeVisible();
}

// Page coordinates of a point in flow coordinates (the canvas opens at zoom 1, origin top-left).
async function onFlow(page, x, y) {
  const box = await page.locator('.rf-canvas .react-flow__pane').boundingBox();
  return { x: box.x + x, y: box.y + y };
}

const center = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// React Flow starts a node drag at the first pointer move beyond its 1px threshold and
// measures from there, so nudge 2px first and keep that offset to land exactly on `to`.
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 2, from.y);
  await page.mouse.move(to.x + 2, to.y, { steps: 15 });
  await page.mouse.up();
}

test('the React Flow engine loads in its own chunk and draws the saved diagram unchanged', async ({ page }) => {
  await seed(page);
  const scripts = [];
  page.on('response', (response) => response.url().endsWith('.js') && scripts.push(new URL(response.url()).pathname));

  // The default editor doesn't download the React Flow chunk.
  await page.goto('/');
  await expect(page.locator('#canvas_1')).toBeVisible();
  const ggScripts = [...scripts];

  await openReactFlow(page);
  expect(scripts.filter((s) => !ggScripts.includes(s)).length).toBeGreaterThan(0);

  await expect(page.locator('.react-flow__node-screen')).toHaveCount(5);
  await expect(page.locator('.react-flow__node-group')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await expect(page.locator('.rf-screen__label')).toHaveText(['Sign in', 'Products', 'Checkout', 'Order complete']); // Cart has no header
  await expect(page.locator('.rf-group__label')).toHaveText('Payment');
  await expect(page.locator('.react-flow__edge-text')).toHaveText(['Log in', 'Add to cart', 'Pay']);
  await expect(page.locator('.rf-minimap .react-flow__minimap-node')).toHaveCount(6);
  await expect(rfPanelTitle(page)).toHaveText('Canvas');

  // Nodes sit where gg-editor put them: center (150, 160), 96 x 88.
  const signIn = await node(page, 'signin01').boundingBox();
  const origin = await onFlow(page, 0, 0);
  expect({ x: signIn.x - origin.x, y: signIn.y - origin.y, w: signIn.width, h: signIn.height }).toEqual({ x: 102, y: 116, w: 96, h: 88 });
  // The group's child sits inside its frame.
  const frame = await node(page, 'group001').boundingBox();
  const cart = await node(page, 'cart0001').boundingBox();
  expect(cart.x).toBeGreaterThan(frame.x);
  expect(cart.y + cart.height).toBeLessThan(frame.y + frame.height);

  // Loading writes nothing.
  expect(await saved(page)).toEqual(fixture);
});

test('drop, connect, move into a group, undo/redo and delete autosave in the G6 format', async ({ page }) => {
  await seed(page);
  await openReactFlow(page);
  const img = await templates(page).nth(CART).getAttribute('src');

  // Drag a template from the sidebar.
  await dropTemplate(page, CART, await onFlow(page, 400, 650));
  await expect.poll(async () => (await saved(page)).nodes.length).toBe(6);
  const added = (await saved(page)).nodes[5];
  expect(added).toMatchObject({ type: 'node', shape: 'node-image-header', size: [96, 88], label: 'Cart', img, x: 400, y: 650 });
  expect(added.parent).toBeUndefined();
  await expect(rfPanelTitle(page)).toHaveText('Node');

  // Releasing a connection on empty canvas creates nothing (no dangling edges, #107).
  const before = await page.evaluate(() => localStorage.getItem('data'));
  await node(page, added.id).hover();
  await drag(page, await center(handle(page, added.id, 'right')), await onFlow(page, 700, 750));
  expect(await page.evaluate(() => localStorage.getItem('data'))).toBe(before);

  // Connect the new screen's top handle to Cart's bottom handle.
  await node(page, added.id).hover();
  await drag(page, await center(handle(page, added.id, 'top')), await center(handle(page, 'cart0001', 'bottom')));
  await expect.poll(async () => (await saved(page)).edges.length).toBe(5);
  expect((await saved(page)).edges[4]).toMatchObject({
    source: added.id,
    sourceAnchor: 0,
    target: 'cart0001',
    targetAnchor: 2,
    shape: 'flow-polyline-round',
    color: '#a4b2c0',
    style: { lineWidth: 2 },
  });

  // Move "Order complete" into the Payment group's frame: it joins the group (#81).
  await drag(page, await onFlow(page, 880, 440), await onFlow(page, 520, 460));
  await expect.poll(async () => (await saved(page)).nodes.find((n) => n.id === 'complete')).toMatchObject({ x: 520, y: 440, parent: 'group001' });

  // Undo puts it back, redo moves it in again.
  await page.keyboard.press('Control+z');
  // (Saving re-points the old /static/media/ image URL at this build's file, like gg-editor.)
  await expect
    .poll(async () => (await saved(page)).nodes.find((n) => n.id === 'complete'))
    .toEqual({ ...fixture.nodes[4], img: expect.stringMatching(/^\/assets\/Complete-.+\.svg$/) });
  await page.locator('.toolbar [data-command="redo"]').click();
  await expect.poll(async () => (await saved(page)).nodes.find((n) => n.id === 'complete').parent).toBe('group001');

  // Select and delete; the edges of the deleted node go too.
  await page.mouse.click(...Object.values(await onFlow(page, 150, 160)));
  await expect(rfPanelTitle(page)).toHaveText('Node');
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await saved(page)).nodes.map((n) => n.id)).not.toContain('signin01');
  expect((await saved(page)).edges.map((e) => e.id)).not.toContain('edge0001');

  // Multi-select with Control+click.
  await node(page, 'product1').click();
  await node(page, 'checkout').click({ modifiers: ['Control'] });
  await expect(rfPanelTitle(page)).toHaveText('Multi Select');

  // Zoom, then reload: the diagram is the same, the view starts at zoom 1 again.
  await page.locator('.toolbar [data-command="zoomIn"]').click();
  await expect(page.locator('.rf-canvas .react-flow__viewport')).toHaveAttribute('style', /scale\(1\.2\)/);
  const last = await saved(page);
  await page.reload();
  await expect(page.locator('.react-flow__node-screen')).toHaveCount(5);
  expect(await saved(page)).toEqual(last);
});

// Width and height from a JPEG's start-of-frame segment.
function jpegSize(bytes) {
  for (let i = 2; i < bytes.length; ) {
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return null;
}

test('export saves the whole diagram at twice its size, whatever the zoom (#68)', async ({ page }) => {
  await seed(page);
  await openReactFlow(page);
  await page.locator('.toolbar [data-command="zoomOut"]').click();
  await page.locator('.toolbar [data-command="zoomOut"]').click();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export as JPEG' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('wireflow.jpg');
  const bytes = readFileSync(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  // Diagram bounds: x 102..928 (Sign in to Order complete), y 116..480 (Sign in to the
  // Payment frame), plus 40px padding on each side, at pixel ratio 2.
  expect(jpegSize(bytes)).toEqual({ width: (826 + 80) * 2, height: (364 + 80) * 2 });
});

test('both engines edit the same diagram', async ({ page }) => {
  await seed(page);
  await openReactFlow(page);

  // Rename a screen in React Flow ...
  await node(page, 'product1').click();
  await page.locator('.rf-details input[name=label]').fill('Catalog');
  await page.locator('.rf-details input[name=label]').press('Enter');
  await expect.poll(async () => (await saved(page)).nodes[1].label).toBe('Catalog');

  // ... and gg-editor shows it.
  await page.goto('/?engine=gg');
  await expect(page.locator('#canvas_1')).toBeVisible();
  const products = await onCanvas(page, 400, 160);
  await page.mouse.click(products.x, products.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue('Catalog');

  // Rename it in gg-editor and switch back.
  await nodeLabelInput(page).fill('Shop');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => (await saved(page)).nodes[1].label).toBe('Shop');
  await openReactFlow(page);
  await expect(node(page, 'product1').locator('.rf-screen__label')).toHaveText('Shop');
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
});

test.describe('on a phone', () => {
  // Pixel 7 (412 x 915, touch, mobile) without `defaultBrowserType`, which can't be set per describe group.
  const pixel7 = { ...devices['Pixel 7'] };
  delete pixel7.defaultBrowserType;
  test.use(pixel7);

  // Playwright has no touch-drag API; send real touch input through the DevTools protocol.
  async function touchDrag(page, from, to, steps = 12) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await touch('touchStart', from);
    for (let i = 1; i <= steps; i += 1) {
      await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    }
    await touch('touchEnd');
    await cdp.detach();
  }

  test('templates can be dragged in, moved and connected by touch', async ({ page }) => {
    await seed(page, { nodes: [{ ...fixture.nodes[0], y: 420 }], edges: [], groups: [] });
    await openReactFlow(page);

    // Drag a template sideways out of the sidebar onto the canvas. (A vertical swipe
    // scrolls the sidebar instead: its items have touch-action: pan-y.)
    const from = await center(templates(page).first());
    const pane = await page.locator('.rf-canvas .react-flow__pane').boundingBox();
    await touchDrag(page, from, { x: pane.x + 150, y: from.y });
    await expect.poll(async () => (await saved(page)).nodes.length).toBe(2);
    const added = (await saved(page)).nodes[1];
    expect(added).toMatchObject({ x: 150, y: from.y - pane.y, label: 'Article' });

    // Move it down with a finger.
    const start = await center(node(page, added.id));
    await touchDrag(page, start, { x: start.x, y: start.y + 120 });
    // (The first touch move only starts the drag.)
    await expect.poll(async () => (await saved(page)).nodes[1].y).toBeGreaterThanOrEqual(added.y + 100);

    // Connect the new screen (bottom handle) to "Sign in" (top handle).
    await touchDrag(page, await center(handle(page, added.id, 'bottom')), await center(handle(page, 'signin01', 'top')));
    await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ source: added.id, sourceAnchor: 2, target: 'signin01', targetAnchor: 0 }]);
  });
});
