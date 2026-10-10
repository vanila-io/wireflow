import { describe, expect, it } from "vitest";
import { DiagramFileError, MAX_NODES, parseFile, serializeFile } from "@/lib/diagram/file";
import { legacyGraphic, SCALE } from "@/lib/diagram/legacy";
import { absoluteBoxes } from "@/lib/diagram/groups";
import { cardSize, isCard, isGroup, type CardNode, type Diagram } from "@/lib/diagram/model";
import { copyItems, pasteItems } from "@/lib/diagram/ops";
import { serialize } from "@/lib/diagram/rules";
import legacyTemplates from "@/lib/legacy-templates.json";
import graphics from "@/lib/graphics.json";
import { card, edge, PRODUCTION_SAMPLE } from "./helpers";

const sample = (): Diagram => ({
  nodes: [
    card("a", 0, 0),
    {
      ...card("b", 300, 0),
      data: {
        graphicId: "e-commerce-cart",
        src: "/graphics/e-commerce/cart.svg",
        label: "Cart",
        headerText: "Basket",
        showHeader: false,
      },
    },
    card("c", 600, 300),
  ],
  edges: [
    edge("ab", "a", "b", {
      label: "Buy",
      style: { stroke: "#e8590c" },
      markerEnd: { type: "arrowclosed", color: "#e8590c" },
    }),
    edge("bc", "b", "c"),
  ],
});

const reject = (text: string, message: RegExp) => {
  expect(() => parseFile(text)).toThrow(DiagramFileError);
  expect(() => parseFile(text)).toThrow(message);
};

describe("wireflow.json", () => {
  it("writes a versioned file that names templates by id, without image URLs", () => {
    const file = JSON.parse(serializeFile(sample()));
    expect(file).toMatchObject({ format: "wireflow", version: 3 });
    expect(file.diagram.nodes.map((n: { data: { graphicId: string } }) => n.data.graphicId)).toEqual([
      "article-article-1",
      "e-commerce-cart",
      "article-article-1",
    ]);
    expect(JSON.stringify(file)).not.toContain("/graphics/");
  });

  it("opens what it saves, unchanged, including pasted copies and hidden headers", () => {
    const d = sample();
    const { diagram, dropped } = parseFile(serializeFile(d));
    expect(serialize(diagram)).toBe(serialize(d));
    expect(dropped).toEqual({ nodes: 0, edges: 0 });
    const pasted = pasteItems(d, copyItems(d, ["a", "b"]), { x: 40, y: 40 }).diagram;
    expect(serialize(parseFile(serializeFile(pasted)).diagram)).toBe(serialize(pasted));
  });

  it("opens Export JSON from before this change (plain React Flow {nodes, edges})", () => {
    const { diagram } = parseFile(JSON.stringify(PRODUCTION_SAMPLE));
    expect(diagram.nodes.map((n) => n.id)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.id));
    expect((diagram.nodes[1] as CardNode).data.headerText).toBe("My cart");
    expect(diagram.edges).toHaveLength(1);
  });

  it("drops connections with a missing end and says how many", () => {
    const d = { nodes: [card("a"), card("b")], edges: [edge("ok", "a", "b"), edge("x", "a", "gone")] };
    const { diagram, dropped } = parseFile(JSON.stringify(d));
    expect(diagram.edges.map((e) => e.id)).toEqual(["ok"]);
    expect(dropped.edges).toBe(1);
  });

  it("drops __proto__ keys, so a file cannot change Object.prototype", () => {
    const text = `{"nodes":[{"id":"a","type":"flow","position":{"x":0,"y":0},"data":{"graphicId":"article-article-1","__proto__":{"polluted":true}},"__proto__":{"polluted":true}}],"edges":[]}`;
    const { diagram } = parseFile(text);
    expect(diagram.nodes).toHaveLength(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(diagram)).not.toContain("polluted");
  });

  it("rejects files that aren't Wireflow diagrams, or are newer", () => {
    reject("not json", /isn't a JSON file/);
    reject('{"name":"wireflow","version":"1.0.0"}', /doesn't contain a Wireflow diagram/);
    reject('{"format":"excalidraw","version":2,"elements":[]}', /isn't a Wireflow file/);
    reject('{"format":"wireflow","version":4,"diagram":{"nodes":[],"edges":[]}}', /newer version/);
    reject('{"format":"wireflow","version":"2","diagram":{"nodes":[],"edges":[]}}', /unknown file version/);
    reject('{"format":"wireflow","version":2}', /doesn't contain a Wireflow diagram/);
  });

  it("rejects diagrams the editor could not show or that would hang the tab", () => {
    const file = (nodes: unknown[], edges: unknown[] = []) =>
      JSON.stringify({ format: "wireflow", version: 2, diagram: { nodes, edges } });
    reject(file([{ ...card("a"), id: 1 }]), /id is missing or isn't text/);
    reject(file([card("a"), card("a")]), /more than one item with the id "a"/);
    reject(file([card("a")], [edge("a", "a", "a")]), /more than one item with the id "a"/);
    reject(file([{ ...card("a"), position: { x: "left" } }]), /has no position/);
    reject(file([{ ...card("a"), data: { graphicId: "no-such-template" } }]), /doesn't have: "no-such-template"/);
    reject(file([{ ...card("a"), data: { graphicId: "article-article-1", label: 5 } }]), /label that isn't text/);
    reject(file([{ ...card("a"), type: "input" }]), /isn't a card, a note or a group/);
    reject(file([{ ...card("a"), parentId: "nope" }]), /in a group that doesn't exist/);
    reject(file([card("b"), { ...card("a"), parentId: "b" }]), /in a group that doesn't exist/);
    const g = (id: string, parentId?: string) => ({ id, type: "group", position: { x: 0, y: 0 }, parentId, data: {} });
    reject(file([g("g1", "g2"), g("g2", "g1")]), /inside itself/);
    reject(file([{ ...g("g1"), data: { label: 5 } }]), /label that isn't text/);
    reject(file(Array.from({ length: MAX_NODES + 1 }, (_, i) => card(`n${i}`))), /more items than Wireflow can show/);
  });
});

describe("files from the earlier gg-editor app (G6)", () => {
  // A file saved by #109: template keys, a group, a coloured edge and a loose
  // edge that the old editor allowed.
  const v1 = {
    format: "wireflow",
    version: 1,
    diagram: {
      nodes: [
        {
          type: "node",
          size: [96, 88],
          label: "Sign in",
          x: 100,
          y: 100,
          id: "3a85f3e3",
          shape: "node-image-header",
          template: "Sign in/Sign in 1",
          parent: "grp1",
        },
        {
          type: "node",
          size: [96, 78],
          label: "Cart",
          x: 300,
          y: 100,
          id: "24e3e373",
          shape: "node-image-without-header",
          template: "E-Commerce/Cart",
          parent: "grp1",
        },
        {
          type: "node",
          size: [96, 88],
          label: "Thanks",
          x: 500,
          y: 300,
          id: "aa000001",
          shape: "node-image-header",
          template: "Misc/Error",
        },
      ],
      edges: [
        {
          source: "3a85f3e3",
          sourceAnchor: 1,
          target: "24e3e373",
          targetAnchor: 3,
          shape: "flow-polyline-round",
          color: "#E8590C",
          style: { lineWidth: 2 },
          id: "13396ba6",
          label: "Add",
        },
        { source: "24e3e373", target: "aa000001", color: "#a4b2c0", id: "e2" },
        { source: "24e3e373", target: { x: 300, y: 560 }, id: "loose" },
      ],
      groups: [{ id: "grp1", label: "Shop", x: 42, y: 50 }],
    },
  };

  it("maps every old template key to one of the graphics, one to one", () => {
    const ids = Object.values(legacyTemplates);
    expect(new Set(ids).size).toBe(graphics.length);
    expect(new Set(ids)).toEqual(new Set(graphics.map((g) => g.id)));
  });

  it("opens #109's version 1 files, scaling the layout and keeping their groups", () => {
    expect(legacyGraphic({ template: "Misc/Error" })).toBeDefined();
    const { diagram, dropped } = parseFile(JSON.stringify(v1));
    expect(dropped.edges).toBe(1);
    const group = diagram.nodes.find(isGroup)!;
    expect(group).toMatchObject({ id: "grp1", type: "group", data: { label: "Shop" } });
    const byId = Object.fromEntries(diagram.nodes.filter(isCard).map((n) => [n.id, n]));
    expect(byId["3a85f3e3"].data).toMatchObject({
      graphicId: "sign-in-sign-in-1",
      headerText: "Sign in",
      showHeader: true,
    });
    expect(byId["24e3e373"].data).toMatchObject({
      graphicId: "e-commerce-cart",
      headerText: "Cart",
      showHeader: false,
    });
    // Centres scale by 220/96 around the origin; group members stay where they
    // were on the canvas, inside their group, whose frame wraps them.
    const boxes = absoluteBoxes(diagram.nodes);
    for (const n of v1.diagram.nodes) {
      const { width, height } = cardSize(byId[n.id].data);
      expect(boxes.get(n.id)!.x + width / 2).toBeCloseTo(n.x * SCALE);
      expect(boxes.get(n.id)!.y + height / 2).toBeCloseTo(n.y * SCALE);
      expect(byId[n.id].parentId).toBe(n.parent);
    }
    const frame = boxes.get("grp1")!;
    for (const id of ["3a85f3e3", "24e3e373"]) {
      const b = boxes.get(id)!;
      expect(b.x).toBeGreaterThan(frame.x);
      expect(b.y).toBeGreaterThan(frame.y);
      expect(b.x + b.width).toBeLessThan(frame.x + frame.width);
      expect(b.y + b.height).toBeLessThan(frame.y + frame.height);
    }
    // Groups survive a save and open in the current format.
    expect(serialize(parseFile(serializeFile(diagram)).diagram)).toBe(serialize(diagram));
    const [colored, plain] = diagram.edges;
    expect(colored).toMatchObject({
      id: "13396ba6",
      label: "Add",
      style: { stroke: "#e8590c" },
      markerEnd: { color: "#e8590c" },
    });
    // The old default colour becomes the new default (no colour of its own).
    expect(plain).toEqual({ id: "e2", source: "24e3e373", target: "aa000001", markerEnd: { type: "arrowclosed" } });
  });

  it("opens a plain G6 diagram with image URLs of any earlier build", () => {
    const plain = {
      nodes: [
        { id: "n1", x: 10, y: 10, shape: "node-image-header", img: "/static/media/Cart.2ae03932.svg", label: "Cart" },
        {
          id: "n2",
          x: 200,
          y: 10,
          shape: "node-image-header",
          img: "/assets/Sign%20Up%201-BfX1a2b3.svg",
          label: "Join",
        },
        { id: "n3", x: 400, y: 10, img: "https://app.wireflow.co/static/media/Article 1.5e1c7a0b.svg" },
        { id: "n4", x: 600, y: 10, img: "/graphics/blog/articles-2.svg" },
      ],
      edges: [{ id: "e", source: "n1", target: "n2" }],
    };
    const { diagram } = parseFile(JSON.stringify(plain));
    expect(diagram.nodes.filter(isCard).map((n) => n.data.graphicId)).toEqual([
      "e-commerce-cart",
      "sign-in-sign-up-1",
      "article-article-1",
      "blog-articles-2",
    ]);
    expect(diagram.edges).toHaveLength(1);
  });

  it("rejects old files with unknown templates or a group inside itself", () => {
    const bad = structuredClone(v1);
    bad.diagram.nodes[0].template = "Misc/Spaceship";
    reject(JSON.stringify(bad), /doesn't have: "Misc\/Spaceship"/);
    const custom = { nodes: [{ id: "n", x: 0, y: 0, img: "https://example.com/x.png" }], edges: [] };
    reject(JSON.stringify(custom), /doesn't show one of Wireflow's screen templates/);
    const loop = {
      nodes: [],
      edges: [],
      groups: [
        { id: "a", parent: "b" },
        { id: "b", parent: "a" },
      ],
    };
    reject(JSON.stringify(loop), /inside itself/);
  });
});
