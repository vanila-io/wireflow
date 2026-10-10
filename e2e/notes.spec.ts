import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { centre, drag, expect, openEditor, saved, seed, test } from "./fixtures";

// #83: notes, free text that connects like a card.
const cardNode = (id: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId: "article-article-1", src: "/graphics/article/article-1.svg", label: "Article", headerText: id, showHeader: true },
});
const noteNode = (id: string, x: number, y: number, text: string, size = { width: 220, height: 120 }) => ({
  id,
  type: "note",
  position: { x, y },
  ...size,
  data: { text },
});
const DIAGRAM = { version: 3, nodes: [cardNode("a", 0, 0), noteNode("n", 400, 300, "Ask for the coupon here")], edges: [] };

const sidebar = (page: Page) => page.getByRole("complementary", { name: "Screen templates" });
const noteTile = (page: Page) => sidebar(page).getByRole("button", { name: /^Note/ });
const note = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
// React Flow fits the view to the diagram once it has measured the nodes, which
// under load can come late: wait for the fit (the viewport has moved from where
// it starts) and for the node to stay put before reading where things are.
async function settled(page: Page, id: string) {
  let last = "";
  await expect
    .poll(
      async () => {
        const transform = await page.locator(".react-flow__viewport").evaluate((el) => el.style.transform);
        const now = JSON.stringify(await note(page, id).boundingBox());
        const same = now === last && transform !== "translate(0px, 0px) scale(1)";
        last = now;
        return same;
      },
      { intervals: [300] }
    )
    .toBe(true);
}
const savedNote = async (page: Page, id?: string) =>
  (await saved(page))?.nodes.find((n) => n.type === "note" && (!id || n.id === id)) as
    | { id: string; width: number; height: number; parentId?: string; data: { text: string } }
    | undefined;

test("the Note tile adds a note that opens for typing, keeps line breaks, and is saved", async ({ page }) => {
  await openEditor(page);
  // The Note tile leads the list, before the templates.
  await expect(sidebar(page).locator('button[draggable="true"]').first()).toHaveAccessibleName(/^Note/);
  await noteTile(page).click();
  const text = page.getByRole("textbox", { name: "Note text" });
  await expect(text).toBeFocused();
  await page.keyboard.type("Sign up needs:");
  await page.keyboard.press("Enter");
  await page.keyboard.type("email and password");
  await page.keyboard.press("Control+Enter");
  await expect(text).toHaveCount(0);
  const n = page.locator(".react-flow__node-note");
  await expect(n).toHaveText("Sign up needs:\nemail and password");
  await expect.poll(async () => (await savedNote(page))?.data.text).toBe("Sign up needs:\nemail and password");
  await page.reload();
  await expect(page.locator(".react-flow__node-note")).toHaveText("Sign up needs:\nemail and password");

  // Undo takes back the text, then the note.
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await savedNote(page))?.data.text).toBe("");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".react-flow__node-note")).toHaveCount(0);
});

test("a note is edited in place with a double-click (Escape cancels) and in the Note panel", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await note(page, "n").getByText("Ask for the coupon here").dblclick();
  const text = page.getByRole("textbox", { name: "Note text" });
  await text.fill("Changed my mind");
  await text.press("Escape");
  await expect(note(page, "n")).toHaveText("Ask for the coupon here");

  await note(page, "n").click();
  const panel = page.getByRole("complementary", { name: "Note" });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Keyboard shortcuts" })).toBeHidden();
  const field = panel.getByRole("textbox", { name: "Text" });
  await expect(field).toHaveValue("Ask for the coupon here");
  await field.fill("Coupon: optional\nShown under the total");
  await field.press("Tab");
  await expect(note(page, "n")).toHaveText("Coupon: optional\nShown under the total");
  await page.keyboard.press("Control+z");
  await expect(field).toHaveValue("Ask for the coupon here");
});

test("a selected note resizes from its corner as one undo step", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  await note(page, "n").click();
  const corner = note(page, "n").locator(".react-flow__resize-control.handle.bottom.right");
  await expect(corner).toBeVisible();
  const from = await centre(corner);
  await drag(page, from, { x: from.x + 100, y: from.y + 60 });
  await expect.poll(async () => (await savedNote(page))?.width).toBe(320);
  expect((await savedNote(page))!.height).toBe(180);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await savedNote(page))?.width).toBe(220);
});

test("a card connects to a note, and a note copies, pastes and groups like a card", async ({ page }) => {
  await seed(page, DIAGRAM);
  await openEditor(page);
  await settled(page, "n");
  const from = await centre(page.locator('.react-flow__node[data-id="a"] .react-flow__handle.source'));
  const to = await centre(page.locator('.react-flow__node[data-id="n"] .react-flow__handle.target'));
  await drag(page, from, to);
  await expect.poll(async () => (await saved(page))?.edges.map((e) => [e.source, e.target])).toEqual([["a", "n"]]);

  await note(page, "n").click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.locator(".react-flow__node-note")).toHaveCount(2);
  await expect(page.locator(".react-flow__node-note").last()).toHaveText("Ask for the coupon here");

  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+g");
  await expect(page.getByTestId("group-frame")).toBeVisible();
  await expect.poll(async () => (await saved(page))?.nodes.filter((n) => n.type === "note").every((n) => !!n.parentId)).toBe(true);
});

test("a note is in the exported image, without its editing controls", async ({ page }) => {
  await seed(page, { version: 3, nodes: [noteNode("n", 0, 0, "Exported note text, two lines\nof it", { width: 400, height: 200 })], edges: [] });
  await openEditor(page);
  await note(page, "n").click();
  await page.getByRole("button", { name: "Export image" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "PNG image" }).click();
  const file = await (await download).path();
  const data = `data:image/png;base64,${readFileSync(file!).toString("base64")}`;
  const shot = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let paper = 0;
    let ink = 0;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r === 255 && g === 252 && b === 240) paper++;
      if (r < 120 && g < 120 && b < 120) ink++;
      if (r < 100 && g < 120 && b > 200) blue++;
    }
    return { width: c.width, height: c.height, paper, ink, blue };
  }, data);
  // 400 x 200 plus 40 px padding a side, at twice the pixel density.
  expect([shot.width, shot.height]).toEqual([960, 560]);
  // Mostly the note's paper colour where the note is, with its text drawn on it.
  expect(shot.paper).toBeGreaterThan(800 * 400 * 0.7);
  expect(shot.ink).toBeGreaterThan(500);
  // The selection outline is CSS outline, but the blue resize handles must not be drawn.
  expect(shot.blue).toBeLessThan(200);
});

test("notes added by clicking don't land on each other or on the last card", async ({ page }) => {
  await seed(page, { version: 3, nodes: [cardNode("a", 0, 0)], edges: [] });
  await openEditor(page);
  for (let i = 0; i < 2; i++) {
    await noteTile(page).click();
    await page.keyboard.press("Escape");
  }
  const boxes = await page.locator(".react-flow__node").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(boxes).toHaveLength(3);
  const overlap = (a: DOMRect, b: DOMRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("tapping the Note tile adds a note and the Note panel fits the screen", async ({ page }) => {
    await openEditor(page);
    await noteTile(page).tap();
    await expect(page.getByRole("textbox", { name: "Note text" })).toBeFocused();
    // It lands in the middle of the canvas, beside the templates panel.
    const n = (await page.locator(".react-flow__node-note").boundingBox())!;
    const side = (await sidebar(page).boundingBox())!;
    const pane = (await page.locator(".react-flow__pane").boundingBox())!;
    expect(Math.abs(n.x + n.width / 2 - (pane.x + pane.width / 2))).toBeLessThan(2);
    expect(n.x + n.width / 2).toBeGreaterThan(side.x + side.width);
    await page.keyboard.type("Tap to edit");
    await page.locator(".react-flow__pane").tap({ position: { x: 20, y: 20 } });
    await expect.poll(async () => (await savedNote(page))?.data.text).toBe("Tap to edit");
    await page.locator(".react-flow__node-note").tap();
    const panel = page.getByRole("complementary", { name: "Note" });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});
