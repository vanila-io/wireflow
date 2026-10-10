import { describe, expect, it } from "vitest";
import { graphicById } from "@/lib/graphics";
import { createHistory, record, redo, undo } from "@/lib/diagram/history";
import type { Diagram } from "@/lib/diagram/model";
import { serialize } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { HISTORY_KEY, readHistory, writeHistory } from "@/lib/diagram/storage";
import { card, edge, MemoryStorage } from "./helpers";

function setup(initial: Diagram, history?: Parameters<typeof createDiagramStore>[0]["history"]) {
  const saves: string[] = [];
  const store = createDiagramStore({ initial, save: (json) => (saves.push(json), true), history });
  const last = () => JSON.parse(saves[saves.length - 1]) as Diagram;
  return { store, saves, last };
}

describe("undo history", () => {
  it("records a state once and travels back and forth", () => {
    let h = createHistory("a");
    h = record(h, "a");
    expect(h.past).toHaveLength(0);
    h = record(record(h, "b"), "c", "ai");
    expect(undo(h).present.json).toBe("b");
    expect(redo(undo(h)).present).toEqual(h.present);
    // A new step after undo drops what redo would have brought back.
    expect(record(undo(h), "d").future).toEqual([]);
  });

  it("keeps as much history as fits, and reads only well-formed history", () => {
    let h = createHistory(serialize({ nodes: [], edges: [] }));
    for (let i = 0; i < 20; i++) h = record(h, serialize({ nodes: [card(`n${i}`, i * 10, 0)], edges: [] }));
    const roomy = new MemoryStorage();
    writeHistory(roomy, h);
    expect(readHistory(roomy)?.past).toHaveLength(20);
    const tight = new MemoryStorage(1000);
    writeHistory(tight, h);
    const kept = readHistory(tight);
    expect(kept?.present).toEqual(h.present);
    expect(kept!.past.length).toBeLessThan(20);
    const broken = new MemoryStorage();
    broken.setItem(HISTORY_KEY, '{"past":[1],"present":{},"future":[]}');
    expect(readHistory(broken)).toBeNull();
  });

  it("passes every restored step through the rules", () => {
    const dirty = new MemoryStorage();
    const step = (id: number, json: string) => ({ id, json });
    dirty.setItem(
      HISTORY_KEY,
      JSON.stringify({
        past: [step(1, JSON.stringify({ nodes: [card("a"), card("b")], edges: [edge("x", "a", "gone")] }))],
        present: step(2, serialize({ nodes: [], edges: [] })),
        future: [],
      })
    );
    expect(JSON.parse(readHistory(dirty)!.past[0].json).edges).toEqual([]);
    dirty.setItem(HISTORY_KEY, JSON.stringify({ past: [step(1, "not json")], present: step(2, "{}"), future: [] }));
    expect(readHistory(dirty)).toBeNull();
  });

  it("continues a restored history only if it ends at the loaded diagram", () => {
    const first = setup({ nodes: [], edges: [] });
    first.store.addCard(graphicById("article-article-1")!, { x: 0, y: 0 });
    const history = first.store.history();
    const loaded = first.last();

    const resumed = setup(loaded, history);
    expect(resumed.store.getState().canUndo).toBe(true);
    resumed.store.undo();
    expect(resumed.last().nodes).toEqual([]);

    // Another tab or an older save changed the diagram since: start afresh.
    const other = setup({ nodes: [card("z")], edges: [] }, history);
    expect(other.store.getState().canUndo).toBe(false);
  });

  it("pastes copied cards and their connections with new ids, as one undo step", () => {
    const { store, last } = setup({
      nodes: [card("a"), card("b", 400), card("c", 800)],
      edges: [edge("ab", "a", "b"), edge("bc", "b", "c")],
    });
    expect(store.copy()).toBe(false);
    expect(store.paste()).toBe(false);
    store.onNodesChange([
      { type: "select", id: "a", selected: true },
      { type: "select", id: "b", selected: true },
    ]);
    expect(store.copy()).toBe(true);
    store.paste();
    const after = last();
    expect(after.nodes).toHaveLength(5);
    expect(after.edges).toHaveLength(3);
    const pasted = after.nodes.slice(3);
    expect(pasted.map((n) => n.position)).toEqual([
      { x: 20, y: 20 },
      { x: 420, y: 20 },
    ]);
    const copyEdge = after.edges[2];
    expect([copyEdge.source, copyEdge.target]).toEqual(pasted.map((n) => n.id));
    // The copy is selected, the originals aren't.
    expect(
      store
        .getState()
        .nodes.filter((n) => n.selected)
        .map((n) => n.id)
    ).toEqual(pasted.map((n) => n.id));
    store.undo();
    expect(last().nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
});
