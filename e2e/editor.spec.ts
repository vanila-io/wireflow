import { card, centre, drag, expect, openEditor, raw, SAMPLE, saved, seed, STORAGE_KEY, test, tiles } from "./fixtures";

const cartOf = async (page: Parameters<typeof saved>[0]) =>
  (await saved(page))!.nodes.find((n) => n.data.graphicId === "e-commerce-cart")!;
const articleOf = async (page: Parameters<typeof saved>[0]) =>
  (await saved(page))!.nodes.find((n) => n.data.graphicId === "article-article-1")!;

test("a diagram saved before this change opens unchanged, and opening it writes nothing", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(card(page, "Cart").locator(".flow-node-header")).toHaveText("My cart");
  await expect(page.getByText("2 cards · 1 connections")).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.waitForTimeout(800);
  expect(await raw(page)).toBe(JSON.stringify(SAMPLE));
});

test("the ?card= link from the landing page starts a diagram with that card", async ({ page }) => {
  await openEditor(page, "?card=e-commerce-cart");
  await expect(card(page, "Cart")).toBeVisible();
  await expect.poll(async () => (await saved(page))?.nodes.map((n) => n.data.graphicId)).toEqual(["e-commerce-cart"]);
});

test("moving a card is one undo step, and undo brings the card back", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const start = await centre(card(page, "Article").locator("img"));
  await drag(page, start, { x: start.x + 150, y: start.y + 40 });
  await expect.poll(async () => (await articleOf(page)).position).not.toEqual({ x: 180, y: 50 });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await articleOf(page)).position).toEqual({ x: 180, y: 50 });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("a connection dropped on empty canvas creates nothing; dropped on a card it connects", async ({ page }) => {
  await seed(page, { nodes: SAMPLE.nodes, edges: [] });
  await openEditor(page);
  const source = await centre(card(page, "Article").locator(".react-flow__handle-bottom"));
  await drag(page, source, { x: source.x + 300, y: source.y + 80 });
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  expect(await raw(page)).toBe(JSON.stringify({ nodes: SAMPLE.nodes, edges: [] }));

  const target = await centre(card(page, "Cart").locator(".react-flow__handle-top"));
  await drag(page, source, target);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect.poll(async () => (await saved(page))!.edges.length).toBe(1);
});

test("edges saved with a missing end are removed on load, with a message, and the original is kept", async ({
  page,
}) => {
  await seed(page, {
    ...SAMPLE,
    edges: [
      ...SAMPLE.edges,
      { id: "loose", source: SAMPLE.nodes[0].id, target: { x: 500, y: 520 } },
      { id: "gone", source: SAMPLE.nodes[0].id, target: "deleted" },
    ],
  });
  await openEditor(page);
  const removed = page.getByRole("status").filter({ hasText: "Removed 2 connections that didn't connect two cards." });
  await expect(removed).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.getByRole("status").filter({ hasText: "The diagram as it was saved is kept" })).toBeVisible();
  expect(
    JSON.parse((await page.evaluate((k) => localStorage.getItem(`${k}.backup`), STORAGE_KEY))!).edges
  ).toHaveLength(3);

  // The first save leaves the loose edges out.
  await card(page, "Cart").locator("img").click();
  await page.keyboard.press("h");
  await expect.poll(async () => (await saved(page))!.edges.map((e) => e.id)).toEqual([SAMPLE.edges[0].id]);

  await removed.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Removed 2 connections")).toHaveCount(0);
});

test("deleting a card removes its connections, and one undo brings both back", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  await card(page, "Cart").locator("img").click();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.edges.length).toBe(0);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect.poll(async () => (await saved(page))!.nodes.length).toBe(2);
});

test("H hides a header and undo shows it again; Escape cancels a header edit", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const cart = card(page, "Cart");
  await cart.locator("img").click();
  await page.keyboard.press("h");
  await expect(cart.locator(".flow-node-header")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(cart.locator(".flow-node-header")).toHaveText("My cart");

  await cart.locator(".flow-node-header button").dblclick();
  const input = page.getByRole("textbox", { name: "Card header" });
  await input.fill("Shopping cart");
  // Typing an H in the header is not the shortcut.
  await expect(cart.locator(".flow-node-header")).toHaveCount(1);
  await input.press("Enter");
  await expect(cart.locator(".flow-node-header")).toHaveText("Shopping cart");
  await expect.poll(async () => (await cartOf(page)).data.headerText).toBe("Shopping cart");

  await cart.locator(".flow-node-header button").dblclick();
  await page.getByRole("textbox", { name: "Card header" }).fill("Never mind");
  await page.keyboard.press("Escape");
  await expect(cart.locator(".flow-node-header")).toHaveText("Shopping cart");
  await page.waitForTimeout(800);
  expect((await cartOf(page)).data.headerText).toBe("Shopping cart");
});

test("unreadable saved data is kept in a backup key, not overwritten", async ({ page }) => {
  await seed(page, '{"nodes": [broken');
  await openEditor(page);
  await expect(page.getByRole("alert").filter({ hasText: "Your saved diagram couldn't be read" })).toBeVisible();
  await tiles(page).first().click();
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(`${key}.backup`), STORAGE_KEY)).toBe('{"nodes": [broken');
});

test("a change in another tab shows here, and this tab's next save keeps it", async ({ page, context }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const other = await context.newPage();
  await openEditor(other);
  await tiles(other).nth(40).click();
  await expect(other.locator(".react-flow__node")).toHaveCount(3);

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(
    page.getByRole("status").filter({ hasText: "Updated with the changes made in another tab." })
  ).toBeVisible();
  await card(page, "Cart").locator("img").click();
  await page.keyboard.press("h");
  await expect.poll(async () => (await cartOf(page)).data.showHeader).toBe(false);
  expect((await saved(page))!.nodes).toHaveLength(3);
});

test("a diagram from a newer version is shown but never overwritten", async ({ page }) => {
  const newer = JSON.stringify({ ...SAMPLE, version: 99 });
  await seed(page, newer);
  await openEditor(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByRole("alert").filter({ hasText: "newer version of Wireflow" })).toBeVisible();
  await card(page, "Cart").locator("img").click();
  await page.keyboard.press("h");
  await expect(page.getByText("Not saved in this browser")).toBeVisible();
  expect(await raw(page)).toBe(newer);
});
