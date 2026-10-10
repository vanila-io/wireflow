import { test as base, expect, type Locator, type Page } from "@playwright/test";

export { expect };

// Every test fails if the page logs a console error or throws an uncaught
// error. `allowErrors` (set with test.use) matches errors a test causes on purpose.
export const test = base.extend<{ allowErrors: RegExp | null }>({
  allowErrors: [null, { option: true }],
  page: async ({ page, allowErrors }, runTest) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !allowErrors?.test(msg.text())) errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await runTest(page);
    expect(errors, "console errors / uncaught page errors").toEqual([]);
  },
});

export const STORAGE_KEY = "wireflow-flow-v1";

type Saved = {
  version?: number;
  nodes: Array<
    Record<string, unknown> & { id: string; position: { x: number; y: number }; data: Record<string, unknown> }
  >;
  edges: Array<Record<string, unknown> & { id: string; source: string; target: string }>;
};

// The diagram the editor autosaves (null before the first save).
export const saved = (page: Page): Promise<Saved | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORAGE_KEY);

export const raw = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

// Put something in the autosave slot before the editor loads (from a light
// page of the same origin).
export async function seed(page: Page, value: unknown) {
  await page.goto("/manifest.webmanifest");
  await page.evaluate(
    ([key, v]) => localStorage.setItem(key as string, typeof v === "string" ? v : JSON.stringify(v)),
    [STORAGE_KEY, value] as const
  );
}

export async function openEditor(page: Page, query = "") {
  await page.goto(`/app${query}`);
  await expect(page.locator(".react-flow__pane")).toBeVisible();
}

// A card on the canvas, found by its graphic's name.
export const card = (page: Page, label: string) =>
  page.locator(".react-flow__node").filter({ has: page.getByRole("img", { name: label, exact: true }) });

// The template tiles in the sidebar (not the Note tile and the like, which have no image).
export const tiles = (page: Page) => page.locator('aside button[draggable="true"]:has(img)');

export async function centre(locator: Locator) {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Drag with the mouse in small steps (React Flow uses d3-drag).
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

// Two cards and the connection between them, as the editor saved them before
// this change: React Flow's raw nodes, with measurements and handle ids.
export const SAMPLE = {
  nodes: [
    {
      id: "article-article-1-1791567208054-ppqgj",
      type: "flow",
      position: { x: 180, y: 50 },
      data: {
        graphicId: "article-article-1",
        src: "/graphics/article/article-1.svg",
        label: "Article",
        headerText: "Article",
        showHeader: true,
      },
      measured: { width: 220, height: 198 },
    },
    {
      id: "e-commerce-cart-1791567209999-abcde",
      type: "flow",
      position: { x: 180, y: 400 },
      data: {
        graphicId: "e-commerce-cart",
        src: "/graphics/e-commerce/cart.svg",
        label: "Cart",
        headerText: "My cart",
        showHeader: true,
      },
      measured: { width: 220, height: 198 },
    },
  ],
  edges: [
    {
      markerEnd: { type: "arrowclosed" },
      source: "article-article-1-1791567208054-ppqgj",
      sourceHandle: null,
      target: "e-commerce-cart-1791567209999-abcde",
      targetHandle: null,
      id: "xy-edge__article-article-1-1791567208054-ppqgj-e-commerce-cart-1791567209999-abcde",
    },
  ],
};
