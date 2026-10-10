// The template catalog (lib/graphics.json) and the files it names: what the
// templates panel, its search and the AI's template list are built from.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import graphicSizes from "@/lib/graphic-sizes.json";
import { categoryLabels, graphics } from "@/lib/graphics";
import { cardSize, CARD_WIDTH, PORTRAIT_CARD_WIDTH } from "@/lib/diagram/model";

const publicDir = new URL("../../public", import.meta.url);
const read = (src: string) => readFileSync(new URL(`../../public${src}`, import.meta.url), "utf8");
const files = readdirSync(new URL("graphics", `${publicDir}/`), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) =>
    readdirSync(new URL(`graphics/${d.name}`, `${publicDir}/`))
      .filter((f) => f.endsWith(".svg"))
      .map((f) => `/graphics/${d.name}/${f}`)
  );
const viewBox = (svg: string) => /viewBox="([^"]+)"/.exec(svg)![1].trim().split(/[\s,]+/).map(Number);
const colours = (svg: string) =>
  new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g)].map((m) => m[1].toUpperCase()));

const isNew = (category: string) => category === "mobile" || category === "flow";
const mobile = graphics.filter((g) => g.category === "mobile");
const flow = graphics.filter((g) => g.category === "flow");

describe("template catalog", () => {
  it("names a file for every template, and every file is in it", () => {
    expect(graphics.map((g) => g.src).sort()).toEqual([...files].sort());
    for (const g of graphics) expect(read(g.src)).toMatch(/<svg\s[^>]*viewBox="/);
  });

  it("has unique ids made of the folder and the file name, with a label", () => {
    expect(new Set(graphics.map((g) => g.id)).size).toBe(graphics.length);
    for (const g of graphics) {
      const [, folder, name] = /^\/graphics\/([^/]+)\/(.+)\.svg$/.exec(g.src)!;
      expect(g.category).toBe(folder);
      expect(g.id).toBe(`${folder}-${name}`.toLowerCase());
      expect(g.label.trim()).not.toBe("");
    }
    // One label per category name.
    expect(new Set(categoryLabels.map((c) => c.label)).size).toBe(categoryLabels.length);
  });

  it("knows every template's shape from its viewBox", () => {
    const ratios = graphicSizes as Record<string, number>;
    expect(Object.keys(ratios).sort()).toEqual(graphics.map((g) => g.id).sort());
    for (const g of graphics) {
      const [, , w, h] = viewBox(read(g.src));
      expect(ratios[g.id]).toBeCloseTo(h / w, 3);
    }
  });

  it("has the phone screens (#69) as portrait cards, at the other cards' scale", () => {
    expect(mobile.map((g) => g.label)).toEqual(
      expect.arrayContaining(["Sign In", "Sign Up", "Home Feed", "List", "Detail", "Search", "Profile", "Settings", "Cart", "Checkout", "Tab Bar", "Empty State"])
    );
    for (const g of mobile) {
      const { width, height } = cardSize({ graphicId: g.id });
      expect([g.id, width]).toEqual([g.id, PORTRAIT_CARD_WIDTH]);
      expect(height).toBeGreaterThan(width * 1.8);
      // A unit of the drawing is about as many pixels as on a landscape card.
      const landscape = (CARD_WIDTH - 2) / viewBox(read("/graphics/sign-in/sign-in-1.svg"))[2];
      expect((PORTRAIT_CARD_WIDTH - 2) / viewBox(read(g.src))[2] / landscape).toBeCloseTo(1, 1);
    }
    // Every other template stays a 220px landscape card.
    for (const g of graphics.filter((g) => g.category !== "mobile")) expect(cardSize({ graphicId: g.id }).width).toBe(CARD_WIDTH);
  });

  it("has the flow screens (#86): decisions, emails and wizard steps", () => {
    expect(flow.map((g) => g.label)).toEqual(
      expect.arrayContaining(["Yes / No Choice", "Three-Way Choice", "Email Sent", "Email Confirmed", "Wizard Step 1", "Wizard Step 2", "Wizard Step 3"])
    );
  });

  it("draws the new templates in the existing palette, as plain shapes", () => {
    const palette = new Set(graphics.filter((g) => !isNew(g.category)).flatMap((g) => [...colours(read(g.src))]));
    for (const g of [...mobile, ...flow]) {
      const svg = read(g.src);
      expect([g.id, [...colours(svg)].filter((c) => !palette.has(c))]).toEqual([g.id, []]);
      // Distinct labels in a category, so a search result or the AI can tell them apart.
      expect(graphics.filter((o) => o.category === g.category && o.label === g.label)).toHaveLength(1);
      // Nothing that loads or runs anything.
      expect(svg).not.toMatch(/<script|<image|<foreignObject|href=|url\(|on\w+=/i);
    }
  });
});
