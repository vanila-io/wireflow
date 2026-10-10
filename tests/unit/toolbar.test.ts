// The earlier editor's toolbar commands and shortcuts, in the store.
import { describe, expect, it } from "vitest";
import { groupItems, reorder, setHeaders } from "@/lib/diagram/ops";
import { enforceRules } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { isCard, type Diagram } from "@/lib/diagram/model";
import { card, edge } from "./helpers";

const three = (): Diagram => ({
  nodes: [card("a"), card("b", 100), card("c", 200)],
  edges: [edge("ab", "a", "b"), edge("bc", "b", "c")],
});
const ids = (d: Diagram) => d.nodes.map((n) => n.id);

describe("To Front / To Back", () => {
  it("moves the selection to the end or the start of the drawing order", () => {
    expect(ids(reorder(three(), ["a"], "front"))).toEqual(["b", "c", "a"]);
    expect(ids(reorder(three(), ["c"], "back"))).toEqual(["c", "a", "b"]);
    expect(reorder(three(), ["ab"], "front").edges.map((e) => e.id)).toEqual(["bc", "ab"]);
  });

  it("keeps groups before their members", () => {
    const d = groupItems(three(), ["a", "b"], { id: "g" });
    const back = enforceRules(reorder(d, ["a"], "back")).diagram;
    expect(ids(back).indexOf("g")).toBeLessThan(ids(back).indexOf("a"));
    // a now comes first among the group's members.
    expect(ids(back).filter((id) => id === "a" || id === "b")).toEqual(["a", "b"]);
  });

  it("is one undo step in the store, and does nothing without a selection", () => {
    const store = createDiagramStore({ initial: three(), save: () => true });
    store.reorder("front");
    expect(store.history().past).toHaveLength(0);
    store.onNodesChange([{ type: "select", id: "a", selected: true }]);
    store.reorder("front");
    expect(ids(store.diagram())).toEqual(["b", "c", "a"]);
    store.undo();
    expect(ids(store.diagram())).toEqual(["a", "b", "c"]);
  });
});

describe("selection (#82) and the clipboard", () => {
  it("selects everything, clears it, and neither is an undo step", () => {
    const store = createDiagramStore({ initial: three(), save: () => true });
    store.selectAll();
    expect(store.selectedIds().sort()).toEqual(["a", "ab", "b", "bc", "c"]);
    expect(store.clearSelection()).toBe(true);
    expect(store.selectedIds()).toEqual([]);
    expect(store.clearSelection()).toBe(false);
    expect(store.history().past).toHaveLength(0);
  });

  it("says when there is something to paste", () => {
    const store = createDiagramStore({ initial: three(), save: () => true });
    expect(store.getState().hasClipboard).toBe(false);
    store.onNodesChange([{ type: "select", id: "a", selected: true }]);
    store.copy();
    expect(store.getState().hasClipboard).toBe(true);
  });
});

describe("Ctrl+H / Ctrl+K", () => {
  it("hides or shows the header of the given cards, whatever it was", () => {
    let d = setHeaders(three(), ["a", "b"], false);
    expect(d.nodes.filter(isCard).map((n) => n.data.showHeader)).toEqual([false, false, true]);
    d = setHeaders(d, ["a", "b"], false);
    expect(d.nodes.filter(isCard).map((n) => n.data.showHeader)).toEqual([false, false, true]);
    d = setHeaders(d, ["a"], true);
    expect(d.nodes.filter(isCard).map((n) => n.data.showHeader)).toEqual([true, false, true]);
  });
});
