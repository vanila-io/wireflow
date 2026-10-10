import type { Page } from "@playwright/test";
import { card, expect, openEditor, seed, test } from "./fixtures";

// #82: a multi-selection shows "N selected · Clear", which drops it in one click
// or tap. Esc and a click on empty canvas still clear it too.
const node = (id: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg", label: "Article", headerText: id, showHeader: true },
});
const DIAGRAM = {
  nodes: [node("a", 0, 0), node("b", 400, 0), node("c", 0, 400)],
  edges: [{ id: "ab", source: "a", target: "b", markerEnd: { type: "arrowclosed" } }],
};

const chip = (page: Page) => page.getByTestId("selection-chip");
const clear = (page: Page) => chip(page).getByRole("button", { name: "Clear selection" });
const selected = (page: Page) => page.locator(".react-flow__node.selected, .react-flow__edge.selected");
const status = (page: Page) => page.getByRole("status").filter({ hasText: /items selected/ });

test("two or more selected items show a chip with the count that clears them, by mouse or keyboard", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await expect(chip(page)).toHaveCount(0);

  // One item: no chip (its own panel shows).
  await card(page, "Article").first().locator("img").click();
  await expect(selected(page)).toHaveCount(1);
  await expect(chip(page)).toHaveCount(0);
  // A selected card shows it: the blue outline (editor.css), the others none.
  const outline = (i: number) =>
    card(page, "Article").nth(i).locator(".flow-node").evaluate((el) => getComputedStyle(el).outlineColor);
  await expect.poll(() => outline(0)).toBe("rgb(67, 83, 255)");
  expect(await outline(1)).toBe("rgba(0, 0, 0, 0)");

  await card(page, "Article").nth(1).locator("img").click({ modifiers: ["ControlOrMeta"] });
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toContainText("2 selected");
  // Announced politely, from a status line that was already on the page.
  await expect(status(page)).toHaveText("2 items selected");

  await page.keyboard.press("Control+a");
  await expect(chip(page)).toContainText("4 selected");
  await expect(status(page)).toHaveText("4 items selected");

  await clear(page).click();
  await expect(selected(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: /items selected/ })).toHaveCount(0);

  // Keyboard: Tab reaches the button, Enter clears, and focus stays in the canvas.
  await page.keyboard.press("Control+a");
  await clear(page).focus();
  await expect(clear(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(selected(page)).toHaveCount(0);
  const focusInCanvas = await page.evaluate(() => !!document.activeElement?.querySelector(".react-flow"));
  expect(focusInCanvas).toBe(true);
});

test("the chip can be reached with Tab", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+a");
  await expect(chip(page)).toBeVisible();
  for (let i = 0; i < 60 && !(await clear(page).evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(clear(page)).toBeFocused();
});

test("Esc and a click on empty canvas still clear a multi-selection, and the chip goes with it", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+a");
  await expect(chip(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chip(page)).toHaveCount(0);

  await page.keyboard.press("Control+a");
  await expect(chip(page)).toBeVisible();
  await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
  await expect(selected(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the chip fits on the screen above the toolbar, and a tap clears the selection", async ({ page }) => {
    await seed(page, DIAGRAM);
    await openEditor(page);
    // Selecting several items by touch is a box selection (Multi-select, under
    // More tools); the shortcut gets the same selection more simply.
    await page.locator(".react-flow__pane").tap({ position: { x: 10, y: 10 } });
    await page.keyboard.press("Control+a");
    await expect(chip(page)).toBeVisible();
    const c = (await chip(page).boundingBox())!;
    const t = (await page.getByRole("toolbar", { name: "Diagram" }).boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
    expect(c.y + c.height).toBeLessThanOrEqual(t.y);
    await clear(page).tap();
    await expect(selected(page)).toHaveCount(0);
  });
});
