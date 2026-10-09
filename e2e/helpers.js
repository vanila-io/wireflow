import { test as base, expect } from '@playwright/test';

export { expect };

// Every test fails if the app logs a console error or throws an uncaught error.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await runTest(page);
    expect(errors, 'console errors / uncaught page errors').toEqual([]);
  },
});

// The diagram the app autosaves to localStorage on every change.
export const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('data')));

export const templates = (page) => page.locator('.sidebar img');
export const panelTitle = (page) => page.locator('.details .ant-card-head-title');
export const nodeLabelInput = (page) => page.locator('.details input[name=title]');
export const command = (page, name) => page.locator(`.toolbar .command[data-command="${name}"]`);

export async function openEditor(page) {
  await page.goto('/');
  await expect(page.locator('#canvas_1')).toBeVisible();
}

// Page coordinates of a point given in canvas coordinates (the canvas opens at zoom 1).
export async function onCanvas(page, x, y) {
  const box = await page.locator('#canvas_1').boundingBox();
  return { x: box.x + x, y: box.y + y };
}

// Drag the sidebar template at `index` and drop it so the node is centred on `at`.
export async function dropTemplate(page, index, at) {
  const item = templates(page).nth(index);
  await item.scrollIntoViewIfNeeded();
  const box = await item.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y, { steps: 15 });
  await page.mouse.up();
}

// Templates are 96 px wide, so a node's left and right anchors are 48 px from its centre.
export const leftAnchor = (at) => ({ x: at.x - 48, y: at.y });
export const rightAnchor = (at) => ({ x: at.x + 48, y: at.y });

// Press at `from`, move to `to` and let go. G6 hit-tests on every mousemove, so move in small steps.
export async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y, { steps: 10 });
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 40 });
  await page.mouse.up();
}

// G6 shows a node's anchors only while the node is hovered, so hover `from` first.
export async function connect(page, from, to) {
  await page.mouse.move(from.x, from.y, { steps: 5 });
  await drag(page, rightAnchor(from), leftAnchor(to));
}
