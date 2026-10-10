// Estimates and costs (#84): hours on cards, totals per group and project, an
// hourly rate stored with the diagram.
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot } from "@/lib/ai/diagram";
import { formatCost, formatHours, groupTotal, projectTotal, totalsByGroup } from "@/lib/diagram/estimate";
import { parseFile, serializeFile } from "@/lib/diagram/file";
import { MAX_ESTIMATE, type CardNode, type Diagram } from "@/lib/diagram/model";
import { groupItems } from "@/lib/diagram/ops";
import { enforceRules, serialize } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { card, edge } from "./helpers";

const est = (id: string, hours: number | undefined, x = 0) => {
  const c = card(id, x, 0);
  return hours === undefined ? c : { ...c, data: { ...c.data, estimate: hours } };
};
// Two groups (one nested in the other) and a card in none.
function project(): Diagram {
  let d: Diagram = {
    nodes: [est("a", 4), est("b", 2.5, 300), est("c", undefined, 600), est("d", 8, 900), est("e", 1, 1200)],
    edges: [edge("ab", "a", "b")],
  };
  d = groupItems(d, ["a", "b"], { id: "inner", label: "Auth" });
  d = groupItems(d, ["inner", "c"], { id: "outer", label: "Onboarding" });
  d = groupItems(d, ["d", "e"], { id: "shop", label: "Shop" });
  return { ...d, nodes: [...d.nodes, est("f", 3, 1500)], settings: { hourlyRate: 80, currency: "EUR" } };
}
const data = (d: Diagram, id: string) => (d.nodes.find((n) => n.id === id) as CardNode).data;

describe("estimates", () => {
  it("are kept by the rules as hours from 0 to the maximum, to two decimals; anything else is dropped", () => {
    const keep = (v: unknown) => (enforceRules({ nodes: [{ ...card("a"), data: { ...card("a").data, estimate: v } }], edges: [] }).diagram.nodes[0] as CardNode).data;
    expect(keep(2.333).estimate).toBe(2.33);
    expect(keep(0).estimate).toBe(0);
    for (const bad of [-1, MAX_ESTIMATE + 1, "3", null, NaN, Infinity]) expect(keep(bad)).not.toHaveProperty("estimate");
  });

  it("add up per group (nested groups included) and for the project", () => {
    const d = project();
    expect(projectTotal(d)).toEqual({ hours: 18.5, estimated: 5, cards: 6 });
    expect(groupTotal(d.nodes, "inner")).toEqual({ hours: 6.5, estimated: 2, cards: 2 });
    expect(groupTotal(d.nodes, "outer")).toEqual({ hours: 6.5, estimated: 2, cards: 3 });
    const rows = totalsByGroup(d);
    expect(rows.map((r) => [r.label, r.total.hours])).toEqual([
      ["Onboarding", 6.5],
      ["Shop", 9],
      ["Not in a group", 3],
    ]);
    expect(rows.reduce((n, r) => n + r.total.hours, 0)).toBe(projectTotal(d).hours);
    expect(totalsByGroup({ nodes: [card("x")] })).toEqual([]);
  });

  it("format as hours and as money in the project's currency", () => {
    expect(formatHours(6.5)).toBe("6.5 h");
    expect(formatHours(1 / 3)).toBe("0.33 h");
    expect(formatCost(1480, "EUR")).toMatch(/1,?480/);
    expect(formatCost(1480, "EUR")).toMatch(/€/);
    expect(formatCost(12.5, "USD")).toMatch(/12\.5/);
    expect(() => formatCost(100000, "JPY")).not.toThrow();
  });

  it("are one undo step each, and the rate and currency are kept with the diagram through every change", () => {
    const store = createDiagramStore({ initial: project(), save: () => true });
    store.setEstimate("c", 5);
    expect(data(store.diagram(), "c").estimate).toBe(5);
    store.setSettings({ hourlyRate: 95.5 });
    expect(store.getState().settings).toEqual({ hourlyRate: 95.5, currency: "EUR" });
    // Changes to nodes keep the settings: remove, group, a paste, an AI batch.
    store.selectAll();
    store.copy();
    store.paste();
    store.apply((d) => ({ nodes: d.nodes.filter((n) => n.id !== "f"), edges: d.edges }));
    expect(store.diagram().settings).toEqual({ hourlyRate: 95.5, currency: "EUR" });
    store.setEstimate("c", null);
    expect(data(store.diagram(), "c")).not.toHaveProperty("estimate");
    // Undo walks back through them, settings included.
    for (let i = 0; i < 3; i++) store.undo();
    expect(store.getState().settings?.hourlyRate).toBe(95.5);
    store.undo();
    expect(store.getState().settings).toEqual({ hourlyRate: 80, currency: "EUR" });
    store.setSettings({ hourlyRate: undefined, currency: undefined });
    expect(store.getState().settings).toBeUndefined();
  });

  it("keep only a valid rate and currency, and nothing else in the settings", () => {
    const s = (settings: unknown) => enforceRules({ nodes: [], edges: [], settings }).diagram.settings;
    expect(s({ hourlyRate: 120.456, currency: "GBP", __proto__: { x: 1 }, evil: "<b>" })).toEqual({ hourlyRate: 120.46, currency: "GBP" });
    expect(s({ hourlyRate: -5, currency: "XXX" })).toBeUndefined();
    expect(s("120")).toBeUndefined();
  });

  it("are in the file and come back when it is opened, with a clear message for a bad estimate", () => {
    const d = project();
    const file = JSON.parse(serializeFile(d));
    expect(file.diagram.settings).toEqual({ hourlyRate: 80, currency: "EUR" });
    expect(serialize(parseFile(JSON.stringify(file)).diagram)).toBe(serialize(d));
    const bad = { ...file, diagram: { nodes: [{ ...card("a"), data: { ...card("a").data, estimate: "lots" } }], edges: [] } };
    expect(() => parseFile(JSON.stringify(bad))).toThrow(/has an estimate that isn't a number of hours/);
  });

  it("an opened file brings its own rate, and undo goes back to the previous one", () => {
    const store = createDiagramStore({ initial: project(), save: () => true });
    store.replace({ nodes: [est("z", 1)], edges: [], settings: { hourlyRate: 10 } });
    expect(store.getState().settings).toEqual({ hourlyRate: 10 });
    store.undo();
    expect(store.getState().settings).toEqual({ hourlyRate: 80, currency: "EUR" });
  });
});

describe("estimates and the AI", () => {
  it("are in the snapshot, with the rate", () => {
    const s = snapshot({ data: project() });
    expect(s).toMatchObject({ hourlyRate: 80, currency: "EUR" });
    expect(s.screens.find((x) => x.id === "a")).toMatchObject({ estimate: 4 });
    expect(s.screens.find((x) => x.id === "c")).not.toHaveProperty("estimate");
  });

  it("change only through update_screen's estimate, validated", () => {
    const d = project();
    const plan = planOps(
      { summary: "", operations: [{ op: "update_screen", id: "c", estimate: 3 }, { op: "update_screen", id: "a", estimate: null }] },
      d
    );
    if (plan.errors) throw new Error(JSON.stringify(plan.errors));
    const after = applyActions(d, plan.actions);
    expect(data(after, "c").estimate).toBe(3);
    expect(data(after, "a")).not.toHaveProperty("estimate");
    // Renaming leaves the estimate alone.
    const rename = planOps({ summary: "", operations: [{ op: "update_screen", id: "d", label: "Basket" }] }, d);
    if (rename.errors) throw new Error("unexpected");
    expect(data(applyActions(d, rename.actions), "d").estimate).toBe(8);
    const bad = planOps({ summary: "", operations: [{ op: "update_screen", id: "c", estimate: -2 }] }, d);
    expect(bad.errors?.[0].message).toBe(`estimate must be a number of hours from 0 to ${MAX_ESTIMATE}, or null`);
  });
});
