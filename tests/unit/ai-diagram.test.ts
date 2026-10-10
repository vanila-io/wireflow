// Ported from #105 (diagram.test.js, layout.test.js) via #113, against the
// editor's React Flow diagram, plus tests of the apply layer.
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot, type Action } from "@/lib/ai/diagram";
import { catalogText, templateExists } from "@/lib/ai/catalog";
import { layoutIssues, type Screen } from "@/lib/ai/layout";
import { runRequest } from "@/lib/ai/agent";
import { systemPrompt } from "@/lib/ai/prompt";
import { absoluteBoxes, GROUP_PADDING } from "@/lib/diagram/groups";
import { cardSize, isGroup, type CardNode, type Diagram } from "@/lib/diagram/model";
import { groupItems } from "@/lib/diagram/ops";
import { enforceRules } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { stepState } from "@/lib/diagram/history";
import type { Chat, Turn } from "@/lib/ai/providers/types";
import { card, edge } from "./helpers";

const H = cardSize({ graphicId: "e-commerce-cart" }).height;
const at = (id: string, graphicId: string, cx: number, cy: number) => {
  const { width, height } = cardSize({ graphicId });
  return {
    ...card(id, cx - width / 2, cy - height / 2),
    data: { graphicId, src: "", label: graphicId, headerText: graphicId, showHeader: true },
  };
};
const base = (): Diagram => ({
  nodes: [
    at("a", "e-commerce-cart", 200, 200),
    at("b", "e-commerce-checkout", 600, 200),
    at("c", "misc-404", 900, 200),
  ],
  edges: [edge("e1", "a", "b")],
});
const centreOf = (d: Diagram, id: string) => {
  const b = absoluteBoxes(d.nodes).get(id)!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const cardData = (d: Diagram, id: string) => (d.nodes.find((n) => n.id === id) as CardNode).data;

const ok = (ops: unknown[], data = base()) => {
  const r = planOps({ summary: "s", operations: ops }, data);
  expect(r.errors).toBeUndefined();
  if (r.errors) throw new Error("planned with errors");
  return r;
};
const bad = (ops: unknown[], data = base()) => {
  const r = planOps({ summary: "s", operations: ops }, data);
  expect(r.errors?.length).toBeGreaterThan(0);
  return r.errors!;
};

describe("catalog and prompt", () => {
  it("lists the 125 templates by their stable ids", () => {
    expect(catalogText().split("\n")).toHaveLength(125);
    expect(catalogText()).toContain("e-commerce-cart | E-Commerce | Cart");
    // The phone screens (#69) and the flow screens (#86).
    expect(catalogText()).toContain("mobile-sign-in | Mobile | Sign In");
    expect(catalogText()).toContain("flow-yes-no | Flow | Yes / No Choice");
    expect(templateExists("e-commerce-cart")).toBe(true);
    expect(templateExists("https://evil.example/x.svg")).toBe(false);
  });

  it("keeps the system prompt the same for every request, so it can be cached", () => {
    expect(systemPrompt()).toBe(systemPrompt());
    expect(systemPrompt()).toContain("e-commerce-cart | E-Commerce | Cart");
    // Groups are explained, with the frame's real padding (#105's hidden-screen fix).
    expect(systemPrompt()).toContain(`plus ${GROUP_PADDING.top} px above for the title`);
    // Portrait cards get their own size (#69).
    expect(systemPrompt()).toContain("drawn portrait: 124 px wide and about 250 px tall");
  });

  it("places a mobile screen by its portrait size, and warns when it overlaps", () => {
    const r = ok([{ op: "add_screen", id: "m", template: "mobile-cart", label: "Cart", x: 200, y: 600, header: true }]);
    const d = applyActions(base(), r.actions);
    const box = absoluteBoxes(d.nodes).get("m")!;
    expect(box.width).toBe(124);
    expect(box.height).toBeCloseTo(2 + 24 + 122 * (440 / 240), 1);
    expect(box.x + box.width / 2).toBe(200);
    expect(box.y + box.height / 2).toBeCloseTo(600, 6);
    // 124 px wide: beside a desktop card 180 px away (centre to centre) it doesn't overlap...
    expect(ok([{ op: "add_screen", id: "m", template: "mobile-cart", label: "Cart", x: 372, y: 200, header: true }]).warnings).toEqual([]);
    // ...but a desktop-sized screen there would.
    expect(ok([{ op: "add_screen", id: "m", template: "misc-404", label: "x", x: 372, y: 200, header: true }]).warnings.length).toBe(1);
  });
});

describe("snapshot", () => {
  it("is compact, uses template ids and canvas centres", () => {
    const view = { x: 0, y: 0, width: 900, height: 800 };
    const s = snapshot({ data: base(), selected: ["a"], view });
    expect(s.selected).toEqual(["a"]);
    expect(s.view).toEqual(view);
    expect(s.screens.find((x) => x.id === "b")).toEqual({
      id: "b",
      template: "e-commerce-checkout",
      label: "e-commerce-checkout",
      x: 600,
      y: 200,
      header: true,
      group: null,
    });
    expect(s.connections).toEqual([{ id: "e1", from: "a", to: "b", label: "" }]);
    expect(s.groups).toEqual([]);
  });
});

describe("planOps", () => {
  it("validates new screens and connections and plans them", () => {
    const { actions } = ok([
      { op: "add_screen", id: "login", template: "sign-in-sign-in-1", label: "Login", x: 200, y: 600 },
      { op: "connect", id: "to_cart", from: "login", to: "a", label: "Sign in" },
    ]);
    expect(actions).toEqual([
      { kind: "add_screen", id: "login", template: "sign-in-sign-in-1", label: "Login", x: 200, y: 600, header: true },
      { kind: "connect", id: "to_cart", from: "login", to: "a", label: "Sign in" },
    ]);
  });

  it("auto-places screens without coordinates to the right of the diagram", () => {
    const { placed } = ok([
      { op: "add_screen", id: "p", template: "e-commerce-cart", label: "P" },
      { op: "add_screen", id: "q", template: "e-commerce-cart", label: "Q", x: null, y: null },
    ]);
    expect(placed).toEqual({ p: [1200, 200], q: [1500, 200] });
  });

  it("rejects the whole batch on any error", () => {
    expect(
      bad([
        { op: "add_screen", id: "ok1", template: "e-commerce-cart", label: "x", x: 0, y: 0 },
        { op: "connect", id: "e2", from: "ok1", to: "nope" },
      ])
    ).toEqual([{ index: 1, op: "connect", message: 'no screen or note "nope"' }]);
  });

  it("rejects bad ids, templates, urls, fields and values", () => {
    bad([{ op: "add_screen", id: "a", template: "e-commerce-cart", label: "dup" }]);
    bad([{ op: "add_screen", id: "1x", template: "e-commerce-cart", label: "x" }]);
    bad([{ op: "add_screen", id: "x", template: "https://evil/x.svg", label: "x" }]);
    bad([{ op: "add_screen", id: "x", template: "e-commerce-cart", label: "x", img: "https://evil/x.svg" }]);
    bad([{ op: "add_screen", id: "x", template: "e-commerce-cart", label: "x", x: Infinity }]);
    bad([{ op: "add_screen", id: "__proto__", template: "e-commerce-cart", label: "x" }]);
    bad([{ op: "update_connection", id: "e1", color: "red" }]);
    bad([{ op: "update_connection", id: "e1", width: 3 }]);
    bad([{ op: "connect", id: "self", from: "a", to: "a" }]);
    bad([{ op: "add_screen", id: "x", template: "e-commerce-cart", label: "x" }, { op: "clear" }]);
    bad([{ op: "group", id: "g", label: "G", members: ["a"] }]);
    bad([{ op: "group", id: "g", label: "G", members: ["a", "nope"] }]);
    bad([{ op: "group", id: "a", label: "G", members: ["b", "c"] }]);
    bad([{ op: "ungroup", id: "a" }]);
    bad([{ op: "frobnicate" }]);
    bad([null]);
    bad([]);
    expect(planOps(null, base()).errors).toBeDefined();
  });

  it("tracks removals within a batch", () => {
    bad([
      { op: "remove", ids: ["a"] },
      { op: "connect", id: "e9", from: "a", to: "b" },
    ]);
    bad([
      { op: "remove", ids: ["a"] },
      { op: "update_connection", id: "e1", label: "x" },
    ]);
  });

  // Review finding (#113): these batches were refused as a whole.
  it("accepts removing ids that an earlier id of the same batch already removed", () => {
    const plan = ok([
      { op: "remove", ids: ["a", "e1"] },
      { op: "remove", ids: ["b", "c"] },
    ]);
    expect(applyActions(base(), plan.actions)).toEqual({ nodes: [], edges: [] });
    bad([{ op: "remove", ids: ["a", "never-existed"] }]);
  });

  it("cleans labels", () => {
    const { actions } = ok([{ op: "update_screen", id: "a", label: `  hi\u0000there${"x".repeat(200)}` }]);
    const label = (actions[0] as Extract<Action, { kind: "update_screen" }>).label!;
    expect(label).toMatch(/^hi there/);
    expect(label.length).toBe(80);
  });

  // Review pass findings.
  it("keeps a diagram that is already over the screen limit editable, but doesn't let a batch grow it", () => {
    const big: Diagram = {
      nodes: Array.from({ length: 301 }, (_, i) => at(`s${i}`, "misc-404", i * 300, 0)),
      edges: [],
    };
    ok([{ op: "update_screen", id: "s0", label: "First" }], big);
    ok([{ op: "remove", ids: ["s1"] }], big);
    expect(bad([{ op: "add_screen", id: "more", template: "misc-404", label: "M", x: 0, y: 900 }], big)).toEqual([
      { index: -1, op: null, message: "diagram would exceed 300 screens" },
    ]);
  });

  it("after a clear, an id from before the clear is unknown", () => {
    expect(bad([{ op: "clear" }, { op: "remove", ids: ["a"] }])).toEqual([
      { index: 1, op: "remove", message: 'no screen, note, connection or group "a"' },
    ]);
  });

  it("an empty label shows the template's label, and the default colour is no colour of its own", () => {
    const d = applyActions(
      base(),
      ok([
        { op: "add_screen", id: "n", template: "misc-404", label: "", x: 0, y: 900 },
        { op: "update_screen", id: "a", label: "  " },
        { op: "update_connection", id: "e1", color: "#E8590C" },
        { op: "update_connection", id: "e1", color: "#A3A8C3" },
      ]).actions
    );
    expect(cardData(d, "n").headerText).toBe("Not Found 404");
    expect(cardData(d, "a").headerText).toBe("e-commerce-cart");
    expect(d.edges[0]).toEqual(edge("e1", "a", "b"));
  });
});

describe("layout warnings", () => {
  const s = (x: number, y: number, parent: string | null = null): Screen => ({ x, y, size: [220, H], parent });

  it("finds overlapping screens, not ones that only touch", () => {
    expect([
      ...layoutIssues(
        new Map([
          ["a", s(0, 0)],
          ["b", s(100, 0)],
        ]),
        new Map()
      ).keys(),
    ]).toEqual(["screens:a|b"]);
    expect(
      layoutIssues(
        new Map([
          ["a", s(0, 0)],
          ["b", s(220, 0)],
        ]),
        new Map()
      ).size
    ).toBe(0);
  });

  it("reports only problems the batch creates, and still applies it", () => {
    const stacked: Diagram = {
      nodes: [at("a", "e-commerce-cart", 0, 0), at("b", "e-commerce-cart", 10, 0)],
      edges: [],
    };
    expect(ok([{ op: "update_screen", id: "a", label: "A" }], stacked).warnings).toEqual([]);
    const plan = ok([{ op: "add_screen", id: "c", template: "e-commerce-cart", label: "C", x: 20, y: 0 }], stacked);
    expect(plan.warnings).toEqual(['screens "a" and "c" overlap', 'screens "b" and "c" overlap']);
    // A follow-up that moves the screen away has none.
    const placed = applyActions(stacked, plan.actions);
    expect(ok([{ op: "update_screen", id: "c", y: 600 }], placed).warnings).toEqual([]);
  });
});

describe("groups (#105's group and ungroup operations)", () => {
  // a on its own; b and c in group g.
  const grouped = (): Diagram => groupItems(base(), ["b", "c"], { id: "g", label: "Pay" });

  it("shows groups and membership in the snapshot", () => {
    const s = snapshot({ data: grouped() });
    expect(s.screens.find((x) => x.id === "b")).toMatchObject({ x: 600, y: 200, group: "g" });
    expect(s.screens.find((x) => x.id === "a")).toMatchObject({ group: null });
    expect(s.groups).toEqual([{ id: "g", label: "Pay", parent: null }]);
    // The group itself is not a screen.
    expect(s.screens.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("only groups members that share a parent, and tracks groups within a batch", () => {
    bad([{ op: "group", id: "g2", label: "x", members: ["a", "b"] }], grouped());
    ok([{ op: "group", id: "g2", label: "x", members: ["b", "c"] }], grouped());
    ok([{ op: "group", id: "outer", label: "x", members: ["g", "a"] }], grouped());
    bad([{ op: "remove", ids: ["g"] }, { op: "update_screen", id: "b", label: "x" }], grouped());
    ok(
      [
        { op: "ungroup", id: "g" },
        { op: "update_screen", id: "b", label: "x" },
        { op: "group", id: "g2", label: "All", members: ["a", "b", "c"] },
      ],
      grouped()
    );
  });

  it("applies group and ungroup; removing a group removes its screens and their connections", () => {
    const d = applyActions(base(), ok([{ op: "group", id: "auth", label: "Auth", members: ["a", "b"] }]).actions);
    expect(isGroup(d.nodes.find((n) => n.id === "auth")!)).toBe(true);
    expect(d.nodes.filter((n) => n.parentId === "auth").map((n) => n.id)).toEqual(["a", "b"]);
    // Members stay where they were.
    expect(centreOf(d, "a")).toEqual({ x: 200, y: 200 });
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0 });
    const un = applyActions(d, ok([{ op: "ungroup", id: "auth" }], d).actions);
    expect(un.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(centreOf(un, "b")).toEqual({ x: 600, y: 200 });
    const removed = applyActions(grouped(), ok([{ op: "remove", ids: ["g"] }], grouped()).actions);
    expect(removed.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(removed.edges).toEqual([]);
  });

  it("moves a screen inside a group to the given canvas centre, and its frame follows", () => {
    const d = applyActions(grouped(), ok([{ op: "update_screen", id: "c", x: 1200, y: 500 }], grouped()).actions);
    expect(centreOf(d, "c")).toEqual({ x: 1200, y: 500 });
    const frame = absoluteBoxes(d.nodes).get("g")!;
    expect(frame.x + frame.width).toBeCloseTo(1200 + 110 + GROUP_PADDING.right);
  });

  it("warns when a group's frame covers a screen that isn't in it (#105), and not once it is moved out", () => {
    const s = (x: number, y: number, parent: string | null = null): Screen => ({ x, y, size: [220, H], parent });
    const inside = layoutIssues(
      new Map([
        ["m1", s(0, 0, "g")],
        ["m2", s(300, 0, "g")],
        ["x", s(150, -H / 2 - GROUP_PADDING.top + 5)],
      ]),
      new Map([["g", { parent: null }]])
    );
    expect([...inside.keys()]).toContain("inside:x|g");
    const data: Diagram = {
      nodes: [at("a", "e-commerce-cart", 0, 0), at("b", "e-commerce-cart", 600, 0), at("x", "e-commerce-cart", 300, 0)],
      edges: [],
    };
    const plan = ok([{ op: "group", id: "g", label: "G", members: ["a", "b"] }], data);
    expect(plan.warnings).toEqual([expect.stringMatching(/^screen "x" is not in group "g" but lies inside its frame/)]);
    const after = applyActions(data, plan.actions);
    expect(ok([{ op: "update_screen", id: "x", y: 600 }], after).warnings).toEqual([]);
  });
});

describe("applyActions (React Flow)", () => {
  it("builds cards at the planned centres, connections and colours; the result follows every rule", () => {
    const plan = ok([
      { op: "add_screen", id: "login", template: "sign-in-sign-in-1", label: "Login", x: 200, y: 600 },
      { op: "add_screen", id: "home", template: "header-header-1", label: "Home", x: 600, y: 600, header: false },
      { op: "connect", id: "to_home", from: "login", to: "home", label: "Sign in" },
      { op: "update_connection", id: "e1", color: "#E8590C", label: "Pay" },
      { op: "update_screen", id: "a", label: "Basket", x: 250 },
    ]);
    const d = applyActions(base(), plan.actions);
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0 });
    expect(centreOf(d, "login")).toEqual({ x: 200, y: 600 });
    expect(centreOf(d, "home").x).toBeCloseTo(600);
    expect(centreOf(d, "a")).toEqual({ x: 250, y: 200 });
    const byId = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
    expect(byId.home.data).toMatchObject({ graphicId: "header-header-1", headerText: "Home", showHeader: false });
    expect(byId.a.data).toMatchObject({ headerText: "Basket" });
    expect(d.edges.find((e) => e.id === "to_home")).toMatchObject({
      source: "login",
      target: "home",
      label: "Sign in",
      markerEnd: { type: "arrowclosed" },
    });
    expect(d.edges.find((e) => e.id === "e1")).toMatchObject({ label: "Pay", style: { stroke: "#e8590c" } });
  });

  it("a template change keeps the centre and takes the catalog image", () => {
    const d = applyActions(base(), ok([{ op: "update_screen", id: "a", template: "misc-404" }]).actions);
    expect(d.nodes.find((n) => n.id === "a")!.data).toMatchObject({
      graphicId: "misc-404",
      src: "/graphics/misc/404.svg",
    });
    expect(centreOf(d, "a").x).toBeCloseTo(200);
    expect(centreOf(d, "a").y).toBeCloseTo(200);
  });

  it("clear then rebuild, and removing a screen removes its connections", () => {
    expect(
      applyActions(
        base(),
        ok([{ op: "clear" }, { op: "add_screen", id: "n", template: "misc-404", label: "N", x: 0, y: 0 }]).actions
      ).nodes.map((n) => n.id)
    ).toEqual(["n"]);
    const d = applyActions(base(), ok([{ op: "remove", ids: ["b"] }]).actions);
    expect(d.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(d.edges).toEqual([]);
  });
});

describe("the agent loop with the store", () => {
  // A chat that answers with scripted turns.
  const scripted = (turns: Array<Partial<Turn>>): Chat => {
    let i = 0;
    return {
      async send() {
        const t = turns[i++];
        return {
          status: "done",
          text: "",
          toolCalls: [],
          refusal: null,
          model: "m",
          usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, usd: 0.001 },
          ...t,
        };
      },
    };
  };

  it("applies each tool call as one undo step, reports errors back, and tracks the step", async () => {
    const saves: string[] = [];
    const store = createDiagramStore({ initial: base(), save: (j) => (saves.push(j), true) });
    const steps: number[] = [];
    const chat = scripted([
      {
        status: "tool_use",
        toolCalls: [
          {
            id: "t1",
            name: "edit_diagram",
            input: { summary: "Bad", operations: [{ op: "connect", id: "x", from: "a", to: "nope" }] },
          },
        ],
      },
      {
        status: "tool_use",
        toolCalls: [
          {
            id: "t2",
            name: "edit_diagram",
            input: {
              summary: "Add login",
              operations: [
                { op: "add_screen", id: "login", template: "sign-in-sign-in-1", label: "Login", x: 200, y: 700 },
                { op: "connect", id: "c1", from: "login", to: "a" },
              ],
            },
          },
        ],
      },
      { status: "done", text: "Added a login screen." },
    ]);
    const events: string[] = [];
    const result = await runRequest({
      chat,
      text: "add login",
      editor: {
        read: () => ({ data: store.diagram(), selected: [] }),
        apply: (actions) => {
          const id = store.apply((d) => applyActions(d, actions), { kind: "ai" });
          if (id !== null) steps.push(id);
        },
      },
      onEvent: (e) => events.push(e.type),
    });
    expect(result.status).toBe("done");
    expect(result.usage.usd).toBeCloseTo(0.003);
    expect(events.filter((e) => e === "tool_error")).toHaveLength(1);
    expect(saves).toHaveLength(1);
    expect(stepState(store.history(), steps[0])).toBe("latest");
    store.undo();
    expect(stepState(store.history(), steps[0])).toBe("undone");
    expect(store.diagram().nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
    store.redo();
    expect(store.diagram().nodes.map((n) => n.id)).toContain("login");
    // Opening a file over it: replaced, not undone.
    store.replace({ nodes: [card("z")], edges: [] });
    expect(stepState(store.history(), steps[0])).toBe("replaced");
    store.undo();
    expect(stepState(store.history(), steps[0])).toBe("latest");
  });

  // An AI batch that changes nothing must not claim the user's previous step
  // (the panel's Undo would then undo the user's own change).
  it("records no step for a batch that changes nothing", () => {
    const store = createDiagramStore({ initial: base(), save: () => true });
    store.toggleHeaders(["a"]);
    expect(store.apply((d) => d, { kind: "ai" })).toBeNull();
  });
});
