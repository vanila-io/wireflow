import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  saved,
  templates,
  categoryNames,
  categoryToggle,
  template,
  panelTitle,
  nodeLabelInput,
  command,
  openEditor,
  onCanvas,
  dropTemplate,
  connect,
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

const CATEGORIES = ['Article', 'Blog', 'E-Commerce', 'Features', 'Gallery', 'Header', 'Misc', 'Multimedia', 'Sign in', 'Socials'];

// Saved nodes are not in the order they were added: Object.keys lists G6 ids that look like
// integers (about 2% of them, e.g. "38291045") first. Tests that care sort them by x.
const byX = (a, b) => a.x - b.x;

test('the canvas starts exactly where the sidebar ends', async ({ page }) => {
  await openEditor(page);
  const canvas = await page.locator('#canvas_1').boundingBox();

  // The card and its fixed-position body are sized separately; neither may overlap the canvas or leave a gap.
  for (const part of ['.sidebar', '.sidebar .ant-card-body']) {
    const box = await page.locator(part).boundingBox();
    expect(box.x + box.width, part).toBe(canvas.x);
  }
});

test('sidebar groups named templates under category headings that collapse and stay collapsed', async ({ page }) => {
  await openEditor(page);
  const total = await templates(page).count();

  await expect(categoryNames(page)).toHaveText(CATEGORIES);
  await expect(page.locator('.sidebar-category-count')).toHaveText(['6', '12', '12', '6', '6', '6', '24', '12', '6', '12']);
  // Every thumbnail is named by its alt text and, for the mouse, its tile's tooltip.
  const unnamed = await templates(page).evaluateAll((imgs) =>
    imgs.filter((img) => !img.alt || img.closest('.sidebar-item').title !== img.alt).map((img) => img.src),
  );
  expect(unnamed).toEqual([]);
  await expect(template(page, 'E-Commerce', 'Checkout Delivery')).toBeVisible();

  const blog = categoryToggle(page, 'Blog');
  await expect(blog).toHaveAttribute('aria-expanded', 'true');
  await blog.click();
  await expect(blog).toHaveAttribute('aria-expanded', 'false');
  await expect(templates(page)).toHaveCount(total - 12);
  await expect(categoryNames(page)).toHaveText(CATEGORIES);

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  await expect(blog).toHaveAttribute('aria-expanded', 'false');
  await expect(templates(page)).toHaveCount(total - 12);

  await blog.click();
  await expect(blog).toHaveAttribute('aria-expanded', 'true');
  await expect(templates(page)).toHaveCount(total);
  expect(await saved(page)).toBeNull();
});

test('collapsing the category you have scrolled into keeps its heading where it was', async ({ page }) => {
  await openEditor(page);
  const list = await page.locator('.sidebar-list').boundingBox();
  const misc = categoryToggle(page, 'Misc');

  // Deep inside Misc (24 templates), its heading is pinned to the top of the list.
  await template(page, 'Misc', 'Team').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await misc.boundingBox()).y).toBeCloseTo(list.y, 0);

  await misc.click();
  await expect(misc).toHaveAttribute('aria-expanded', 'false');
  // Still at the top of the list, under the pointer, rather than scrolled far out of view.
  expect((await misc.boundingBox()).y).toBeCloseTo(list.y, 0);
  await expect(template(page, 'Multimedia', 'Files')).toBeInViewport();
});

test('category toggles are named headings that work from the keyboard', async ({ page }) => {
  await openEditor(page);
  const article = categoryToggle(page, 'Article');
  await expect(page.locator('.sidebar-category').first()).toMatchAriaSnapshot(`
    - heading "Article 6" [level=2]:
      - button "Article 6" [expanded]
  `);

  await article.focus();
  await page.keyboard.press('Enter');
  await expect(article).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(article).toHaveAttribute('aria-expanded', 'true');
  await expect(article).toBeFocused();

  // aria-controls may only name a list that is on the page; a collapsed category has none.
  await categoryToggle(page, 'Blog').click();
  await expect(categoryToggle(page, 'Blog')).toHaveAttribute('aria-expanded', 'false');
  const dangling = await page.locator('.sidebar-category-toggle').evaluateAll((buttons) =>
    buttons.filter((b) => b.hasAttribute('aria-controls') && !document.getElementById(b.getAttribute('aria-controls'))).map((b) => b.textContent),
  );
  expect(dangling).toEqual([]);
});

test('sidebar search matches template and category names across categories', async ({ page }) => {
  await openEditor(page);
  const total = await templates(page).count();
  const search = page.locator('.sidebar-search input');
  await categoryToggle(page, 'E-Commerce').click();
  await expect(templates(page)).toHaveCount(total - 12);

  // Matches show even inside a collapsed category; categories without matches are hidden.
  await search.fill('cart');
  await expect(categoryNames(page)).toHaveText(['E-Commerce']);
  await expect(templates(page)).toHaveCount(2);
  expect(await templates(page).evaluateAll((imgs) => imgs.map((img) => img.alt))).toEqual(['Cart pop up', 'Cart']);
  await expect(categoryToggle(page, 'E-Commerce')).toBeDisabled();

  // New results start at the top of the list, wherever it was scrolled to.
  const list = page.locator('.sidebar-list');
  await search.fill('');
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await search.fill('video');
  await expect(categoryNames(page)).toHaveText(['Blog', 'Header', 'Multimedia']);
  expect(await list.evaluate((el) => el.scrollTop)).toBe(0);

  await search.fill('multimedia');
  await expect(categoryNames(page)).toHaveText(['Multimedia']);
  await expect(templates(page)).toHaveCount(12);

  await search.fill('no such template');
  await expect(categoryNames(page)).toHaveCount(0);
  await expect(templates(page)).toHaveCount(0);
  await expect(page.locator('.sidebar-empty .ant-empty-description')).toHaveText('No matching templates');

  await page.locator('.sidebar-search .ant-input-clear-icon').click();
  await expect(search).toHaveValue('');
  await expect(categoryNames(page)).toHaveText(CATEGORIES);
  await expect(categoryToggle(page, 'E-Commerce')).toHaveAttribute('aria-expanded', 'false');
  await expect(templates(page)).toHaveCount(total - 12);
});

test('the sidebar is as compact as before the categories: ten whole templates fit on a 900px-tall screen', async ({ page }) => {
  await openEditor(page);

  const whole = await templates(page).evaluateAll((imgs) =>
    imgs.filter((img) => {
      const { top, bottom } = img.closest('.sidebar-item').getBoundingClientRect();
      return top >= 0 && bottom <= window.innerHeight;
    }).length,
  );
  expect(whole).toBeGreaterThanOrEqual(10);
});

test('a template drags from anywhere on its tile, in the first, a middle and the last category', async ({ page }) => {
  await openEditor(page);
  // Socials starts collapsed, so its tiles mount after the editor exists and still have to start drags.
  await categoryToggle(page, 'Socials').click();
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  await categoryToggle(page, 'Socials').click();

  const picks = [template(page, 'Article', 'Article').first(), template(page, 'Misc', 'Team'), template(page, 'Socials', 'User').last()];
  const expected = [];
  for (const [i, img] of picks.entries()) {
    await img.scrollIntoViewIfNeeded();
    // Press in the tile's padding, 4px inside its left edge, not on the thumbnail itself.
    const grab = await img.evaluate((el) => {
      const tile = el.closest('.sidebar-item').getBoundingClientRect();
      return { x: tile.x + 4, y: tile.y + tile.height / 2 };
    });
    const at = await onCanvas(page, 200 + 250 * i, 300);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(at.x, at.y, { steps: 15 });
    await page.mouse.up();
    expected.push({ label: await img.getAttribute('alt'), img: await img.getAttribute('src'), x: 200 + 250 * i, y: 300 });
  }

  await expect.poll(async () => (await saved(page))?.nodes.toSorted(byX)).toMatchObject(expected);
  expect(expected.map((node) => node.label)).toEqual(['Article', 'Team', 'User']);
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
  await expect.poll(async () => (await saved(page))?.nodes.toSorted(byX).map((node) => node.label)).toEqual(['Article', 'Cart']);

  await page.mouse.click(landing.x, landing.y);
  await nodeLabelInput(page).fill('Landing page');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => (await saved(page)).nodes.toSorted(byX)[0].label).toBe('Landing page');

  // Switching straight to another node must show (and on blur keep) that node's own label.
  await page.mouse.click(cart.x, cart.y);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');
  await nodeLabelInput(page).focus();
  await nodeLabelInput(page).blur();

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect((await saved(page)).nodes.toSorted(byX).map((node) => node.label)).toEqual(['Landing page', 'Cart']);
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
  const [source, target] = (await saved(page)).nodes.toSorted(byX).map((node) => node.id);

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
