import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, openEditor, saved, seed, test } from "./fixtures";

// #86, #69: the user's own image (a phone screenshot, a sketch) as a card.
const sidebar = (page: Page) => page.getByRole("complementary", { name: "Screen templates" });
const imageTile = (page: Page) => sidebar(page).getByRole("button", { name: /^Your image/ });

// A PNG drawn in the page: a phone-shaped screen by default.
async function png(page: Page, width = 1170, height = 2532): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#4353ff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.2);
      const blob = await new Promise<Blob>((done) => c.toBlob((b) => done(b!), "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
    [width, height]
  );
  return Buffer.from(base64, "base64");
}

async function pick(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent("filechooser");
  await imageTile(page).click();
  await (await chooser).setFiles(file);
}

type SavedCard = { id: string; type: string; data: { graphicId: string; src: string; label: string; ratio: number } };
const ownCards = async (page: Page) =>
  ((await saved(page))?.nodes ?? []).filter((n) => (n.data as SavedCard["data"]).graphicId === "own-image") as unknown as SavedCard[];

test("Your image adds a picked picture as a card, scaled down, saved, undoable and in the file", async ({ page }) => {
  await openEditor(page);
  await expect(imageTile(page)).toBeVisible();
  await pick(page, { name: "phone home.png", mimeType: "image/png", buffer: await png(page) });

  const img = page.getByRole("img", { name: "phone home", exact: true });
  await expect(img).toBeVisible();
  await expect(page.locator(".react-flow__node").filter({ has: img })).toContainText("phone home");
  const [c] = await ownCards(page);
  expect(c.data.src).toMatch(/^data:image\/jpeg;base64,/);
  expect(c.data.ratio).toBeCloseTo(2532 / 1170, 2);
  // Scaled to 1280 px on its long side.
  const natural = await img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]);
  expect(natural).toEqual([Math.round((1170 * 1280) / 2532), 1280]);
  // Drawn at the picture's shape: 220 px wide, about twice as tall.
  const box = (await page.locator(".react-flow__node").filter({ has: img }).boundingBox())!;
  expect(box.height / box.width).toBeGreaterThan(2);

  await page.reload();
  await expect(page.getByRole("img", { name: "phone home", exact: true })).toBeVisible();

  // Export JSON keeps the picture itself.
  const download = page.waitForEvent("download");
  await page.getByRole("banner").getByRole("button", { name: "Export JSON" }).click();
  const file = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(file.diagram.nodes[0].data.src).toBe(c.data.src);

  await page.keyboard.press("Control+z");
  await expect(page.getByRole("img", { name: "phone home", exact: true })).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("img", { name: "phone home", exact: true })).toBeVisible();
});

test("an image file dropped on the canvas becomes a card where it lands", async ({ page }) => {
  // A diagram that isn't empty: React Flow fits the view to the first card added
  // to an empty canvas, which would move it.
  await seed(page, {
    nodes: [{ id: "a", type: "flow", position: { x: 0, y: 0 }, data: { graphicId: "e-commerce-cart", label: "Cart" } }],
    edges: [],
  });
  await openEditor(page);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  let last = "";
  await expect
    .poll(
      async () => {
        const now = await page.locator(".react-flow__viewport").evaluate((el) => el.style.transform);
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [300] }
    )
    .toBe(true);
  const bytes = [...(await png(page, 800, 600))];
  const dataTransfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], "sketch.png", { type: "image/png" }));
    return dt;
  }, bytes);
  const pane = (await page.locator(".react-flow__pane").boundingBox())!;
  const at = { clientX: pane.x + 300, clientY: pane.y + 500 };
  await page.dispatchEvent(".react-flow__pane", "dragover", { dataTransfer, ...at });
  await page.dispatchEvent(".react-flow__pane", "drop", { dataTransfer, ...at });
  const node = page.locator(".react-flow__node").filter({ has: page.getByRole("img", { name: "sketch" }) });
  await expect(node).toBeVisible();
  const b = (await node.boundingBox())!;
  expect(Math.abs(b.x + b.width / 2 - at.clientX)).toBeLessThan(4);
  expect(Math.abs(b.y + b.height / 2 - at.clientY)).toBeLessThan(4);
});

test("a file that isn't an image is refused with a clear message", async ({ page }) => {
  await openEditor(page);
  await pick(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert").filter({ hasText: "notes.txt" })).toHaveText(
    "Couldn't add notes.txt. Wireflow takes PNG, JPEG, WebP or GIF images."
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("when this browser's storage is nearly full, an image is refused; when it is getting full, a warning says so", async ({
  page,
}) => {
  await page.goto("/robots.txt");
  await page.evaluate(() => localStorage.setItem("filler", "x".repeat(4_850_000)));
  await openEditor(page);
  const picture = { name: "big.png", mimeType: "image/png", buffer: await png(page) };
  await pick(page, picture);
  await expect(page.getByRole("alert").filter({ hasText: "big.png" })).toContainText(
    "Couldn't add big.png: this browser's storage for Wireflow is nearly full (4.9 of about 5.0 MB)."
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("filler", "x".repeat(4_100_000)));
  await page.getByRole("button", { name: "Dismiss" }).click();
  await pick(page, picture);
  await expect(page.getByRole("img", { name: "big", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Wireflow now uses" })).toContainText(
    "of the about 5.0 MB this browser keeps for it, mostly for images. Use Export JSON to keep a copy"
  );
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("tapping Your image asks for a picture and adds it", async ({ page }) => {
    await openEditor(page);
    const chooser = page.waitForEvent("filechooser");
    await imageTile(page).tap();
    await (await chooser).setFiles({ name: "screen.png", mimeType: "image/png", buffer: await png(page, 390, 844) });
    await expect(page.getByRole("img", { name: "screen", exact: true })).toBeAttached();
    expect(await ownCards(page)).toHaveLength(1);
  });
});
