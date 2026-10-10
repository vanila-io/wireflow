// The user's own image as a card (#86, #69): kept only as an image data URL.
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot } from "@/lib/ai/diagram";
import { parseFile, serializeFile } from "@/lib/diagram/file";
import { absoluteBoxes } from "@/lib/diagram/groups";
import { cardSize, IMAGE_RATIO, MAX_IMAGE_CHARS, OWN_IMAGE, type CardNode, type Diagram } from "@/lib/diagram/model";
import { copyItems, pasteItems } from "@/lib/diagram/ops";
import { enforceRules, serialize } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { imageLabel, storageUse } from "@/components/editor/own-image";
import { card, edge, MemoryStorage } from "./helpers";

// A 1x1 JPEG is enough for the rules; they look at the data URL, not the pixels.
const SRC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const image = (id: string, extra: Partial<CardNode["data"]> = {}): CardNode => ({
  id,
  type: "flow",
  position: { x: 0, y: 0 },
  data: { graphicId: OWN_IMAGE, src: SRC, label: "Phone home", headerText: "Phone home", showHeader: true, ratio: 2, ...extra },
});
const withImage = (): Diagram => ({ nodes: [image("p"), card("a", 400, 0)], edges: [edge("pa", "p", "a")] });
const kept = (n: CardNode) => enforceRules({ nodes: [n], edges: [] }).diagram.nodes[0] as CardNode | undefined;

describe("own images", () => {
  it("are kept with their image and ratio, and drawn at the image's shape", () => {
    expect(kept(image("p"))).toEqual(image("p"));
    expect(cardSize(image("p").data)).toEqual({ width: 220, height: 2 + 24 + 218 * 2 });
    expect(cardSize({ ...image("p").data, showHeader: false }).height).toBe(2 + 218 * 2);
  });

  it("are only image data URLs: links, SVG, scripts and oversized data are dropped", () => {
    for (const src of [
      "https://evil.example/x.png",
      "/graphics/article/article-1.svg",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:text/html;base64,PGI+",
      "javascript:alert(1)",
      `${SRC}"onerror="alert(1)`,
      `data:image/jpeg;base64,${"A".repeat(MAX_IMAGE_CHARS)}`,
      42,
    ]) {
      expect(kept(image("p", { src: src as string }))).toBeUndefined();
    }
    expect(enforceRules({ nodes: [image("p", { src: "https://x" })], edges: [] }).dropped.nodes).toBe(1);
  });

  it("keep a ratio within bounds, and a label", () => {
    expect(kept(image("p", { ratio: 99 }))!.data.ratio).toBe(IMAGE_RATIO.max);
    expect(kept(image("p", { ratio: 0 }))!.data.ratio).toBe(IMAGE_RATIO.min);
    expect(kept(image("p", { ratio: "tall" as unknown as number }))!.data.ratio).toBeCloseTo(0.787, 3);
    expect(kept(image("p", { label: "" }))!.data.label).toBe("Image");
  });

  it("take part in connections, copy and paste, and save and open with the image itself", () => {
    expect(enforceRules(withImage()).diagram.edges).toHaveLength(1);
    const d = withImage();
    const { diagram, ids } = pasteItems(d, copyItems(d, ["p"]), { x: 20, y: 20 });
    expect((diagram.nodes.find((n) => n.id === ids[0]) as CardNode).data).toMatchObject({ graphicId: OWN_IMAGE, src: SRC });
    const file = JSON.parse(serializeFile(d));
    expect(file.diagram.nodes[0].data.src).toBe(SRC);
    expect(serialize(parseFile(JSON.stringify(file)).diagram)).toBe(serialize(d));
    // A catalog card still leaves its URL out of the file.
    expect(file.diagram.nodes[1].data).not.toHaveProperty("src");
    const bad = { ...file, diagram: { nodes: [image("p", { src: "https://evil.example/x.png" })], edges: [] } };
    expect(() => parseFile(JSON.stringify(bad))).toThrow(/has an image Wireflow can't show/);
  });

  it("are added as one undo step, selected", () => {
    const store = createDiagramStore({ initial: { nodes: [], edges: [] }, save: () => true });
    store.addImage(SRC, 1.5, "Sketch", { x: 10, y: 20 });
    const [n] = store.getState().nodes as CardNode[];
    expect(n).toMatchObject({ selected: true, position: { x: 10, y: 20 }, data: { graphicId: OWN_IMAGE, src: SRC, label: "Sketch", headerText: "Sketch", ratio: 1.5 } });
    expect(n.id).toMatch(/^own-image-/);
    store.undo();
    expect(store.getState().nodes).toHaveLength(0);
  });

  it("are screens to the AI, which can rename, move and connect them but not create one", () => {
    const s = snapshot({ data: withImage() });
    expect(s.screens[0]).toMatchObject({ id: "p", template: OWN_IMAGE, label: "Phone home" });
    expect(JSON.stringify(s)).not.toContain("base64");
    const plan = planOps({ summary: "", operations: [{ op: "update_screen", id: "p", label: "Home (phone)", header: false }] }, withImage());
    if (plan.errors) throw new Error(JSON.stringify(plan.errors));
    const d = applyActions(withImage(), plan.actions);
    expect((d.nodes[0] as CardNode).data).toMatchObject({ src: SRC, headerText: "Home (phone)", showHeader: false, ratio: 2 });
    // Its height follows its own shape, in the layout check too.
    expect(absoluteBoxes(d.nodes).get("p")!.height).toBe(2 + 218 * 2);
    const add = planOps({ summary: "", operations: [{ op: "add_screen", id: "x", template: OWN_IMAGE, label: "x" }] }, withImage());
    expect(add.errors?.[0].message).toBe(`unknown template "${OWN_IMAGE}"`);
  });

  it("name the card after the file, and count what this site keeps in storage", () => {
    expect(imageLabel("Home screen.PNG")).toBe("Home screen");
    expect(imageLabel(".png")).toBe("Image");
    const storage = new MemoryStorage();
    storage.setItem("ab", "1234");
    storage.setItem("c", "56");
    expect(storageUse(storage)).toBe(9);
  });
});
