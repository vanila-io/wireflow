// Ported from #105 (diagram.test.js, layout.test.js) via #113, against the
// editor's React Flow diagram, plus tests of the apply layer.
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot, type Action } from "@/lib/ai/diagram";
import { catalogText, templateExists } from "@/lib/ai/catalog";
import { layoutIssues, type Screen } from "@/lib/ai/layout";
import { runRequest } from "@/lib/ai/agent";
import { systemPrompt } from "@/lib/ai/prompt";
import { cardSize, type Diagram } from "@/lib/diagram/model";
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
  const n = d.nodes.find((x) => x.id === id)!;
  const { width, height } = cardSize(n.data);
  return { x: n.position.x + width / 2, y: n.position.y + height / 2 };
};

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
  it("lists the 102 templates by their stable ids", () => {
    expect(catalogText().split("\n")).toHaveLength(102);
    expect(catalogText()).toContain("e-commerce-cart | E-Commerce | Cart");
    expect(templateExists("e-commerce-cart")).toBe(true);
    expect(templateExists("https://evil.example/x.svg")).toBe(false);
  });

  it("keeps the system prompt the same for every request, so it can be cached", () => {
    expect(systemPrompt()).toBe(systemPrompt());
    expect(systemPrompt()).toContain("e-commerce-cart | E-Commerce | Cart");
    expect(systemPrompt()).not.toMatch(/group/i);
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
    });
    expect(s.connections).toEqual([{ id: "e1", from: "a", to: "b", label: "" }]);
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
    ).toEqual([{ index: 1, op: "connect", message: 'no screen "nope"' }]);
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
    bad([{ op: "group", id: "g", label: "G", members: ["a", "b"] }]);
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
});

describe("layout warnings", () => {
  const s = (x: number, y: number): Screen => ({ x, y, size: [220, H] });

  it("finds overlapping screens, not ones that only touch", () => {
    expect([
      ...layoutIssues(
        new Map([
          ["a", s(0, 0)],
          ["b", s(100, 0)],
        ])
      ).keys(),
    ]).toEqual(["screens:a|b"]);
    expect(
      layoutIssues(
        new Map([
          ["a", s(0, 0)],
          ["b", s(220, 0)],
        ])
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
