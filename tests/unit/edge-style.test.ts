// Edge line shapes and widths (the earlier editor's Edge panel: Smooth,
// Polyline, Polyline Round; width 1 to 10).
import { describe, expect, it } from "vitest";
import { parseFile, serializeFile } from "@/lib/diagram/file";
import { edgeShape, edgeWidth, type Diagram } from "@/lib/diagram/model";
import { updateEdge } from "@/lib/diagram/ops";
import { enforceRules, serialize } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { card, edge } from "./helpers";

const two = (extra = {}): Diagram => ({ nodes: [card("a"), card("b", 0, 300)], edges: [edge("e", "a", "b", extra)] });

describe("edge shapes and widths", () => {
  it("keeps the shapes and widths the editor offers, and nothing else", () => {
    const keep = (e: object) => enforceRules({ nodes: two().nodes, edges: [{ ...edge("e", "a", "b"), ...e }] }).diagram.edges[0];
    expect(keep({ type: "step", style: { strokeWidth: 6 } })).toMatchObject({ type: "step", style: { strokeWidth: 6 } });
    expect(keep({ type: "smoothstep" }).type).toBe("smoothstep");
    // Smooth is React Flow's default type and the default width is 2: neither is stored.
    expect(keep({ type: "default", style: { strokeWidth: 2 } })).not.toHaveProperty("type");
    expect(keep({ type: "default", style: { strokeWidth: 2 } })).not.toHaveProperty("style");
    expect(keep({ style: { strokeWidth: 1 } }).style).toEqual({ strokeWidth: 1 });
    for (const bad of [{ type: "straight" }, { type: "custom-evil" }, { type: 5 }]) expect(keep(bad)).not.toHaveProperty("type");
    for (const w of [0, 11, 2.5, "4", -1]) expect(keep({ style: { strokeWidth: w } })).not.toHaveProperty("style");
    expect(keep({ style: { stroke: "#e8590c", strokeWidth: 10 } }).style).toEqual({ stroke: "#e8590c", strokeWidth: 10 });
  });

  it("reads the shape and width the panel shows", () => {
    expect(edgeShape(edge("e", "a", "b"))).toBe("smooth");
    expect(edgeShape(edge("e", "a", "b", { type: "step" }))).toBe("polyline");
    expect(edgeShape(edge("e", "a", "b", { type: "smoothstep" }))).toBe("polyline-round");
    expect(edgeWidth(edge("e", "a", "b"))).toBe(2);
    expect(edgeWidth(edge("e", "a", "b", { style: { strokeWidth: 7 } }))).toBe(7);
  });

  it("changes shape, width and colour independently", () => {
    let d = updateEdge(two(), "e", { shape: "polyline-round", width: 5 });
    d = updateEdge(d, "e", { color: "#e8590c" });
    expect(d.edges[0]).toMatchObject({ type: "smoothstep", style: { stroke: "#e8590c", strokeWidth: 5 } });
    d = updateEdge(d, "e", { color: null });
    expect(d.edges[0]).toMatchObject({ type: "smoothstep", style: { strokeWidth: 5 } });
    expect(d.edges[0].style).not.toHaveProperty("stroke");
    d = updateEdge(d, "e", { shape: "smooth", width: 2 });
    expect(enforceRules(d).diagram.edges[0]).toEqual(edge("e", "a", "b"));
  });

  it("each change is one undo step, and the same value again adds none", () => {
    const store = createDiagramStore({ initial: two(), save: () => true });
    store.updateEdge("e", { width: 4 });
    store.updateEdge("e", { width: 4 });
    store.updateEdge("e", { shape: "polyline" });
    expect(store.history().past).toHaveLength(2);
    store.undo();
    expect(store.diagram().edges[0]).toMatchObject({ style: { strokeWidth: 4 } });
    expect(store.diagram().edges[0]).not.toHaveProperty("type");
  });

  it("survives a save and open, and old gg-editor files keep their shapes and widths", () => {
    const d = two({ type: "step", style: { strokeWidth: 8 } });
    expect(serialize(parseFile(serializeFile(d)).diagram)).toBe(serialize(d));
    const g6 = {
      nodes: [
        { id: "n1", x: 0, y: 0, template: "E-Commerce/Cart" },
        { id: "n2", x: 0, y: 300, template: "Misc/Error" },
      ],
      edges: [
        { id: "round", source: "n1", target: "n2", shape: "flow-polyline-round", style: { lineWidth: 2 } },
        { id: "poly", source: "n1", target: "n2", shape: "flow-polyline", style: { lineWidth: 6 } },
        { id: "smooth", source: "n1", target: "n2", shape: "flow-smooth", style: { lineWidth: 1 } },
        { id: "bare", source: "n1", target: "n2" },
      ],
      groups: [],
    };
    const byId = Object.fromEntries(parseFile(JSON.stringify(g6)).diagram.edges.map((e) => [e.id, e]));
    expect([edgeShape(byId.round), edgeWidth(byId.round)]).toEqual(["polyline-round", 2]);
    expect([edgeShape(byId.poly), edgeWidth(byId.poly)]).toEqual(["polyline", 6]);
    expect([edgeShape(byId.smooth), edgeWidth(byId.smooth)]).toEqual(["smooth", 1]);
    // No width: the default, 2px, as the earlier editor drew it.
    expect([edgeShape(byId.bare), edgeWidth(byId.bare)]).toEqual(["smooth", 2]);
  });
});
