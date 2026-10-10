import type { Page } from "@playwright/test";
import { test, expect, openEditor, saved, seed } from "./fixtures";

// The earlier editor's edge Shape (Smooth, Polyline, Polyline Round) and Size
// (1 to 10), in the Connection panel.
const node = (id: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg", label: "Article", headerText: id, showHeader: true },
});
const DIAGRAM = {
  nodes: [node("a", 0, 0), node("b", 420, 420)],
  edges: [{ id: "ab", source: "a", target: "b", markerEnd: { type: "arrowclosed" } }],
};

const path = (page: Page) => page.locator('.react-flow__edge[data-id="ab"] .react-flow__edge-path');
const panel = (page: Page) => page.getByRole("complementary", { name: "Connection" });
const line = (page: Page) => panel(page).getByRole("combobox", { name: "Line" });
const width = (page: Page) => panel(page).getByRole("slider", { name: "Width" });
// What the line looks like: bezier curves (C), or corners drawn as quadratic
// curves (Q) that are rounded, or have no radius (control point = end point).
async function drawn(page: Page) {
  const d = (await path(page).getAttribute("d")) ?? "";
  if (d.includes("C")) return "curve";
  const corners = [...d.matchAll(/Q\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/g)];
  return corners.some(([, cx, cy, x, y]) => cx !== x || cy !== y) ? "rounded corners" : "right angles";
}
const strokeWidth = (page: Page) => path(page).evaluate((el) => getComputedStyle(el).strokeWidth);

test("a connection's line shape and width change from its panel, each as one undo step, and are saved", async ({
  page,
}) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  expect(await drawn(page)).toBe("curve");
  expect(await strokeWidth(page)).toBe("2px");
  const b = (await path(page).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(line(page)).toHaveValue("smooth");
  await expect(width(page)).toHaveValue("2");

  await line(page).selectOption({ label: "Polyline" });
  await expect.poll(() => drawn(page)).toBe("right angles");
  await line(page).selectOption({ label: "Rounded polyline" });
  await expect.poll(() => drawn(page)).toBe("rounded corners");

  // Dragging the slider shows the width as it goes and stores where it is let go.
  const s = (await width(page).boundingBox())!;
  await page.mouse.move(s.x + 4, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width * 0.4, s.y + s.height / 2, { steps: 5 });
  await page.mouse.move(s.x + s.width - 2, s.y + s.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(width(page)).toHaveValue("10");
  await expect.poll(() => strokeWidth(page)).toBe("10px");
  await expect(panel(page).getByText("10 px")).toBeVisible();
  // The keyboard works too: one step per key press.
  await width(page).press("ArrowLeft");
  await expect.poll(() => strokeWidth(page)).toBe("9px");

  await expect
    .poll(async () => (await saved(page))!.edges[0])
    .toMatchObject({ type: "smoothstep", style: { strokeWidth: 9 } });
  await page.reload();
  expect(await drawn(page)).toBe("rounded corners");
  expect(await strokeWidth(page)).toBe("9px");

  // Undo: the key press, the whole drag, then each shape change.
  for (const [w, shape] of [
    ["10px", "rounded corners"],
    ["2px", "rounded corners"],
    ["2px", "right angles"],
    ["2px", "curve"],
  ]) {
    await page.keyboard.press("Control+z");
    await expect.poll(() => strokeWidth(page)).toBe(w);
    await expect.poll(() => drawn(page)).toBe(shape);
  }
  expect((await saved(page))!.edges[0]).not.toHaveProperty("type");
});

test("a coloured connection keeps its colour when its width changes, and the panel follows undo", async ({ page }) => {
  await seed(page, { ...DIAGRAM, edges: [{ ...DIAGRAM.edges[0], style: { stroke: "#e8590c" } }] });
  await openEditor(page);
  const b = (await path(page).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await width(page).focus();
  await width(page).press("ArrowRight");
  await expect(width(page)).toHaveValue("3");
  await width(page).press("ArrowRight");
  await expect.poll(() => strokeWidth(page)).toBe("4px");
  expect(await path(page).evaluate((el) => getComputedStyle(el).stroke)).toBe("rgb(232, 89, 12)");
  await page.keyboard.press("Control+z");
  await expect(width(page)).toHaveValue("3");
  await expect(panel(page).getByRole("textbox", { name: "Colour as hex or rgb()" })).toHaveValue("#e8590c");
});

test("a connection without a style of its own is drawn #a3a8c3 at 2px, arrowhead included, and wire blue when selected", async ({
  page,
}) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  const computed = () =>
    path(page).evaluate((el) => {
      const id = /url\(["']?#([^"')]+)/.exec(el.getAttribute("marker-end") ?? "")?.[1];
      const head = id ? document.getElementById(id)?.querySelector("polyline") : null;
      return {
        stroke: getComputedStyle(el).stroke,
        width: getComputedStyle(el).strokeWidth,
        arrow: head ? getComputedStyle(head).fill : null,
      };
    });
  // globals.css always meant #a3a8c3 at 2px; React Flow's stylesheet used to win with #b1b1b7 at 1px.
  expect(await computed()).toEqual({ stroke: "rgb(163, 168, 195)", width: "2px", arrow: "rgb(163, 168, 195)" });

  const b = (await path(page).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect.poll(computed).toEqual({ stroke: "rgb(67, 83, 255)", width: "2px", arrow: "rgb(163, 168, 195)" });
  // The panel names the colour and width the line is drawn with.
  const palette = panel(page).getByRole("group", { name: "Palette" });
  await expect(panel(page).getByRole("textbox", { name: "Colour as hex or rgb()" })).toHaveValue("#a3a8c3");
  await expect(width(page)).toHaveValue("2");
  await expect(palette.getByRole("button", { name: "#a3a8c3 (default)" })).toHaveAttribute("aria-pressed", "true");

  // A colour of its own replaces it, arrowhead too, and stays when selected.
  await palette.getByRole("button", { name: "#e8590c" }).click();
  await expect.poll(computed).toMatchObject({ stroke: "rgb(232, 89, 12)", arrow: "rgb(232, 89, 12)" });
  // Picking the default again stores no colour.
  await palette.getByRole("button", { name: "#a3a8c3 (default)" }).click();
  await expect.poll(async () => (await saved(page))!.edges[0]).not.toHaveProperty("style");
  await page.keyboard.press("Escape");
  await expect.poll(computed).toEqual({ stroke: "rgb(163, 168, 195)", width: "2px", arrow: "rgb(163, 168, 195)" });
});
