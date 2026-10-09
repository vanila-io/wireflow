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
  colorTrigger,
  colorPicker,
  command,
  openEditor,
  onCanvas,
  dropTemplate,
  connect,
  drag,
  leftAnchor,
  rightAnchor,
} from './helpers.js';

// Saved nodes are not always in the order they were added: an id made of digits
// only (such as "68642545") is an integer-like object key, and JavaScript lists
// those first. The tests place nodes left to right, so read them in that order.
const leftToRight = (nodes) => nodes.toSorted((p, q) => p.x - q.x);

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

  await expect.poll(async () => leftToRight((await saved(page))?.nodes ?? [])).toMatchObject(expected);
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
  await expect.poll(async () => leftToRight((await saved(page))?.nodes ?? []).map((node) => node.label)).toEqual(['Article', 'Cart']);

  await page.mouse.click(landing.x, landing.y);
  await nodeLabelInput(page).fill('Landing page');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => leftToRight((await saved(page)).nodes)[0].label).toBe('Landing page');

  // Switching straight to another node must show (and on blur keep) that node's own label.
  await page.mouse.click(cart.x, cart.y);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');
  await nodeLabelInput(page).focus();
  await nodeLabelInput(page).blur();

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(leftToRight((await saved(page)).nodes).map((node) => node.label)).toEqual(['Landing page', 'Cart']);
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
  const [source, target] = leftToRight((await saved(page)).nodes).map((node) => node.id);

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

  // Dragging the handle commits once, on release, so one Undo goes back to 3.
  const rail = await page.locator('.details .ant-slider-rail').boundingBox();
  await size.hover();
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width, rail.y + rail.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await edge()).style.lineWidth).toBe(10);
  await command(page, 'undo').click();
  await expect(size).toHaveAttribute('aria-valuenow', '3');

  // Dragging across the palette previews the color and commits it once, on release.
  await expect(colorTrigger(page)).toHaveText('#A4B2C0');
  await colorTrigger(page).click();
  const select = colorPicker(page).locator('.ant-color-picker-select');
  await select.hover({ position: { x: 40, y: 120 } }); // waits for the popover to finish animating
  const palette = await select.boundingBox();
  await page.mouse.down();
  await page.mouse.move(palette.x + palette.width * 0.8, palette.y + palette.height * 0.2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await edge()).color).not.toBe('#a4b2c0');
  expect((await edge()).color).toMatch(/^#[0-9a-f]{6}$/);
  await expect(colorTrigger(page)).toHaveText((await edge()).color.toUpperCase());

  // So a single Undo restores the original color. The panel follows Undo and Redo
  // while the edge stays selected (Undo is not autosaved, so check the panel).
  const picked = (await edge()).color.toUpperCase();
  await command(page, 'undo').click();
  await expect(colorTrigger(page)).toHaveText('#A4B2C0');
  await expect(page.locator('.details .ant-select')).toHaveText('Smooth');
  await expect(size).toHaveAttribute('aria-valuenow', '3');
  await command(page, 'redo').click();
  await expect(colorTrigger(page)).toHaveText(picked);
});

test('edge color can be typed as hex and reused from the colors already in the diagram', async ({ page }) => {
  await openEditor(page);
  const a = await onCanvas(page, 200, 300);
  const b = await onCanvas(page, 500, 300);
  const c = await onCanvas(page, 800, 300);
  await dropTemplate(page, 0, a);
  await dropTemplate(page, 1, b);
  await dropTemplate(page, 19, c);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(3);
  await connect(page, a, b);
  await connect(page, b, c);
  // Edge colors left to right (by source node): a→b, then b→c.
  const colors = async () => {
    const { nodes, edges } = await saved(page);
    const x = (id) => nodes.find((node) => node.id === id).x;
    return edges.toSorted((p, q) => x(p.source) - x(q.source)).map((edge) => edge.color);
  };
  await expect.poll(colors).toEqual(['#a4b2c0', '#a4b2c0']);
  const presets = (section) =>
    colorPicker(page).locator('.ant-collapse-item').filter({ hasText: section }).locator('.ant-color-picker-presets-color');

  const used = presets('In this diagram');

  await page.mouse.click((a.x + b.x) / 2, a.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  await colorTrigger(page).click();
  await expect(presets('Palette').first()).toHaveClass(/presets-color-checked/); // the default edge color
  await expect(used).toHaveCount(1); // both edges still have the default color
  // A pasted #rrggbbaa value is saved without its alpha: edges are opaque.
  await colorPicker(page).locator('.ant-color-picker-hex-input input').fill('E8590C80');
  await expect.poll(colors).toEqual(['#e8590c', '#a4b2c0']);
  await expect(colorTrigger(page)).toHaveText('#E8590C');
  await expect(used).toHaveCount(2); // updated while the picker is open

  // The other edge offers the color just used; picking it applies the exact value.
  await page.mouse.click((b.x + c.x) / 2, b.y);
  await expect(colorTrigger(page)).toHaveText('#A4B2C0');
  await colorTrigger(page).click();
  await expect(used).toHaveCount(2);
  const orange = used.filter({ has: page.locator('[style*="rgb(232, 89, 12)"]') });
  await expect(orange).toHaveCount(1);
  await orange.click();
  await expect.poll(colors).toEqual(['#e8590c', '#e8590c']);
  await expect(colorTrigger(page)).toHaveText('#E8590C');
  await expect(orange).toHaveClass(/presets-color-checked/);
  await expect(used).toHaveCount(1);

  // Undo reverts just that one color change. The panel and the "In this diagram"
  // row follow Undo and Redo while the edge stays selected.
  await command(page, 'undo').click();
  await expect(colorTrigger(page)).toHaveText('#A4B2C0');
  await colorTrigger(page).click();
  await expect(used).toHaveCount(2);
  await command(page, 'redo').click();
  await expect(colorTrigger(page)).toHaveText('#E8590C');
  await colorTrigger(page).click();
  await expect(used).toHaveCount(1);
});

test('the Node panel follows Undo and Redo, and leaving the label unchanged keeps Redo', async ({ page }) => {
  await openEditor(page);
  const at = await onCanvas(page, 400, 300);
  await dropTemplate(page, 0, at);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  await page.mouse.click(at.x, at.y);
  await nodeLabelInput(page).fill('Landing');
  // A command that changes something else (the header) keeps the typed label.
  await page.keyboard.press('Control+h');
  await nodeLabelInput(page).blur();
  await expect
    .poll(async () => (await saved(page)).nodes[0])
    .toMatchObject({ label: 'Landing', shape: 'node-image-without-header' });

  await command(page, 'undo').click();
  await expect(nodeLabelInput(page)).toHaveValue('Article');
  // Clicking into the field and out again changes nothing, so it adds no undo
  // step, which would also have thrown away the step Redo brings back.
  await nodeLabelInput(page).focus();
  await nodeLabelInput(page).blur();
  await expect(command(page, 'redo')).not.toHaveClass(/disable/);
  await command(page, 'redo').click();
  await expect(nodeLabelInput(page)).toHaveValue('Landing');
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

test('toolbar Delete removes the selected node, and Undo brings it back for good', async ({ page }) => {
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

  // Undo replays a snapshot (a G6 'changeData' event), which FlowCanvas saves.
  await command(page, 'undo').click();
  await expect.poll(async () => (await saved(page)).nodes).toMatchObject([{ id, label }]);
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue(label);
});

test('export button sits in the top-left of the canvas and downloads wireflow.jpg', async ({ page }) => {
  await openEditor(page);
  const button = page.getByRole('button', { name: 'Export as JPEG' });
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

test('header shortcuts change the selected node once and never an edge', async ({ page }) => {
  await openEditor(page);
  const a = await onCanvas(page, 300, 300);
  const b = await onCanvas(page, 650, 300);
  await dropTemplate(page, 0, a);
  await dropTemplate(page, 19, b);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
  await connect(page, a, b);
  await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ shape: 'flow-polyline-round' }]);

  // Showing the Node panel several times must not stack up shortcut handlers.
  for (const [at, label] of [[a, 'Article'], [b, 'Cart'], [a, 'Article']]) {
    await page.mouse.click(at.x, at.y);
    await expect(nodeLabelInput(page)).toHaveValue(label);
  }
  await page.keyboard.press('Control+h');
  await expect.poll(async () => leftToRight((await saved(page)).nodes)[0].shape).toBe('node-image-without-header');

  // So one Undo brings the header back. Undo is not autosaved: rename to save.
  await command(page, 'undo').click();
  await nodeLabelInput(page).fill('Landing');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => leftToRight((await saved(page)).nodes)[0]).toMatchObject({ label: 'Landing', shape: 'node-image-header', size: [96, 88] });

  // With the edge selected the shortcut does nothing; the label edit saves the edge.
  await page.mouse.click((a.x + b.x) / 2, a.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  await page.keyboard.press('Control+h');
  const edgeLabel = page.locator('.details').getByLabel('Label');
  await edgeLabel.fill('Next');
  await edgeLabel.blur();
  await expect.poll(async () => (await saved(page)).edges).toMatchObject([{ label: 'Next', shape: 'flow-polyline-round' }]);
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

test('an edge saved without a style can still be selected and recolored', async ({ page }) => {
  const data = {
    nodes: [
      { type: 'node', size: [96, 88], label: 'Sign in', x: 250, y: 250, id: '3c1f0a2b', shape: 'node-image-header' },
      { type: 'node', size: [96, 88], label: 'Cart', x: 550, y: 250, id: '9d4e7b10', shape: 'node-image-header' },
    ],
    edges: [{ source: '3c1f0a2b', sourceAnchor: 1, target: '9d4e7b10', targetAnchor: 3, shape: 'flow-smooth', color: '#1890ff', id: '5a6b7c8d' }],
    groups: [],
  };
  await page.addInitScript((data) => {
    if (localStorage.getItem('data') === null) localStorage.setItem('data', JSON.stringify(data));
  }, data);
  await openEditor(page);

  const signIn = await onCanvas(page, 250, 250);
  await page.mouse.click(signIn.x + 150, signIn.y);
  await expect(panelTitle(page)).toHaveText(['Edge']);
  await expect(colorTrigger(page)).toHaveText('#1890FF');
  await colorTrigger(page).click();
  await colorPicker(page).locator('.ant-color-picker-hex-input input').fill('E8590C');
  await expect.poll(async () => (await saved(page)).edges[0].color).toBe('#e8590c');
});
