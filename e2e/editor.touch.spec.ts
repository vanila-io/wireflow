// A touch screen (a tablet, see playwright.config.ts) with real touch events (e2e/touch.ts).
import { card, expect, openEditor, saved, seed, test, tiles } from "./fixtures";
import { centre, Finger } from "./touch";

const node = (id: string, graphicId: string, label: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId, src: "", label, headerText: label, showHeader: true },
});
const TWO = {
  nodes: [node("a", "article-article-1", "Article", 0, 0), node("b", "e-commerce-cart", "Cart", 0, 420)],
  edges: [],
};

async function openWith(page: Parameters<typeof seed>[0], value: unknown) {
  await seed(page, value);
  await openEditor(page);
  // Wait for the opening fit and the images.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
}

test("a tap adds a template; a sideways swipe drags one onto the canvas; an up-down swipe scrolls", async ({
  page,
}) => {
  await openEditor(page);
  const finger = await Finger.on(page);

  await finger.tap(await centre(tiles(page).nth(0)));
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  const list = tiles(page).first().locator("..");
  const from = await centre(tiles(page).nth(4));
  await finger.drag(from, { x: from.x, y: from.y - 200 });
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);

  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  const tile = await centre(tiles(page).nth(6));
  await finger.drag(tile, { x: pane.x + pane.width / 2, y: tile.y });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".touch-drag-ghost")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
});

test("a finger moves a card, as one undo step", async ({ page }) => {
  await openWith(page, TWO);
  const finger = await Finger.on(page);
  const from = await centre(card(page, "Article").locator("img"));
  await finger.drag(from, { x: from.x + 40, y: from.y + 60 });
  await expect
    .poll(async () => (await saved(page))?.nodes.find((n) => n.id === "a")!.position)
    .not.toEqual({ x: 0, y: 0 });
  await finger.tap(await centre(page.getByRole("button", { name: "Undo" })));
  await expect.poll(async () => (await saved(page))!.nodes.find((n) => n.id === "a")!.position).toEqual({ x: 0, y: 0 });
});

test("a finger connects two cards from handle to handle, and nothing when released on the canvas", async ({ page }) => {
  await openWith(page, TWO);
  const finger = await Finger.on(page);
  const source = await centre(card(page, "Article").locator(".react-flow__handle-bottom"));
  const target = await centre(card(page, "Cart").locator(".react-flow__handle-top"));

  await finger.drag(source, { x: source.x + 60, y: source.y + 40 });
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);

  await finger.drag(source, target);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect.poll(async () => (await saved(page))?.edges.length).toBe(1);
  expect((await saved(page))!.edges[0]).toMatchObject({ source: "a", target: "b" });
});
