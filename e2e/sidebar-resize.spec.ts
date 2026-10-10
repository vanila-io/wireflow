import type { Page } from "@playwright/test";
import { expect, openEditor, test } from "./fixtures";

// #63: the templates panel resizes from its right edge (mouse, touch or keys),
// and its thumbnails fill as many columns as fit.
const sidebar = (page: Page) => page.getByRole("complementary", { name: "Screen templates" });
const handle = (page: Page) => page.getByRole("separator", { name: "Resize the templates panel" });
const width = async (page: Page) => Math.round((await sidebar(page).boundingBox())!.width);
// Columns in the first row of tiles.
const columns = (page: Page) =>
  sidebar(page)
    .locator("#graphics-panel-list > button")
    .evaluateAll((tiles) => {
      const top = tiles[0].getBoundingClientRect().top;
      return tiles.filter((t) => Math.abs(t.getBoundingClientRect().top - top) < 1).length;
    });

test("dragging the edge resizes the panel within bounds, and the width is remembered", async ({ page }) => {
  await openEditor(page);
  expect(await width(page)).toBe(256);
  expect(await columns(page)).toBe(2);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "256");

  const h = (await handle(page).boundingBox())!;
  const y = h.y + 300;
  await page.mouse.move(h.x + h.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 150, y, { steps: 8 });
  await page.mouse.up();
  expect(await width(page)).toBe(406);
  expect(await columns(page)).toBe(3);
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "406");

  // Far past the maximum: 480 px.
  const h2 = (await handle(page).boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(h2.x + 600, y, { steps: 8 });
  await page.mouse.up();
  expect(await width(page)).toBe(480);
  expect(await columns(page)).toBe(4);

  await page.reload();
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  expect(await width(page)).toBe(480);

  // Double-click resets it.
  await handle(page).dblclick();
  expect(await width(page)).toBe(256);
});

test("the arrow keys, Home and End resize it from the keyboard", async ({ page }) => {
  await openEditor(page);
  await handle(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "272");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "240");
  await expect(handle(page)).toHaveAttribute("aria-valuetext", "240 pixels wide");
  await page.keyboard.press("Home");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "216");
  expect(await width(page)).toBe(216);
  // Two smaller columns at the narrowest.
  expect(await columns(page)).toBe(2);
  await page.keyboard.press("End");
  await expect(handle(page)).toHaveAttribute("aria-valuenow", "480");
  await expect(handle(page)).toHaveAttribute("aria-valuemax", "480");
  // The canvas resizes with it.
  const pane = (await page.locator(".react-flow").boundingBox())!;
  expect(Math.round(pane.x)).toBe(480);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the panel can only shrink, to leave the canvas more room", async ({ page }) => {
    await openEditor(page);
    expect(await width(page)).toBe(256);
    await expect(handle(page)).toHaveAttribute("aria-valuemax", "256");
    await handle(page).focus();
    await page.keyboard.press("End");
    expect(await width(page)).toBe(256);
    await page.keyboard.press("Home");
    expect(await width(page)).toBe(216);
  });
});
