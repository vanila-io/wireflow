import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  saved,
  templates,
  panelTitle,
  nodeLabelInput,
  command,
  openEditor,
  onCanvas,
  dropTemplate,
  connect,
  drag,
  leftAnchor,
  rightAnchor,
} from './helpers.js';

test('app shell loads with templates, toolbar, minimap and canvas panel', async ({ page }) => {
  await openEditor(page);

  await expect(page).toHaveTitle('Wireflow');
  expect(await templates(page).count()).toBeGreaterThanOrEqual(100);
  await expect
    .poll(() => templates(page).evaluateAll((imgs) => imgs.filter((img) => !img.complete || img.naturalWidth === 0).length))
    .toBe(0);

  expect(await page.locator('.toolbar .command').evaluateAll((els) => els.map((el) => el.dataset.command))).toEqual([
    'undo', 'redo', 'copy', 'paste', 'delete', 'zoomIn', 'zoomOut', 'autoZoom', 'resetZoom',
    'toBack', 'toFront', 'multiSelect', 'addGroup', 'unGroup',
  ]);
  // Every toolbar/export icon resolves to a symbol from the iconfont script.
  await expect
    .poll(() =>
      page.locator('.toolbar use, .export use').evaluateAll((uses) =>
        uses.map((use) => use.getAttribute('xlink:href')).filter((href) => !document.getElementById(href.slice(1))),
      ),
    )
    .toEqual([]);
  expect(await page.locator('.toolbar use').count()).toBe(14);

  await expect(page.locator('.ant-card').filter({ hasText: 'Minimap' }).locator('canvas').first()).toBeVisible();
  await expect(panelTitle(page)).toHaveText(['Canvas']);
  await expect(page.locator('.details .ant-descriptions-title')).toHaveText('Keyboard Shortcuts');
  await expect(page.locator('.details .ant-descriptions-item-label')).toHaveText(['Zoom in', 'Zoom out']);
  expect(await saved(page)).toBeNull();
});

test('sidebar search filters templates and clearing it restores them', async ({ page }) => {
  await openEditor(page);
  const total = await templates(page).count();
  const search = page.locator('.sidebar-search input');

  await search.fill('cart');
  await expect(templates(page)).toHaveCount(2); // "Cart pop up" and "Cart"

  await page.locator('.sidebar-search .ant-input-clear-icon').click();
  await expect(search).toHaveValue('');
  await expect(templates(page)).toHaveCount(total);
});

test('dropping a template adds a saved node and selecting it opens the Node panel', async ({ page }) => {
  await openEditor(page);
  const CART = 19;
  const img = await templates(page).nth(CART).getAttribute('src');
  const at = await onCanvas(page, 400, 300);

  await dropTemplate(page, CART, at);

  await expect
    .poll(() => saved(page))
    .toMatchObject({
      nodes: [{ type: 'node', shape: 'node-image-header', label: 'Cart', img, size: [96, 88], x: 400, y: 300 }],
      edges: [],
      groups: [],
    });

  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');
});

test('renaming a node is saved, survives a reload and does not leak into other nodes', async ({ page }) => {
  await openEditor(page);
  const landing = await onCanvas(page, 300, 300);
  const cart = await onCanvas(page, 650, 300);
  await dropTemplate(page, 0, landing);
  await dropTemplate(page, 19, cart);
  await expect.poll(async () => (await saved(page))?.nodes.map((node) => node.label)).toEqual(['Article', 'Cart']);

  await page.mouse.click(landing.x, landing.y);
  await nodeLabelInput(page).fill('Landing page');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => (await saved(page)).nodes[0].label).toBe('Landing page');

  // Switching straight to another node must show (and on blur keep) that node's own label.
  await page.mouse.click(cart.x, cart.y);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');
  await nodeLabelInput(page).focus();
  await nodeLabelInput(page).blur();

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect((await saved(page)).nodes.map((node) => node.label)).toEqual(['Landing page', 'Cart']);
  await page.mouse.click(landing.x, landing.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue('Landing page');
});

test('connecting two nodes creates an edge whose shape, size and color are editable', async ({ page }) => {
  await openEditor(page);
  const a = await onCanvas(page, 300, 300);
  const b = await onCanvas(page, 650, 300);
  await dropTemplate(page, 0, a);
  await dropTemplate(page, 1, b);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
  const [source, target] = (await saved(page)).nodes.map((node) => node.id);

  await connect(page, a, b);
  await expect
    .poll(async () => (await saved(page)).edges)
    .toMatchObject([{ source, target, shape: 'flow-polyline-round', color: '#a4b2c0', style: { lineWidth: 2 } }]);
  const edge = async () => (await saved(page)).edges[0];

  await page.mouse.click((a.x + b.x) / 2, a.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);

  await page.locator('.details .ant-select').click();
  await page.locator('.ant-select-item-option').filter({ hasText: /^Smooth$/ }).click();
  await expect.poll(async () => (await edge()).shape).toBe('flow-smooth');

  const size = page.locator('.details .ant-slider-handle');
  await expect(size).toHaveAttribute('aria-valuenow', '2');
  await size.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await edge()).style.lineWidth).toBe(3);

  const saturation = await page.locator('.details .react-colorful__saturation').boundingBox();
  await page.mouse.click(saturation.x + saturation.width * 0.8, saturation.y + saturation.height * 0.2);
  await expect.poll(async () => (await edge()).color).toMatch(/^#[0-9a-f]{6}$/);
  expect((await edge()).color).not.toBe('#a4b2c0');
});

test('a new edge dropped on empty canvas is not created', async ({ page }) => {
  await openEditor(page);
  const a = await onCanvas(page, 300, 300);
  const b = await onCanvas(page, 650, 300);
  await dropTemplate(page, 0, a);
  await dropTemplate(page, 1, b);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
  const before = await page.evaluate(() => localStorage.getItem('data'));

  // Drop it on the empty canvas between the nodes. A loose edge would be a straight
  // line from the anchor to that point.
  await page.mouse.move(a.x, a.y, { steps: 5 });
  await drag(page, rightAnchor(a), { x: a.x + 200, y: a.y });
  await page.mouse.click(a.x + 120, a.y);
  await expect(panelTitle(page)).toHaveText(['Canvas']);
  expect(await page.evaluate(() => localStorage.getItem('data'))).toBe(before);

  // The same drag dropped on the other node's anchor connects them.
  const [source, target] = (await saved(page)).nodes.map((node) => node.id);
  await connect(page, a, b);
  await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ source, target }]);
});

test("an edge's end dropped on empty canvas stays on its node, and dropped on another node's anchor moves there", async ({ page }) => {
  await openEditor(page);
  const a = await onCanvas(page, 300, 300);
  const b = await onCanvas(page, 650, 300);
  const c = await onCanvas(page, 650, 550);
  await dropTemplate(page, 0, a);
  await dropTemplate(page, 1, b);
  await dropTemplate(page, 2, c);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(3);
  const [source, target, other] = (await saved(page)).nodes.map((node) => node.id);
  await connect(page, a, b);
  await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ source, target }]);
  const connected = await page.evaluate(() => localStorage.getItem('data'));

  // A selected edge has a handle on each end. The target one sits on the arrow head,
  // 10 px left of b's anchor.
  await page.mouse.click((a.x + b.x) / 2, a.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  const endHandle = { x: leftAnchor(b).x - 10, y: b.y };

  // Drag it back along the edge and drop it on empty canvas. If that drop were kept,
  // the edge would now stop short of b.
  await drag(page, endHandle, { x: a.x + 180, y: a.y });
  await page.mouse.click(b.x - 90, b.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  expect(await page.evaluate(() => localStorage.getItem('data'))).toBe(connected);

  // Dropped on c's anchor instead, the same edge now ends on c.
  await drag(page, endHandle, leftAnchor(c));
  await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ source, target: other }]);
});

test('edges saved with a loose end or to a missing node are removed on load and the cleaned diagram is saved', async ({ page }) => {
  const nodes = [
    { type: 'node', size: [96, 88], img: '/static/media/Sign in 1.a1b484ff.svg', label: 'Sign in', x: 250, y: 250, id: '3c1f0a2b', shape: 'node-image-header' },
    { type: 'node', size: [96, 88], img: '/static/media/Cart.2ae03932.svg', label: 'Cart', x: 550, y: 250, id: '9d4e7b10', shape: 'node-image-header' },
  ];
  const valid = { source: '3c1f0a2b', sourceAnchor: 1, target: '9d4e7b10', targetAnchor: 3, shape: 'flow-polyline-round', color: '#a4b2c0', style: { lineWidth: 2 }, id: '5a6b7c8d' };
  // Saved by older builds: one dropped on empty canvas below "Sign in", and one
  // pasted after the node it points to was deleted.
  const loose = { source: '3c1f0a2b', sourceAnchor: 2, target: { x: 250, y: 500 }, shape: 'flow-polyline-round', color: '#a4b2c0', style: { lineWidth: 2 }, id: '1e2f3a4b' };
  const toDeleted = { source: '9d4e7b10', sourceAnchor: 2, target: '7c0d1e2f', targetAnchor: 0, shape: 'flow-polyline-round', color: '#a4b2c0', style: { lineWidth: 2 }, id: '2b3c4d5e' };
  await page.addInitScript((data) => {
    if (localStorage.getItem('data') === null) localStorage.setItem('data', JSON.stringify(data));
  }, { nodes, edges: [loose, valid, toDeleted], groups: [] });
  // G6 can't draw an edge to a missing node, so without the clean-up the app doesn't start.
  await openEditor(page);

  const { edges } = await saved(page);
  expect(edges).toEqual([valid]);

  const signIn = await onCanvas(page, 250, 250);
  const cart = await onCanvas(page, 550, 250);
  await page.mouse.click(signIn.x, signIn.y + 170); // on the line the loose edge would draw
  await expect(panelTitle(page)).toHaveText(['Canvas']);
  await page.mouse.click((signIn.x + cart.x) / 2, signIn.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect((await saved(page)).edges).toEqual([valid]);
});

test('toolbar Delete removes the selected node and Undo brings it back', async ({ page }) => {
  await openEditor(page);
  const at = await onCanvas(page, 400, 300);
  await dropTemplate(page, 0, at);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  const { id, label } = (await saved(page)).nodes[0];
  await page.mouse.click(at.x, at.y);

  await command(page, 'delete').click();
  await expect.poll(async () => (await saved(page)).nodes).toEqual([]);
  await expect(command(page, 'delete')).toHaveClass(/disable/);
  // The node's spot is now empty canvas.
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Canvas']);

  await command(page, 'undo').click();
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue(label);

  // Undo replays a snapshot (a G6 'changeData' event), which FlowCanvas does not
  // autosave; the restored node is written on the next edit.
  await nodeLabelInput(page).fill('Restored');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => (await saved(page)).nodes).toMatchObject([{ id, label: 'Restored' }]);
});

test('export button sits in the top-left of the canvas and downloads wireflow.jpg', async ({ page }) => {
  await openEditor(page);
  const button = page.locator('.export button');
  await expect(button).toHaveClass(/ant-btn-circle/);
  const canvasBox = await page.locator('#canvas_1').boundingBox();
  const buttonBox = await button.boundingBox();
  expect(buttonBox.x - canvasBox.x).toBeLessThan(60);
  expect(buttonBox.y - canvasBox.y).toBeLessThan(60);

  const downloading = page.waitForEvent('download');
  await button.click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe('wireflow.jpg');
  const bytes = await readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(1000);
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]); // JPEG signature
});

test('keyboard shortcuts hide/show the node header and delete the node', async ({ page }) => {
  await openEditor(page);
  const at = await onCanvas(page, 400, 300);
  await dropTemplate(page, 0, at);
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Node']);

  await page.keyboard.press('Control+h');
  await expect
    .poll(async () => (await saved(page)).nodes[0])
    .toMatchObject({ shape: 'node-image-without-header', size: [96, 78] });

  await page.keyboard.press('Control+k');
  await expect
    .poll(async () => (await saved(page)).nodes[0])
    .toMatchObject({ shape: 'node-image-header', size: [96, 88] });

  await page.keyboard.press('Delete');
  await expect.poll(async () => (await saved(page)).nodes).toEqual([]);
});

test('a diagram saved by the pre-Vite app still loads, with its template images', async ({ page }) => {
  // Saved by the Create React App build: same data shape, but images live under /static/media/.
  const legacy = {
    nodes: [
      { type: 'node', size: [96, 88], img: '/static/media/Sign in 1.a1b484ff.svg', label: 'Sign in', x: 250, y: 250, id: '3c1f0a2b', shape: 'node-image-header' },
      { type: 'node', size: [96, 78], img: '/static/media/Cart.2ae03932.svg', label: 'Cart', x: 550, y: 250, id: '9d4e7b10', shape: 'node-image-without-header' },
    ],
    edges: [
      { source: '3c1f0a2b', sourceAnchor: 1, target: '9d4e7b10', targetAnchor: 3, shape: 'flow-smooth', color: '#1890ff', style: { lineWidth: 4 }, label: 'Add to cart', id: '5a6b7c8d' },
    ],
    groups: [],
  };
  await page.addInitScript((data) => {
    if (localStorage.getItem('data') === null) localStorage.setItem('data', JSON.stringify(data));
  }, legacy);
  await openEditor(page);

  const signIn = await onCanvas(page, 250, 250);
  await page.mouse.click(signIn.x, signIn.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue('Sign in');

  const cart = await onCanvas(page, 550, 250);
  await page.mouse.click(cart.x, cart.y);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');

  await page.mouse.click((signIn.x + cart.x) / 2, signIn.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  const edgeLabel = page.locator('.details').getByLabel('Label');
  await expect(edgeLabel).toHaveValue('Add to cart');
  await expect(page.locator('.details .ant-select')).toHaveText('Smooth');
  await expect(page.locator('.details .ant-slider-handle')).toHaveAttribute('aria-valuenow', '4');

  // Any edit re-saves the whole diagram; old image URLs now point at served SVGs.
  await edgeLabel.fill('Checkout');
  await edgeLabel.blur();
  await expect.poll(async () => (await saved(page)).edges[0].label).toBe('Checkout');
  const { nodes, edges } = await saved(page);
  expect(nodes.map((node) => node.id)).toEqual(['3c1f0a2b', '9d4e7b10']);
  expect(edges).toHaveLength(1);
  const sidebarImages = await templates(page).evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));
  for (const node of nodes) {
    expect(sidebarImages).toContain(node.img);
    const response = await page.request.get(node.img);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  }
});
