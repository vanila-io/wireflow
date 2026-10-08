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

// Templates are 96 px wide. G6 shows anchors only while the node is hovered and
// hit-tests on every mousemove, so approach the anchor and drag in small steps.
export async function connect(page, from, to) {
  await page.mouse.move(from.x, from.y, { steps: 5 });
  await page.mouse.move(from.x + 48, from.y, { steps: 10 }); // right anchor of `from`
  await page.mouse.down();
  await page.mouse.move(to.x - 48, to.y, { steps: 40 }); // left anchor of `to`
  await page.mouse.up();
}
