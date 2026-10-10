import type { Page } from "@playwright/test";
import { card, centre, drag, expect, openEditor, saved, seed, test, tiles } from "./fixtures";

// Groups, as in the earlier gg-editor app: a labelled frame around cards that
// moves with them, made from a selection and undone in one step.
const node = (id: string, graphicId: string, src: string, label: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId, src, label, headerText: label, showHeader: true },
});
const DIAGRAM = {
  nodes: [
    node("art", "article-article-1", "/graphics/article/article-1.svg", "Article", 0, 0),
    node("cart", "e-commerce-cart", "/graphics/e-commerce/cart.svg", "Cart", 320, 0),
    node("404", "misc-404", "/graphics/misc/404.svg", "Not Found 404", 0, 520),
  ],
  edges: [{ id: "e1", source: "art", target: "cart", markerEnd: { type: "arrowclosed" } }],
};

const frame = (page: Page) => page.locator(".react-flow__node-group");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function open(page: Page) {
  await seed(page, DIAGRAM);
  await openEditor(page);
}

async function groupArticleAndCart(page: Page) {
  await card(page, "Article").locator("img").click();
  await card(page, "Cart").locator("img").click({ modifiers: ["ControlOrMeta"] });
  await button(page, "Group").click();
  await expect(frame(page)).toHaveCount(1);
}

async function inside(page: Page, label: string) {
  const f = (await frame(page).boundingBox())!;
  const b = (await card(page, label).boundingBox())!;
  return b.x > f.x && b.y > f.y && b.x + b.width < f.x + f.width && b.y + b.height < f.y + f.height;
}

test("selected cards become a group that wraps them, is renamed and undone in one step each, and survives a reload", async ({
  page,
}) => {
  await open(page);
  await expect(button(page, "Group")).toBeDisabled();
  await expect(button(page, "Ungroup")).toBeDisabled();
  await groupArticleAndCart(page);
  await expect(frame(page).getByRole("button", { name: "Group" })).toBeVisible();
  expect(await inside(page, "Article")).toBe(true);
  expect(await inside(page, "Cart")).toBe(true);
  expect(await inside(page, "Not Found 404")).toBe(false);
  let data = (await saved(page))!;
  const id = data.nodes.find((n) => n.type === "group")!.id;
  expect(data.nodes.filter((n) => n.parentId === id).map((n) => n.id)).toEqual(["art", "cart"]);

  // The new group is selected: its panel renames it.
  const panel = page.getByRole("complementary", { name: "Group" });
  await expect(panel).toBeVisible();
  await panel.getByRole("textbox", { name: "Label" }).fill("Checkout");
  await page.keyboard.press("Enter");
  await expect(frame(page).getByRole("button", { name: "Checkout" })).toBeVisible();
  // Double-clicking the label renames it too.
  await frame(page).getByRole("button", { name: "Checkout" }).dblclick();
  await page.getByRole("textbox", { name: "Group label" }).fill("Pay");
  await page.keyboard.press("Enter");
  await expect(frame(page).getByRole("button", { name: "Pay" })).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Label" })).toHaveValue("Pay");

  await page.reload();
  await expect(frame(page).getByRole("button", { name: "Pay" })).toBeVisible();
  expect(await inside(page, "Cart")).toBe(true);

  // Undo: the two renames, then the group; the cards are back where they were.
  await page.keyboard.press("Control+z");
  await expect(frame(page).getByRole("button", { name: "Checkout" })).toBeVisible();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await expect(frame(page)).toHaveCount(0);
  data = (await saved(page))!;
  expect(data.nodes.map((n) => n.position)).toEqual(DIAGRAM.nodes.map((n) => n.position));
  await page.keyboard.press("Control+y");
  await expect(frame(page)).toHaveCount(1);
});

test("dragging the frame moves the cards in it; Ungroup keeps the cards; Delete removes the group with its cards", async ({
  page,
}) => {
  await open(page);
  await groupArticleAndCart(page);
  const before = await centre(card(page, "Cart"));
  const f = (await frame(page).boundingBox())!;
  // Grab the frame by its title band.
  await drag(page, { x: f.x + f.width / 2, y: f.y + 12 }, { x: f.x + f.width / 2 + 100, y: f.y + 112 });
  const after = await centre(card(page, "Cart"));
  // React Flow starts the drag a step after the pointer moves, so allow a few pixels.
  expect(after.x - before.x).toBeGreaterThan(90);
  expect(after.x - before.x).toBeLessThanOrEqual(100);
  expect(after.y - before.y).toBeGreaterThan(90);
  expect(after.y - before.y).toBeLessThanOrEqual(100);
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.type === "group")!.position.x).toBeGreaterThan(0);

  // Ungroup (the frame is still selected): the cards stay, where they are.
  await button(page, "Ungroup").click();
  await expect(frame(page)).toHaveCount(0);
  await expect(page.locator(".react-flow__node-flow")).toHaveCount(3);
  const ungrouped = await centre(card(page, "Cart"));
  expect(ungrouped.x).toBeCloseTo(after.x, 0);
  expect((await saved(page))!.nodes.every((n) => n.parentId === undefined)).toBe(true);

  // Group again, then Delete with the frame selected removes it and its cards.
  await page.keyboard.press("Control+z");
  await expect(frame(page)).toHaveCount(1);
  await frame(page).click({ position: { x: 6, y: 60 } });
  await page.keyboard.press("Delete");
  await expect(frame(page)).toHaveCount(0);
  await expect(page.locator(".react-flow__node-flow")).toHaveCount(1);
  await expect(card(page, "Not Found 404")).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node-flow")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});

test("a template dropped onto a group joins it (#81), and so does a card dragged onto the frame", async ({ page }) => {
  await open(page);
  await groupArticleAndCart(page);
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });

  // A new card from the sidebar, dropped onto the frame.
  const f = (await frame(page).boundingBox())!;
  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  await tiles(page).first().dragTo(page.locator(".react-flow__pane"), {
    targetPosition: { x: f.x + f.width / 2 - pane.x, y: f.y + f.height / 2 - pane.y },
  });
  await expect(page.locator(".react-flow__node-flow")).toHaveCount(4);
  const group = (await saved(page))!.nodes.find((n) => n.type === "group")!.id;
  await expect.poll(async () => (await saved(page))!.nodes.filter((n) => n.parentId === group).length).toBe(3);

  // An existing card dragged onto the frame: the frame lights up, and the card joins.
  const from = await centre(card(page, "Not Found 404").locator("img"));
  const g = (await frame(page).boundingBox())!;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect(page.locator(".flow-group.drop-target")).toHaveCount(0);
  await page.mouse.move(g.x + g.width - 60, g.y + g.height / 2, { steps: 25 });
  await expect(page.locator(".flow-group.drop-target")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".flow-group.drop-target")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === "404")!.parentId).toBe(group);
  expect(await inside(page, "Not Found 404")).toBe(true);

  // Dragged out again, it leaves the group.
  const now = await centre(card(page, "Not Found 404").locator("img"));
  const g2 = (await frame(page).boundingBox())!;
  await drag(page, now, { x: now.x, y: g2.y + g2.height + 200 });
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === "404")!.parentId).toBeUndefined();
});

test("groups nest: a group and a card make an outer group, and Ctrl+G / Ctrl+Shift+G work from the keyboard", async ({
  page,
}) => {
  await open(page);
  await groupArticleAndCart(page);
  // The new group is selected; add the third card to the selection.
  await card(page, "Not Found 404").locator("img").click({ modifiers: ["ControlOrMeta"] });
  await page.keyboard.press("Control+g");
  await expect(frame(page)).toHaveCount(2);
  const data = (await saved(page))!;
  const groups = data.nodes.filter((n) => n.type === "group");
  const outer = groups.find((n) => n.parentId === undefined)!;
  const inner = groups.find((n) => n.parentId === outer.id)!;
  expect(inner).toBeTruthy();
  expect(data.nodes.find((n) => n.id === "404")!.parentId).toBe(outer.id);
  // The outer group is selected; Ctrl+Shift+G dissolves it and keeps the inner one.
  await page.keyboard.press("Control+Shift+g");
  await expect(frame(page)).toHaveCount(1);
  expect((await saved(page))!.nodes.find((n) => n.id === inner.id)!.parentId).toBeUndefined();
});
