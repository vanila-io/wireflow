import type { Locator, Page } from "@playwright/test";
import { card, expect, openEditor, saved, seed, test } from "./fixtures";

// The templates added for #69 (Mobile: portrait phone screens) and #86 (Flow:
// decisions, emails, wizard steps).
const sidebar = (page: Page) => page.getByRole("complementary", { name: "Screen templates" });
const tiles = (page: Page) => sidebar(page).locator('button[draggable="true"]:has(img)');
const chip = (page: Page, name: string) =>
  sidebar(page).getByRole("group", { name: "Categories" }).getByRole("button", { name, exact: true });
const tile = (page: Page, label: string) => tiles(page).filter({ has: page.getByRole("img", { name: label, exact: true }) });

async function dropOnCanvas(page: Page, from: Locator, at: { x: number; y: number }) {
  await from.scrollIntoViewIfNeeded();
  await from.hover();
  await page.mouse.down();
  await page.mouse.move(at.x, at.y, { steps: 10 });
  await page.mouse.up();
}

const size = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { width: b.width, height: b.height };
};
const loaded = (l: Locator) =>
  l.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);

test("a Mobile template drops in as a portrait card, at the scale of the landscape ones, and stays so after a reload", async ({
  page,
}) => {
  await openEditor(page);
  await chip(page, "Mobile").click();
  await expect(tiles(page)).toHaveCount(15);
  // Portrait thumbnails, at the width the card has next to a landscape one.
  const thumb = tile(page, "Cart").getByRole("img");
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const t = await size(thumb);
  expect(t.height).toBeGreaterThan(t.width * 1.6);
  expect(t.width / (await size(tile(page, "Cart"))).width).toBeLessThan(0.6);

  await dropOnCanvas(page, tile(page, "Cart"), { x: 500, y: 300 });
  await chip(page, "Flow").click();
  await dropOnCanvas(page, tile(page, "Yes / No Choice"), { x: 800, y: 300 });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  const phone = card(page, "Cart");
  const desktop = card(page, "Yes / No Choice");
  await expect.poll(() => loaded(phone)).toBe(true);
  await expect.poll(() => loaded(desktop)).toBe(true);
  const p = await size(phone);
  const d = await size(desktop);
  expect(p.height).toBeGreaterThan(p.width * 1.8);
  expect(d.height).toBeLessThan(d.width);
  // 124 and 220 px wide at any zoom.
  expect(p.width / d.width).toBeCloseTo(124 / 220, 2);

  await expect.poll(async () => (await saved(page))?.nodes.map((n) => n.data.graphicId).sort()).toEqual([
    "flow-yes-no",
    "mobile-cart",
  ]);
  await page.reload();
  await expect.poll(() => loaded(card(page, "Cart"))).toBe(true);
  const after = await size(card(page, "Cart"));
  expect(after.width / (await size(card(page, "Yes / No Choice"))).width).toBeCloseTo(124 / 220, 2);
});

const mobileCard = (id: string, name: string, label: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: `mobile-${name}`, src: `/graphics/mobile/${name}.svg`, label, headerText: label, showHeader: true },
});

test("a group made of portrait cards wraps them", async ({ page }) => {
  await seed(page, {
    nodes: [
      mobileCard("a", "sign-in", "Sign In", 0, 0),
      mobileCard("b", "home", "Home Feed", 200, 0),
      mobileCard("c", "profile", "Profile", 0, 400),
    ],
    edges: [],
  });
  await openEditor(page);
  await card(page, "Sign In").locator("img").click();
  await card(page, "Home Feed").locator("img").click({ modifiers: ["ControlOrMeta"] });
  await page.getByRole("button", { name: "Group", exact: true }).click();
  const frame = page.locator(".react-flow__node-group");
  await expect(frame).toHaveCount(1);
  const f = (await frame.boundingBox())!;
  for (const label of ["Sign In", "Home Feed"]) {
    const b = (await card(page, label).boundingBox())!;
    expect(b.x).toBeGreaterThan(f.x);
    expect(b.y).toBeGreaterThan(f.y);
    expect(b.x + b.width).toBeLessThan(f.x + f.width);
    expect(b.y + b.height).toBeLessThan(f.y + f.height);
    expect(b.height).toBeGreaterThan(b.width * 1.8);
  }
  // Snug at the right, as around landscape cards: the frame fits the portrait width.
  const right = (await card(page, "Home Feed").boundingBox())!;
  expect(f.x + f.width - (right.x + right.width)).toBeLessThan(40);
  // Cards at x 0 and 200, 124 px wide, plus 16 px each side: 356 px, in card widths at this zoom.
  expect(f.width / right.width).toBeCloseTo(356 / 124, 1);
  const c = (await card(page, "Profile").boundingBox())!;
  expect(c.y).toBeGreaterThan(f.y + f.height);
});

test("search finds the new templates by name and by category", async ({ page }) => {
  await openEditor(page);
  const search = sidebar(page).getByRole("textbox", { name: "Search graphics in all categories" });
  const names = () => tiles(page).getByRole("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")));
  await search.fill("wizard");
  await expect.poll(names).toEqual(["Wizard Step 1", "Wizard Step 2", "Wizard Step 3"]);
  await search.fill("email");
  await expect.poll(names).toEqual(["Email Sent", "Email Code", "Email Confirmed"]);
  await search.fill("yes");
  await expect.poll(names).toEqual(["Yes / No Choice"]);
  await search.fill("mobile");
  await expect(tiles(page)).toHaveCount(15);
  // Enter adds one from the keyboard, as any template.
  await tile(page, "Empty State").focus();
  await page.keyboard.press("Enter");
  await expect(card(page, "Empty State")).toBeVisible();
});
