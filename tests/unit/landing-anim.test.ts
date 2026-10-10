import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bezier } from "@/components/landing/anim/parts";

// The landing page's animated illustrations (components/landing/anim) are
// drawn in the editor's colours only: its tokens (app/globals.css), the
// colours its components use (components/editor), and the template graphics'
// own palette (public/graphics). The README banners' gg-editor outline and
// blue are not used for anything drawn there.

const root = join(__dirname, "..", "..");
const files = (dir: string, ext: RegExp): string[] =>
  readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => ext.test(f))
    .map((f) => join(root, dir, f));
const read = (paths: string[]) => paths.map((p) => readFileSync(p, "utf8")).join("\n");

// Every #rgb / #rrggbb colour, as lower-case #rrggbb.
function hexes(text: string): Set<string> {
  const found = new Set<string>();
  for (const [, h] of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    const six = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    found.add(`#${six.toLowerCase()}`);
  }
  return found;
}

const anim = read(files("components/landing/anim", /\.(tsx|css)$/));
const editor = new Set([
  ...hexes(read([join(root, "app/globals.css")])),
  ...hexes(read(files("components/editor", /\.(tsx|ts|css)$/))),
  ...hexes(read(files("lib/diagram", /\.ts$/))),
  ...hexes(read(files("public/graphics", /\.svg$/))),
]);

describe("the landing's animated illustrations", () => {
  it("use only the editor's colours", () => {
    const used = [...hexes(anim)];
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((c) => !editor.has(c))).toEqual([]);
  });

  it("don't draw in the README banners' gg-editor colours", () => {
    expect([...hexes(anim)].filter((c) => ["#34495e", "#22a6ef"].includes(c))).toEqual([]);
  });

  it("draw connections as React Flow's default bezier does", () => {
    // Downwards: control points half the distance below and above.
    expect(bezier(0, 0, 100, 100).d).toBe("M0 0C0 50 100 50 100 100");
    // Upwards (a card beside another): React Flow's curvature 0.25 offset.
    expect(bezier(0, 100, 100, 0).d).toBe("M0 100C0 162.5 100 -62.5 100 0");
    expect(bezier(0, 0, 100, 100).mid).toEqual({ x: 50, y: 50 });
  });
});
