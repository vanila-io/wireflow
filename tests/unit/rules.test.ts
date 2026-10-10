import { describe, expect, it } from "vitest";
import { dropProto, enforceRules, serialize } from "@/lib/diagram/rules";
import { card, edge, group, PRODUCTION_EDGE, PRODUCTION_SAMPLE } from "./helpers";

const ids = (items: { id: string }[]) => items.map((i) => i.id).sort();

describe("diagram rules (the save boundary)", () => {
  it("keeps a diagram saved by the editor as it is, minus selection, measurements and handle ids", () => {
    const { diagram, dropped } = enforceRules(PRODUCTION_SAMPLE);
    expect(dropped).toEqual({ nodes: 0, edges: 0 });
    expect(diagram.nodes).toHaveLength(2);
    const [a, b] = diagram.nodes;
    expect(a).toEqual({
      id: PRODUCTION_SAMPLE.nodes[0].id,
      type: "flow",
      position: { x: 180, y: 50 },
      data: PRODUCTION_SAMPLE.nodes[0].data,
    });
    expect(b.data).toEqual(PRODUCTION_SAMPLE.nodes[1].data);
    expect(b).not.toHaveProperty("selected");
    expect(b).not.toHaveProperty("measured");
    expect(diagram.edges).toEqual([PRODUCTION_EDGE]);
  });

  // #107: an edge must connect two real cards, whatever produced it.
  it("drops edges that do not connect two existing nodes", () => {
    const input = {
      nodes: [card("a"), card("b")],
      edges: [
        edge("ok", "a", "b"),
        edge("to-point", "a", { x: 500, y: 520 } as unknown as string),
        edge("to-missing", "a", "gone"),
        edge("to-edge", "a", "ok"),
        { id: "no-target", source: "a" },
        { source: "a", target: "b" },
      ],
    };
    const { diagram, dropped } = enforceRules(input);
    expect(ids(diagram.edges)).toEqual(["ok"]);
    expect(dropped.edges).toBe(5);
    // The input is not changed.
    expect(input.edges).toHaveLength(6);
  });

  it("requires string ids, unique across nodes and edges", () => {
    const { diagram, dropped } = enforceRules({
      nodes: [card("a"), { ...card("x"), id: 7 }, card("a", 50), { ...card("y"), id: "" }],
      edges: [edge("a", "a", "a"), { ...edge("n", "a", "a"), id: 3 }],
    });
    expect(ids(diagram.nodes)).toEqual(["a"]);
    expect(diagram.nodes[0].position.x).toBe(0);
    expect(diagram.edges).toEqual([]);
    expect(dropped).toEqual({ nodes: 3, edges: 2 });
  });

  it("drops cards without a known template or a position, and unknown node types", () => {
    const { diagram, dropped } = enforceRules({
      nodes: [
        card("a"),
        { ...card("b"), data: { ...card("b").data, graphicId: "not-a-template" } },
        { ...card("c"), position: { x: Infinity, y: 0 } },
        { ...card("d"), type: "input" },
        { ...group("e"), position: { x: 0, y: NaN } },
      ],
      edges: [],
    });
    expect(ids(diagram.nodes)).toEqual(["a"]);
    expect(dropped.nodes).toBe(4);
  });

  it("cuts parent links to missing items, to cards, and in loops; parents come first", () => {
    const { diagram, dropped } = enforceRules({
      nodes: [
        card("in-g2", 10, 40, { parentId: "g2" }),
        group("g2", 20, 40, { parentId: "g1" }),
        group("g1", 100, 100),
        card("orphan", 0, 0, { parentId: "nope" }),
        card("in-card", 0, 0, { parentId: "orphan" }),
        group("loop-a", 0, 0, { parentId: "loop-b" }),
        group("loop-b", 0, 0, { parentId: "loop-a" }),
      ],
      edges: [],
    });
    const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));
    expect(byId.orphan.parentId).toBeUndefined();
    expect(byId["in-card"].parentId).toBeUndefined();
    expect(byId["in-g2"].parentId).toBe("g2");
    // A loop is broken, and following parents always ends.
    for (const n of diagram.nodes) {
      const seen = new Set<string>();
      for (let p = n.parentId; p !== undefined; p = byId[p].parentId) {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    }
    expect(dropped.parents).toBe(3);
    const order = diagram.nodes.map((n) => n.id);
    expect(order.indexOf("g1")).toBeLessThan(order.indexOf("g2"));
    expect(order.indexOf("g2")).toBeLessThan(order.indexOf("in-g2"));
  });

  it("keeps a group's label and size, gives a group without a size the default frame, and drops connections to groups", () => {
    const { diagram, dropped } = enforceRules({
      nodes: [
        group("g", 0, 0, { width: 600, height: 300, data: { label: "Checkout" } }),
        { ...group("bare"), data: {} },
        card("a", 20, 40, { parentId: "g" }),
        card("b", 900, 0),
      ],
      edges: [edge("ok", "a", "b"), edge("to-group", "b", "g")],
    });
    const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));
    expect(byId.g).toMatchObject({ type: "group", width: 600, height: 300, data: { label: "Checkout" } });
    expect(byId.bare).toMatchObject({ width: 252, height: 120, data: { label: "Group" } });
    expect(diagram.edges.map((e) => e.id)).toEqual(["ok"]);
    expect(dropped).toEqual({ nodes: 0, edges: 1 });
  });

  it("always takes the image URL from the catalog", () => {
    const evil = { ...card("a"), data: { ...card("a").data, src: "https://evil.example/track.png" } };
    expect(enforceRules({ nodes: [evil], edges: [] }).diagram.nodes[0].data).toMatchObject({
      src: "/graphics/article/article-1.svg",
    });
  });

  it("keeps no __proto__ keys and no unknown fields", () => {
    const parsed = JSON.parse(
      '{"nodes":[{"id":"a","type":"flow","position":{"x":1,"y":2,"__proto__":{"polluted":1}},"data":{"graphicId":"article-article-1","label":"A","__proto__":{"polluted":1}},"__proto__":{"polluted":1},"extra":1}],"edges":[]}'
    );
    const json = serialize(enforceRules(parsed).diagram);
    expect(json).not.toContain("__proto__");
    expect(json).not.toContain("extra");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // The reviver drops them while parsing.
    const revived = JSON.parse('{"a":{"__proto__":{"x":1}}}', dropProto);
    expect(Object.keys(revived.a)).toEqual([]);
  });

  it("keeps edge labels and opaque hex colours only", () => {
    const { diagram } = enforceRules({
      nodes: [card("a"), card("b")],
      edges: [
        edge("c", "a", "b", { label: "Sign in", style: { stroke: "#E8590C" } }),
        edge("d", "a", "b", { style: { stroke: "url(javascript:alert(1))" } }),
        edge("e", "a", "b", { style: { stroke: "#e8590c80" } }),
      ],
    });
    expect(diagram.edges[0]).toEqual({
      id: "c",
      source: "a",
      target: "b",
      label: "Sign in",
      style: { stroke: "#e8590c" },
      markerEnd: { type: "arrowclosed", color: "#e8590c" },
    });
    expect(diagram.edges[1]).toEqual(edge("d", "a", "b"));
    expect(diagram.edges[2]).toEqual(edge("e", "a", "b"));
  });

  it("accepts anything without throwing", () => {
    for (const input of [null, undefined, 1, "x", [], { nodes: "x" }, { nodes: [null, 1, "a"], edges: [null] }]) {
      expect(enforceRules(input).diagram).toEqual(
        expect.objectContaining({ nodes: expect.any(Array), edges: expect.any(Array) })
      );
    }
  });
});
