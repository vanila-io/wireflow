import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, openEditor, saved, seed, test } from "./fixtures";

// #84: hours per card, totals per group and in the header, an hourly rate.
const cardNode = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg", label: "Article", headerText: id, showHeader: true, ...extra },
});
const DIAGRAM = {
  version: 3,
  nodes: [
    { id: "g", type: "group", position: { x: -16, y: -36 }, width: 552, height: 250, data: { label: "Auth" } },
    { ...cardNode("login", 16, 36), parentId: "g" },
    { ...cardNode("signup", 316, 36), parentId: "g" },
    cardNode("home", 0, 400),
  ],
  edges: [],
};

const header = (page: Page) => page.getByRole("banner");
const total = (page: Page) => header(page).getByRole("button", { name: /^Estimate:/ });
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const cardPanel = (page: Page) => page.getByRole("complementary", { name: "Card" });
const hours = (page: Page) => cardPanel(page).getByRole("spinbutton", { name: "Estimate (hours)" });

async function estimate(page: Page, id: string, value: string) {
  await node(page, id).locator("img").click();
  await hours(page).fill(value);
  await hours(page).press("Enter");
}

test("nothing shows until a card has hours; then the group and the header add them up", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await expect(total(page)).toHaveCount(0);
  await expect(page.getByTestId("group-frame")).toHaveText("Auth");

  await estimate(page, "login", "4");
  await expect(total(page)).toHaveText("Estimate: 4 h");
  await expect(page.getByTestId("group-frame")).toHaveText("Auth · 4 h");
  await estimate(page, "signup", "2.5");
  await estimate(page, "home", "8");
  await expect(total(page)).toHaveText("Estimate: 14.5 h");
  await expect(page.getByTestId("group-frame")).toHaveText("Auth · 6.5 h");

  // The group's panel has its total too.
  await page.getByTestId("group-frame").getByRole("button").click();
  const groupPanel = page.getByRole("complementary", { name: "Group" });
  await expect(groupPanel).toContainText("Estimate6.5 h");
  await expect(groupPanel).toContainText("Cards estimated2 of 2");

  // Clearing the field removes the estimate; undo brings it back.
  await estimate(page, "home", "");
  await expect(total(page)).toHaveText("Estimate: 6.5 h");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(total(page)).toHaveText("Estimate: 14.5 h");
  expect((await saved(page))!.nodes.find((n) => n.id === "home")!.data.estimate).toBe(8);
});

test("the header total opens the estimate per group, where an hourly rate turns hours into cost", async ({ page }) => {
  await seed(page, {
    ...DIAGRAM,
    nodes: DIAGRAM.nodes.map((n) => (n.type === "flow" ? { ...n, data: { ...n.data, estimate: n.id === "home" ? 8 : 3 } } : n)),
  });
  await openEditor(page);
  await total(page).click();
  await expect(total(page)).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("complementary", { name: "Estimate" });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Keyboard shortcuts" })).toBeHidden();
  const rows = panel.getByRole("row");
  await expect(rows).toHaveText(["Auth6 h", "Not in a group8 h", "Total14 h"]);
  await expect(panel).toContainText("3 of 3 cards estimated");

  const rate = panel.getByRole("spinbutton", { name: "Hourly rate" });
  await rate.fill("100");
  await rate.press("Enter");
  await expect(rows).toHaveText(["Auth6 h$600", "Not in a group8 h$800", "Total14 h$1,400"]);
  await expect(total(page)).toHaveText("Estimate: 14 h · $1,400");
  await panel.getByRole("combobox", { name: "Currency" }).selectOption("EUR");
  await expect(total(page)).toContainText("€");

  // A card's panel shows its cost.
  await node(page, "home").locator("img").click();
  await expect(cardPanel(page)).toContainText("€800 at €100 an hour");

  // Saved with the diagram, and in the file.
  await page.reload();
  await expect(total(page)).toContainText("14 h");
  await expect(total(page)).toContainText("€");
  const download = page.waitForEvent("download");
  await header(page).getByRole("button", { name: "Export JSON" }).click();
  const file = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(file.diagram.settings).toEqual({ hourlyRate: 100, currency: "EUR" });
  expect(file.diagram.nodes.find((n: { id: string }) => n.id === "home").data.estimate).toBe(8);

  // The panel closes from its button.
  await total(page).click();
  await panel.getByRole("button", { name: "Close the estimate" }).click();
  await expect(panel).toBeHidden();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the estimate is under More, and its panel fits the screen", async ({ page }) => {
    await seed(page, { ...DIAGRAM, nodes: [{ ...cardNode("home", 0, 0, { estimate: 5 }) }] });
    await openEditor(page);
    await expect(total(page)).toBeHidden();
    await header(page).getByRole("button", { name: "More" }).tap();
    await page.getByRole("menuitem", { name: "Estimate:  5 h" }).tap();
    const panel = page.getByRole("complementary", { name: "Estimate" });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});
