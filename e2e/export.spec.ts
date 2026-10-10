import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, openEditor, seed, test } from "./fixtures";

// Export image: the whole diagram at full resolution, not the part on screen (#68).
const node = (id: string, label: string, graphicId: string, src: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId, src, label, headerText: label, showHeader: true },
});
// Twelve cards in a row, 3,520 px wide: far wider than the screen.
const WIDE = {
  nodes: Array.from({ length: 12 }, (_, i) =>
    i % 2
      ? node(`n${i}`, `Cart ${i}`, "e-commerce-cart", "/graphics/e-commerce/cart.svg", i * 300, 0)
      : node(`n${i}`, `Article ${i}`, "article-article-1", "/graphics/article/article-1.svg", i * 300, 0)
  ),
  edges: Array.from({ length: 11 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
    markerEnd: { type: "arrowclosed" },
  })),
};
const WIDTH = 11 * 300 + 220; // first card's left edge to the last card's right edge
const HEIGHT = 198; // one card with its header

// Decode an exported image in the page and describe it: its size, and how much
// of each tenth of it, left to right, is drawn on (not background).
async function inspect(page: Page, file: string, type: string) {
  const data = `data:${type};base64,${readFileSync(file).toString("base64")}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const inked = Array(10).fill(0);
    for (let y = 0; y < c.height; y += 4) {
      for (let x = 0; x < c.width; x += 4) {
        const i = (y * c.width + x) * 4;
        if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) inked[Math.floor((x / c.width) * 10)]++;
      }
    }
    return { width: c.width, height: c.height, inked };
  }, data);
}

async function exportAs(page: Page, label: string) {
  await page.getByRole("button", { name: "Export image" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: label }).click();
  return download;
}

test("Export image saves the whole diagram as a sharp JPG or PNG, whatever part of it is on screen", async ({ page }) => {
  await seed(page, WIDE);
  await openEditor(page);
  // Zoom in on the first card: most of the diagram is off screen.
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".react-flow__node").last()).not.toBeInViewport();

  const jpg = await exportAs(page, "JPG image");
  expect(jpg.suggestedFilename()).toBe("wireflow.jpg");
  const shot = await inspect(page, (await jpg.path())!, "image/jpeg");
  // Zoom 1 plus 40 px padding a side, at twice the pixel density.
  expect(shot.width).toBe((WIDTH + 80) * 2);
  expect(shot.height).toBe((HEIGHT + 80) * 2);
  // Cards are drawn across the whole width, not just where the screen was.
  expect(shot.inked.every((n) => n > 50)).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: `Exported wireflow.jpg (${shot.width} × ${shot.height} px).` })).toBeVisible();

  const png = await exportAs(page, "PNG image");
  expect(png.suggestedFilename()).toBe("wireflow.png");
  const pngShot = await inspect(page, (await png.path())!, "image/png");
  expect([pngShot.width, pngShot.height]).toEqual([shot.width, shot.height]);
  expect(pngShot.inked.every((n) => n > 50)).toBe(true);
});

test("the card images and labels are in the export (the image isn't blank where cards are)", async ({ page }) => {
  await seed(page, { nodes: WIDE.nodes.slice(0, 1), edges: [] });
  await openEditor(page);
  const png = await exportAs(page, "PNG image");
  const shot = await inspect(page, (await png.path())!, "image/png");
  expect([shot.width, shot.height]).toEqual([(220 + 80) * 2, (HEIGHT + 80) * 2]);
  // The wireframe image fills the middle of the card: most columns are drawn on.
  expect(shot.inked.slice(2, 8).every((n) => n > 100)).toBe(true);
});

test("Export image is disabled on an empty canvas", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("button", { name: "Export image" })).toBeDisabled();
});
