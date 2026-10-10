import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { card, expect, openEditor, raw, saved, seed, test, tiles } from "./fixtures";

const node = (id: string, graphicId: string, src: string, label: string, x: number, y: number) => ({
  id,
  type: "flow",
  position: { x, y },
  data: { graphicId, src, label, headerText: label, showHeader: true },
});
const EXISTING = { nodes: [node("old", "misc-404", "/graphics/misc/404.svg", "404", 0, 0)], edges: [] };

async function open(page: Page, name: string, content: string | object) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open file" }).first().click();
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
  });
}

test("a saved file opens again in a fresh browser, with stable template ids", async ({ page }) => {
  await openEditor(page);
  await tiles(page).nth(0).click();
  await tiles(page).nth(30).click();
  const [a, b] = await page.locator(".react-flow__node").all();
  await a.locator(".react-flow__handle-bottom").hover();
  await page.mouse.down();
  const t = (await b.locator(".react-flow__handle-top").boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
  await page.mouse.up();
  await a.locator(".flow-node-header button").dblclick();
  await page.getByRole("textbox", { name: "Card header" }).fill("Landing");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await saved(page))?.edges.length).toBe(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("wireflow.json");
  const text = readFileSync(await file.path(), "utf8");
  const json = JSON.parse(text);
  expect(json).toMatchObject({ format: "wireflow", version: 3 });
  expect(json.diagram.nodes).toHaveLength(2);
  expect(text).not.toContain("/graphics/");
  const before = (await saved(page))!;

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await open(page, "wireflow.json", text);
  await expect(page.getByRole("status").filter({ hasText: "Opened wireflow.json." })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.getByText("Landing", { exact: true })).toBeVisible();
  // Images come from this build's catalog.
  for (const img of await page.locator(".react-flow__node img").all()) {
    expect(await img.getAttribute("src")).toMatch(/^\/graphics\//);
  }
  const after = (await saved(page))!;
  expect(after.nodes.map((n) => [n.id, n.data])).toEqual(before.nodes.map((n) => [n.id, n.data]));
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("opening over a diagram asks first; cancel keeps it, replace is one undo step", async ({ page }) => {
  await seed(page, EXISTING);
  await openEditor(page);
  const incoming = {
    format: "wireflow",
    version: 2,
    diagram: { nodes: [node("new", "e-commerce-cart", "", "Cart", 0, 0)], edges: [] },
  };

  await open(page, "cart.json", incoming);
  const dialog = page.getByRole("dialog", { name: "Replace the current diagram?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(card(page, "404")).toBeVisible();
  expect(JSON.parse((await raw(page))!).nodes[0].id).toBe("old");

  await open(page, "cart.json", incoming);
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(card(page, "Cart")).toBeVisible();
  await expect(card(page, "404")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))!.nodes.map((n) => n.id)).toEqual(["new"]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "404")).toBeVisible();
  await expect.poll(async () => (await saved(page))!.nodes.map((n) => n.id)).toEqual(["old"]);
});

test("files Wireflow cannot open show why and change nothing", async ({ page }) => {
  await seed(page, EXISTING);
  await openEditor(page);
  const storage = await raw(page);
  const cases: Array<[string, string, RegExp]> = [
    ["notes.json", "not json at all", /Couldn't open notes\.json\. It isn't a JSON file\./],
    ["package.json", '{"name":"x","version":"1.0.0"}', /doesn't contain a Wireflow diagram/],
    ["future.json", '{"format":"wireflow","version":9,"diagram":{"nodes":[]}}', /newer version of Wireflow/],
    [
      "loop.json",
      '{"nodes":[],"edges":[],"groups":[{"id":"a","parent":"b"},{"id":"b","parent":"a"}]}',
      /inside itself/,
    ],
    [
      "unknown.json",
      '{"format":"wireflow","version":1,"diagram":{"nodes":[{"id":"n","x":1,"y":1,"template":"Misc/Spaceship"}],"edges":[]}}',
      /doesn't have: "Misc\/Spaceship"/,
    ],
  ];
  for (const [name, content, message] of cases) {
    await open(page, name, content);
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await expect(card(page, "404")).toBeVisible();
  expect(await raw(page)).toBe(storage);
});

test("opens the earlier Export JSON and the gg-editor app's files with their groups, dropping loose connections with a message", async ({
  page,
}) => {
  await openEditor(page);
  const previous = {
    nodes: [
      node("p1", "article-article-1", "/graphics/article/article-1.svg", "Article", 0, 0),
      node("p2", "blog-articles-2", "/graphics/blog/articles-2.svg", "Blog", 0, 300),
    ],
    edges: [{ id: "xy-edge__p1-p2", source: "p1", target: "p2", markerEnd: { type: "arrowclosed" } }],
  };
  await open(page, "wireflow.json", previous);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  const v1 = {
    format: "wireflow",
    version: 1,
    diagram: {
      nodes: [
        {
          id: "a1",
          type: "node",
          x: 100,
          y: 100,
          shape: "node-image-header",
          label: "Sign in",
          template: "Sign in/Sign in 1",
          parent: "g1",
        },
        {
          id: "a2",
          type: "node",
          x: 260,
          y: 100,
          shape: "node-image-without-header",
          label: "Cart",
          template: "E-Commerce/Cart",
          parent: "g1",
        },
      ],
      edges: [
        { id: "e1", source: "a1", target: "a2", color: "#e8590c", label: "Add" },
        { id: "e2", source: "a2", target: { x: 400, y: 500 } },
      ],
      groups: [{ id: "g1", label: "Shop" }],
    },
  };
  await open(page, "old.json", v1);
  await page.getByRole("dialog").getByRole("button", { name: "Replace" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Removed 1 connection that didn't connect two cards." })
  ).toBeVisible();
  // The old group comes along as a frame around its two cards.
  const frame = page.locator(".react-flow__node-group");
  await expect(frame).toHaveCount(1);
  await expect(frame.getByRole("button", { name: "Shop" })).toBeVisible();
  // (Checked again until the fit-view animation after opening has settled.)
  await expect(async () => {
    const fb = (await frame.boundingBox())!;
    for (const c of await page.locator(".react-flow__node-flow").all()) {
      const b = (await c.boundingBox())!;
      expect(b.x).toBeGreaterThan(fb.x);
      expect(b.x + b.width).toBeLessThan(fb.x + fb.width);
      expect(b.y + b.height).toBeLessThan(fb.y + fb.height);
    }
  }).toPass();
  await expect(page.locator(".react-flow__node-flow")).toHaveCount(2);
  await expect(page.locator(".flow-node-header").getByText("Sign in", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect(page.getByText("Add", { exact: true })).toBeVisible();

  // A file with __proto__ keys doesn't reach Object.prototype.
  await open(
    page,
    "proto.json",
    '{"nodes":[{"id":"x","type":"flow","position":{"x":0,"y":0},"data":{"graphicId":"misc-404","__proto__":{"polluted":true}},"__proto__":{"polluted":true}}],"edges":[]}'
  );
  await page.getByRole("dialog").getByRole("button", { name: "Replace" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  expect(await page.evaluate(() => (Object.prototype as Record<string, unknown>).polluted)).toBeUndefined();
});

test("a diagram too big for this browser's storage isn't opened, and the previous one stays", async ({ page }) => {
  await seed(page, EXISTING);
  await openEditor(page);
  // Make storage refuse anything larger than the current diagram, like a full quota.
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (value.length > 600) throw new DOMException("full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  const big = {
    nodes: Array.from({ length: 12 }, (_, i) => node(`n${i}`, "article-article-1", "", "Article", i * 260, 0)),
    edges: [],
  };
  const storage = await raw(page);
  await open(page, "big.json", big);
  await page.getByRole("dialog").getByRole("button", { name: "Replace" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Couldn't open big.json. It's too big to keep in this browser's storage" })
  ).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(card(page, "404")).toBeVisible();
  expect(await raw(page)).toBe(storage);
});
