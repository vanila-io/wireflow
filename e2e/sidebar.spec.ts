import type { Page } from "@playwright/test";
import { expect, openEditor, SAMPLE, saved, seed, test } from "./fixtures";

const sidebar = (page: Page) => page.getByRole("complementary", { name: "Screen templates" });
const tiles = (page: Page) => sidebar(page).locator('button[draggable="true"]');

// #108: the editor searched only the picked category.
test("search looks in every category, whatever category is picked", async ({ page }) => {
  await openEditor(page);
  const chips = sidebar(page).getByRole("group", { name: "Categories" });
  await chips.getByRole("button", { name: "Blog" }).click();
  await expect(chips.getByRole("button", { name: "Blog" })).toHaveAttribute("aria-pressed", "true");
  await expect(tiles(page).first().getByRole("img")).toHaveAttribute("alt", "Blog");

  const search = sidebar(page).getByRole("textbox", { name: "Search graphics in all categories" });
  await search.fill("cart");
  const names = await tiles(page)
    .getByRole("img")
    .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /cart/i.test(n!))).toBe(true);
  await expect(chips.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sidebar(page).getByRole("status")).toHaveText(
    `${names.length} ${names.length === 1 ? "graphic matches" : "graphics match"}`
  );

  // A category name matches too.
  await search.fill("sign in");
  expect(await tiles(page).count()).toBe(6);
  await search.fill("zzz");
  await expect(sidebar(page).getByText("No graphics match “zzz”")).toBeVisible();

  // Picking a category ends the search.
  await chips.getByRole("button", { name: "Gallery" }).click();
  await expect(search).toHaveValue("");
  await expect(chips.getByRole("button", { name: "Gallery" })).toHaveAttribute("aria-pressed", "true");
});

test("a new search starts at the top of the list", async ({ page }) => {
  await openEditor(page);
  const list = tiles(page).first().locator("..");
  await list.evaluate((el) => el.scrollTo({ top: 2000 }));
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await sidebar(page).getByRole("textbox").fill("a");
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
});

test("a template drags from anywhere on its tile, and Enter adds one from the keyboard", async ({ page }) => {
  await openEditor(page);
  // Press in the tile's padding, not on the image.
  await tiles(page)
    .nth(3)
    .dragTo(page.locator(".react-flow__pane"), { sourcePosition: { x: 3, y: 3 }, targetPosition: { x: 300, y: 200 } });
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  // And on the image.
  await tiles(page)
    .nth(4)
    .getByRole("img")
    .dragTo(page.locator(".react-flow__pane"), { targetPosition: { x: 600, y: 300 } });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await tiles(page).nth(5).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(3);
});

// The editor offset every new card by up to 1040px to stagger clicked adds,
// so a dropped template could land far from where it was dropped.
test("a dropped template lands where it was dropped, however many cards there are", async ({ page }) => {
  await seed(page, SAMPLE);
  await openEditor(page);
  const at = { x: 500, y: 650 };
  // A mouse drag in steps rather than dragTo: under load, dragTo now and then
  // dropped nothing (about 1 run in 30), which a drag in steps hasn't done.
  const tile = page.locator('aside button[draggable="true"]').nth(20);
  await tile.scrollIntoViewIfNeeded();
  await tile.hover();
  await page.mouse.down();
  await page.mouse.move(at.x, at.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  // The new card is drawn last.
  const box = (await page.locator(".react-flow__node").last().boundingBox())!;
  expect(at.x).toBeGreaterThan(box.x);
  expect(at.x).toBeLessThan(box.x + box.width);
  expect(at.y).toBeGreaterThan(box.y);
  expect(at.y).toBeLessThan(box.y + box.height);
});
