import type { Page } from "@playwright/test";
import { test, expect, openEditor, saved, seed as seedStorage } from "./fixtures";

const node = (id: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: {
    graphicId: "article-article-1",
    src: "/graphics/article/article-1.svg",
    label: "Article",
    headerText: id,
    showHeader: true,
  },
});
const DIAGRAM = {
  nodes: [node("a", 0, 0), node("b", 0, 400), node("c", 400, 0), node("d", 400, 400)],
  edges: [
    { id: "ab", source: "a", target: "b", markerEnd: { type: "arrowclosed" } },
    { id: "cd", source: "c", target: "d", markerEnd: { type: "arrowclosed" } },
  ],
};

async function seed(page: Page) {
  await seedStorage(page, DIAGRAM);
  await openEditor(page);
}
const edgeEl = (page: Page, id: string) => page.locator(`.react-flow__edge[data-id="${id}"]`);
// A vertical edge's box has no width, so click the middle of its path with the mouse.
async function selectEdge(page: Page, id: string) {
  const b = (await edgeEl(page, id).locator(".react-flow__edge-path").boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const stroke = async (page: Page, id: string) =>
  (await saved(page))!.edges.find((e) => e.id === id)!.style as { stroke?: string } | undefined;
const panel = (page: Page) => page.getByRole("complementary", { name: "Connection" });
const hex = (page: Page) => panel(page).getByRole("textbox", { name: "Colour as hex or rgb()" });

test("a colour typed as hex or rgb() is applied, opaque, and offered again for other edges", async ({ page }) => {
  await seed(page);
  await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
  await selectEdge(page, "ab");
  await expect(panel(page)).toBeVisible();
  await expect(page.getByText("Keyboard shortcuts")).toBeHidden();
  await expect(hex(page)).toHaveValue("#a3a8c3");

  await hex(page).fill("E8590C80");
  await hex(page).press("Enter");
  await expect.poll(() => stroke(page, "ab")).toEqual({ stroke: "#e8590c" });
  await expect(hex(page)).toHaveValue("#e8590c");
  const used = panel(page).getByRole("group", { name: "In this diagram" });
  await expect(used.getByRole("button", { name: "#e8590c" })).toHaveAttribute("aria-pressed", "true");

  await hex(page).fill("rgb(19, 194, 194)");
  await expect(panel(page).getByText("Type a colour like")).toHaveCount(0);
  await hex(page).fill("nope");
  await expect(panel(page).getByText("Type a colour like #e8590c or rgb(232, 89, 12).")).toBeVisible();
  await hex(page).press("Escape");
  await expect(hex(page)).toHaveValue("#e8590c");

  // Reuse it on the other edge.
  await selectEdge(page, "cd");
  await used.getByRole("button", { name: "#e8590c" }).click();
  await expect.poll(() => stroke(page, "cd")).toEqual({ stroke: "#e8590c" });
  await expect(used.getByRole("button", { name: "#e8590c" })).toHaveAttribute("aria-pressed", "true");
  // The arrowhead takes the colour too.
  expect((await saved(page))!.edges.find((e) => e.id === "cd")!.markerEnd).toEqual({
    type: "arrowclosed",
    color: "#e8590c",
  });
});

test("the panel follows undo and redo, and a same colour or an unchanged label adds no step", async ({ page }) => {
  await seed(page);
  await selectEdge(page, "ab");
  await panel(page).getByRole("group", { name: "Palette" }).getByRole("button", { name: "#4353ff" }).click();
  await expect.poll(() => stroke(page, "ab")).toEqual({ stroke: "#4353ff" });
  // Same colour again: nothing to undo.
  await panel(page).getByRole("group", { name: "Palette" }).getByRole("button", { name: "#4353ff" }).click();
  // Focus and leave the label without typing: nothing to undo either.
  await panel(page).getByRole("textbox", { name: "Label" }).click();
  await panel(page).getByRole("textbox", { name: "Label" }).press("Tab");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => stroke(page, "ab")).toBeUndefined();
  // The edge stays selected and its panel shows the undone state.
  await expect(hex(page)).toHaveValue("#a3a8c3");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(hex(page)).toHaveValue("#4353ff");

  const label = panel(page).getByRole("textbox", { name: "Label" });
  await label.fill("Sign in");
  await label.press("Enter");
  await expect(edgeEl(page, "ab")).toContainText("Sign in");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(label).toHaveValue("");
  await expect(edgeEl(page, "ab")).not.toContainText("Sign in");
});

test("a pick in the colour picker is one undo step", async ({ page }) => {
  await seed(page);
  await selectEdge(page, "ab");
  // A drag in the native picker: an "input" event per move, then one "change".
  await panel(page)
    .getByLabel("Pick a colour")
    .evaluate((el: HTMLInputElement) => {
      for (const v of ["#101010", "#505050", "#13c2c2"]) {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await expect.poll(() => stroke(page, "ab")).toEqual({ stroke: "#13c2c2" });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => stroke(page, "ab")).toBeUndefined();
});
