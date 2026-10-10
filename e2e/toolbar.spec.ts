import type { Page } from "@playwright/test";
import { card, centre, drag, expect, openEditor, saved, seed, test } from "./fixtures";

// The earlier editor's toolbar (gg-editor's 14 commands) and shortcuts, next to
// production's own buttons.
const node = (id: string, label: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg", label, headerText: label, showHeader: true },
});
const two = (overlap = false) => ({
  nodes: [node("a", "Article", 0, 0), node("b", "Article", overlap ? 120 : 400, overlap ? 60 : 0)],
  edges: [{ id: "ab", source: "a", target: "b", markerEnd: { type: "arrowclosed" } }],
});
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Diagram" });
const tool = (page: Page, name: string) => toolbar(page).getByRole("button", { name, exact: true });
const zoom = (page: Page) =>
  page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
const selected = (page: Page) => page.locator(".react-flow__node.selected");
const header = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"] .flow-node-header`);

async function open(page: Page, diagram = two()) {
  await seed(page, diagram);
  await openEditor(page);
}

test("the toolbar has the earlier editor's commands as well as production's", async ({ page }) => {
  await open(page);
  const names = await toolbar(page)
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
  expect(names).toEqual([
    "Undo",
    "Redo",
    "Copy",
    "Paste",
    "Delete",
    "Zoom out",
    "Zoom in",
    "Fit view",
    "Actual size",
    "To back",
    "To front",
    "Multi-select",
    "Group",
    "Ungroup",
    "Open file",
    "Export JSON",
    "Export image",
    "Clear canvas",
  ]);
  // Commands that need a selection, or something copied, wait for one.
  for (const name of ["Copy", "Paste", "Delete", "To back", "To front", "Group", "Ungroup"]) {
    await expect(tool(page, name)).toBeDisabled();
  }
});

test("Copy, Paste and Delete buttons work on the selection, each paste and delete one undo step", async ({ page }) => {
  await open(page);
  await card(page, "Article").first().locator("img").click();
  await card(page, "Article").last().locator("img").click({ modifiers: ["ControlOrMeta"] });
  await tool(page, "Copy").click();
  await tool(page, "Paste").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  // The connection between the copied cards comes along (#70).
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(selected(page)).toHaveCount(2);
  await tool(page, "Delete").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await tool(page, "Undo").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
});

test("Actual size shows the diagram at 100 %; Ctrl + =, Ctrl + - and Ctrl + 0 zoom as the shortcuts panel says", async ({
  page,
}) => {
  await open(page);
  await tool(page, "Zoom in").click();
  await tool(page, "Zoom in").click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(1.2);
  await tool(page, "Actual size").click();
  await expect.poll(() => zoom(page)).toBeCloseTo(1, 2);
  await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+Equal");
  await expect.poll(() => zoom(page)).toBeGreaterThan(1.1);
  await page.keyboard.press("Control+0");
  await expect.poll(() => zoom(page)).toBeCloseTo(1, 2);
  await page.keyboard.press("Control+Minus");
  await expect.poll(() => zoom(page)).toBeLessThan(0.9);
});

test("To front and To back change which of two overlapping cards is on top, as undo steps", async ({ page }) => {
  await open(page, two(true));
  const a = page.locator('.react-flow__node[data-id="a"]');
  const b = page.locator('.react-flow__node[data-id="b"]');
  // A point where the two cards overlap (b's top-left corner area).
  await expect(b.locator("img")).toBeVisible();
  const onTop = async () => {
    const bb = (await b.boundingBox())!;
    const point = { x: bb.x + 20, y: bb.y + 60 };
    return page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest(".react-flow__node")?.getAttribute("data-id"),
      point
    );
  };
  await expect.poll(onTop).toBe("b");
  await a.locator(".flow-node-header").click({ position: { x: 20, y: 10 } });
  await tool(page, "To front").click();
  await page.keyboard.press("Escape");
  await expect(selected(page)).toHaveCount(0);
  await expect.poll(onTop).toBe("a");
  expect((await saved(page))!.nodes.map((n) => n.id)).toEqual(["b", "a"]);
  await a.locator(".flow-node-header").click({ position: { x: 20, y: 10 } });
  await tool(page, "To back").click();
  await page.keyboard.press("Escape");
  await expect.poll(onTop).toBe("b");
  await page.keyboard.press("Control+z");
  await expect.poll(onTop).toBe("a");
});

test("Multi-select mode selects with a box; Escape leaves it and clears the selection (#77, #82)", async ({ page }) => {
  await open(page);
  const pane = page.locator(".react-flow__pane");
  const viewportX = () =>
    page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);

  await tool(page, "Multi-select").click();
  await expect(tool(page, "Multi-select")).toHaveAttribute("aria-pressed", "true");
  const a = (await card(page, "Article").first().boundingBox())!;
  const b = (await card(page, "Article").last().boundingBox())!;
  const before = await viewportX();
  await drag(page, { x: a.x - 30, y: a.y - 30 }, { x: b.x + b.width + 30, y: b.y + b.height + 30 });
  await expect(selected(page)).toHaveCount(2);
  // (The box was drawn, not a pan: both cards are selected.)

  await page.keyboard.press("Escape");
  await expect(tool(page, "Multi-select")).toHaveAttribute("aria-pressed", "false");
  await expect(selected(page)).toHaveCount(0);
  // Out of the mode, the same drag pans the canvas again.
  const box = (await pane.boundingBox())!;
  await drag(page, { x: box.x + 40, y: box.y + box.height - 120 }, { x: box.x + 140, y: box.y + box.height - 120 });
  await expect.poll(viewportX).toBeGreaterThan(before + 50);
  await expect(selected(page)).toHaveCount(0);
});

test("Ctrl + A selects everything and Escape selects nothing (#82)", async ({ page }) => {
  await open(page);
  await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+a");
  await expect(selected(page)).toHaveCount(2);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(selected(page)).toHaveCount(0);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(0);
});

test("a Shift key whose release the page never saw doesn't leave the canvas selecting", async ({ page }) => {
  await open(page);
  const viewportX = () =>
    page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
  // Shift goes down, then the window loses focus before it comes up.
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true, bubbles: true }));
    window.dispatchEvent(new Event("blur"));
  });
  const box = (await page.locator(".react-flow__pane").boundingBox())!;
  const before = await viewportX();
  await drag(page, { x: box.x + 40, y: box.y + box.height - 120 }, { x: box.x + 140, y: box.y + box.height - 120 });
  await expect.poll(viewportX).toBeGreaterThan(before + 50);
  await expect(page.locator(".react-flow__selection")).toHaveCount(0);
});

test("Ctrl + H hides and Ctrl + K shows the header; the Card panel renames it and toggles it", async ({ page }) => {
  await open(page);
  const a = page.locator('.react-flow__node[data-id="a"]');
  await a.locator("img").click();
  await page.keyboard.press("Control+h");
  await expect(header(page, "a")).toHaveCount(0);
  await page.keyboard.press("Control+h");
  await expect(header(page, "a")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(header(page, "a")).toBeVisible();
  // The other card was never touched.
  await expect(header(page, "b")).toBeVisible();

  const panel = page.getByRole("complementary", { name: "Card" });
  await expect(panel).toBeVisible();
  await expect(page.getByText("Keyboard shortcuts")).toBeHidden();
  await panel.getByRole("textbox", { name: "Header" }).fill("Landing");
  await page.keyboard.press("Enter");
  await expect(header(page, "a")).toContainText("Landing");
  await panel.getByRole("checkbox", { name: "Show header" }).uncheck();
  await expect(header(page, "a")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.nodes[0].data).toMatchObject({ headerText: "Landing", showHeader: false });
  await page.keyboard.press("Control+z");
  await expect(header(page, "a")).toContainText("Landing");
  await expect(panel.getByRole("checkbox", { name: "Show header" })).toBeChecked();
});

test.describe("on a narrower screen", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("the earlier editor's commands are under More tools", async ({ page }) => {
    await open(page, two(true));
    await expect(tool(page, "To front")).toBeHidden();
    await page.locator('.react-flow__node[data-id="a"] .flow-node-header').click({ position: { x: 20, y: 10 } });
    await tool(page, "More tools").click();
    const menu = page.getByRole("menu", { name: "More tools" });
    for (const name of ["Copy", "Paste", "Delete", "Actual size", "To back", "To front", "Group", "Ungroup", "Export JPG image"]) {
      await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("menuitemcheckbox", { name: /Multi-select/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Paste" })).toHaveAttribute("aria-disabled", "true");
    await menu.getByRole("menuitem", { name: "To front" }).click();
    await expect.poll(async () => (await saved(page))!.nodes.map((n) => n.id)).toEqual(["b", "a"]);
    expect(await centre(card(page, "Article").first())).toBeTruthy();
  });
});
