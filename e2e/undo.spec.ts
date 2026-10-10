import { card, centre, drag, expect, openEditor, SAMPLE, saved, seed, test } from "./fixtures";

const articleAt = async (page: Parameters<typeof saved>[0]) =>
  (await saved(page))!.nodes.find((n) => n.data.graphicId === "article-article-1")!.position;

test("undo and redo are saved, and the undo history survives a reload of the tab", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const start = await centre(card(page, "Article").locator("img"));
  await drag(page, start, { x: start.x + 150, y: start.y + 40 });
  await expect.poll(() => articleAt(page)).not.toEqual({ x: 180, y: 50 });
  const moved = await articleAt(page);

  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => articleAt(page)).toEqual({ x: 180, y: 50 });

  // The undone state is what reloads, and redo is still there after the reload.
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  expect(await articleAt(page)).toEqual({ x: 180, y: 50 });
  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => articleAt(page)).toEqual(moved);
});

test("a paste is one undo step", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  // Select both cards (the edge between them comes along).
  await card(page, "Article").locator("img").click();
  await card(page, "Cart")
    .locator("img")
    .click({ modifiers: ["ControlOrMeta"] });
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect.poll(async () => (await saved(page))!.nodes.length).toBe(4);

  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect.poll(async () => (await saved(page))!.nodes.length).toBe(2);
});
