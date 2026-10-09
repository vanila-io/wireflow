import { readFile, writeFile } from 'node:fs/promises';
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
} from './helpers.js';

const ARTICLE = 0;
const CART = 19;

const saveButton = (page) => page.getByRole('button', { name: 'Save to file' });
const openButton = (page) => page.getByRole('button', { name: 'Open file' });
const confirmDialog = (page) => page.locator('.ant-modal-confirm');
const toast = (page) => page.locator('.ant-message-notice');

async function saveFile(page) {
  const downloading = page.waitForEvent('download');
  await saveButton(page).click();
  const download = await downloading;
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
}

// `file` is a path, or { name, mimeType, buffer }.
async function openFile(page, file) {
  const choosing = page.waitForEvent('filechooser');
  await openButton(page).click();
  await (await choosing).setFiles(file);
}

const jsonFile = (name, contents) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof contents === 'string' ? contents : JSON.stringify(contents)),
});

// A one-node diagram in the file format, placed where nothing else is.
const loneCheckout = {
  format: 'wireflow',
  version: 1,
  diagram: {
    nodes: [{ type: 'node', size: [96, 88], shape: 'node-image-header', label: 'Checkout', template: 'E-Commerce/Checkout', x: 500, y: 450, id: 'c0ffee01' }],
    edges: [],
    groups: [],
  },
};

test('save and open buttons sit next to the export button', async ({ page }) => {
  await openEditor(page);
  const exportBox = await page.getByRole('button', { name: 'Export as JPEG' }).boundingBox();
  const saveBox = await saveButton(page).boundingBox();
  const openBox = await openButton(page).boundingBox();

  expect(saveBox.y).toBe(exportBox.y);
  expect(openBox.y).toBe(exportBox.y);
  expect(saveBox.x).toBeGreaterThan(exportBox.x + exportBox.width);
  expect(openBox.x).toBeGreaterThan(saveBox.x + saveBox.width);
  await expect(saveButton(page)).toHaveClass(/ant-btn-circle/);
  await expect(openButton(page)).toHaveClass(/ant-btn-circle/);
});

test('a diagram saved to a file opens again in a fresh browser and survives a reload', async ({ page }) => {
  await openEditor(page);
  const article = await onCanvas(page, 300, 300);
  const cart = await onCanvas(page, 650, 300);
  await dropTemplate(page, ARTICLE, article);
  await dropTemplate(page, CART, cart);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
  await connect(page, article, cart);
  await expect.poll(async () => (await saved(page)).edges.length).toBe(1);
  await page.mouse.click(article.x, article.y);
  await nodeLabelInput(page).fill('Landing page');
  await nodeLabelInput(page).blur();
  await expect.poll(async () => (await saved(page)).nodes[0].label).toBe('Landing page');
  const before = await saved(page);

  const { name, text } = await saveFile(page);
  expect(name).toBe('wireflow.json');
  const file = JSON.parse(text);
  expect(file).toMatchObject({ format: 'wireflow', version: 1 });
  expect(file.diagram.nodes).toMatchObject([
    { id: before.nodes[0].id, label: 'Landing page', template: 'Article/Article 1', x: 300, y: 300 },
    { id: before.nodes[1].id, label: 'Cart', template: 'E-Commerce/Cart', x: 650, y: 300 },
  ]);
  expect(text).not.toContain('/assets/'); // hashed image URLs change with every build
  expect(file.diagram.edges).toMatchObject(before.edges);

  // Start over with an empty editor, as in another browser.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(await saved(page)).toBeNull();

  const path = test.info().outputPath('wireflow.json');
  await writeFile(path, text);
  await openFile(page, path);
  await expect(toast(page)).toHaveText('Opened wireflow.json');
  await expect(confirmDialog(page)).toHaveCount(0); // nothing to replace
  await expect.poll(() => saved(page)).toMatchObject(before);

  const check = async () => {
    await page.mouse.click(article.x, article.y);
    await expect(panelTitle(page)).toHaveText(['Node']);
    await expect(nodeLabelInput(page)).toHaveValue('Landing page');
    await page.mouse.click(cart.x, cart.y);
    await expect(nodeLabelInput(page)).toHaveValue('Cart');
    await page.mouse.click((article.x + cart.x) / 2, article.y);
    await expect(panelTitle(page)).toHaveText(['Edge']);
  };
  await check();
  const sidebarImages = await templates(page).evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));
  expect((await saved(page)).nodes.map((node) => node.img)).toEqual([sidebarImages[ARTICLE], sidebarImages[CART]]);

  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(await saved(page)).toMatchObject(before);
  await check();
});

test('opening a file over a diagram asks first, and Cancel keeps the diagram', async ({ page }) => {
  await openEditor(page);
  const at = await onCanvas(page, 300, 300);
  await dropTemplate(page, ARTICLE, at);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  const before = await saved(page);

  await openFile(page, jsonFile('checkout.json', loneCheckout));
  await expect(confirmDialog(page)).toContainText('Replace the current diagram?');
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await page.mouse.click(at.x, at.y);
  await expect(nodeLabelInput(page)).toHaveValue('Article');

  await openFile(page, jsonFile('checkout.json', loneCheckout));
  await confirmDialog(page).getByRole('button', { name: 'Replace' }).click();
  await expect(toast(page)).toHaveText('Opened checkout.json');
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).nodes).toMatchObject([{ id: 'c0ffee01', label: 'Checkout' }]);

  // The old node is gone, the new one is on the canvas, and undo can't bring back the old diagram.
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Canvas']);
  const checkout = await onCanvas(page, 500, 450);
  await page.mouse.click(checkout.x, checkout.y);
  await expect(nodeLabelInput(page)).toHaveValue('Checkout');
  await expect(command(page, 'undo')).toHaveClass(/disable/);
});

test('a file that is not a Wireflow diagram shows an error and leaves the canvas alone', async ({ page }) => {
  await openEditor(page);
  const at = await onCanvas(page, 300, 300);
  await dropTemplate(page, CART, at);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  const before = await saved(page);

  await openFile(page, jsonFile('notes.json', 'just some notes'));
  await expect(toast(page)).toHaveText("Couldn't open notes.json. It isn't a JSON file.");

  await openFile(page, jsonFile('package.json', { name: 'wireflow', version: '0.0.4' }));
  await expect(toast(page).last()).toHaveText("Couldn't open package.json. It doesn't contain a Wireflow diagram.");

  await openFile(page, jsonFile('future.json', { ...loneCheckout, version: 2 }));
  await expect(toast(page).last()).toHaveText("Couldn't open future.json. It was saved by a newer version of Wireflow.");

  await expect(confirmDialog(page)).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await page.mouse.click(at.x, at.y);
  await expect(panelTitle(page)).toHaveText(['Node']);
  await expect(nodeLabelInput(page)).toHaveValue('Cart');
});
