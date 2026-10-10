// Notes (#83): free text that connects like a card, stored with its size.
import { describe, expect, it } from "vitest";
import { applyActions, planOps, snapshot } from "@/lib/ai/diagram";
import { parseFile, serializeFile } from "@/lib/diagram/file";
import { absoluteBoxes } from "@/lib/diagram/groups";
import { isNote, MAX_NOTE_TEXT, NOTE_BOUNDS, NOTE_SIZE, type Diagram, type NoteNode } from "@/lib/diagram/model";
import { copyItems, groupItems, pasteItems, setNoteText } from "@/lib/diagram/ops";
import { enforceRules, serialize } from "@/lib/diagram/rules";
import { createDiagramStore } from "@/lib/diagram/store";
import { card, edge } from "./helpers";

const note = (id: string, x = 0, y = 0, extra: Partial<NoteNode> = {}): NoteNode => ({
  id,
  type: "note",
  position: { x, y },
  width: 220,
  height: 120,
  data: { text: "Remember the coupon field" },
  ...extra,
});
const withNote = (): Diagram => ({ nodes: [card("a"), note("n", 400, 0)], edges: [edge("an", "a", "n")] });
const noteIn = (d: Diagram, id = "n") => d.nodes.find((n) => n.id === id) as NoteNode;

describe("notes", () => {
  it("are kept by the rules with their text and size, and connect like cards", () => {
    const { diagram, dropped } = enforceRules(withNote());
    expect(dropped).toEqual({ nodes: 0, edges: 0 });
    expect(noteIn(diagram)).toEqual(note("n", 400, 0));
    expect(diagram.edges).toHaveLength(1);
  });

  it("are cleaned: sizes within bounds, text capped, unknown fields and bad values dropped", () => {
    const keep = (raw: object) => enforceRules({ nodes: [{ ...note("n"), ...raw }], edges: [] }).diagram.nodes[0] as NoteNode;
    expect(keep({ width: 5, height: 99999 })).toMatchObject({ width: NOTE_BOUNDS.minWidth, height: NOTE_BOUNDS.maxHeight });
    expect(keep({ width: "wide", height: -1 })).toMatchObject(NOTE_SIZE);
    expect(keep({ data: { text: "x".repeat(MAX_NOTE_TEXT + 50) } }).data.text).toHaveLength(MAX_NOTE_TEXT);
    expect(keep({ data: { text: 42 } }).data.text).toBe("");
    expect(keep({ data: { text: "hi", __proto__: { evil: 1 }, html: "<b>" } }).data).toEqual({ text: "hi" });
    expect(keep({ selected: true, resizing: true, measured: { width: 1, height: 1 } })).toEqual(note("n"));
    expect(enforceRules({ nodes: [{ ...note("n"), position: null }], edges: [] }).dropped.nodes).toBe(1);
  });

  it("keep their line breaks when edited, trimmed only at the end", () => {
    const d = setNoteText(withNote(), "n", "Line one\n\n  Line two  \n\n");
    expect(noteIn(d).data.text).toBe("Line one\n\n  Line two");
  });

  it("are one undo step to add, write and resize; a resize in progress records nothing", () => {
    const store = createDiagramStore({ initial: { nodes: [card("a")], edges: [] }, save: () => true });
    const id = store.addNote({ x: 300, y: 0 });
    expect(store.getState().nodes.find((n) => n.id === id)).toMatchObject({ type: "note", selected: true, data: { text: "" } });
    store.setNoteText(id, "Coupon?");
    const steps = store.history().past.length;
    store.onNodesChange([{ type: "dimensions", id, dimensions: { width: 300, height: 150 }, resizing: true, setAttributes: true }]);
    store.onNodesChange([{ type: "dimensions", id, dimensions: { width: 320, height: 160 }, resizing: true, setAttributes: true }]);
    expect(store.history().past.length).toBe(steps);
    store.onNodesChange([{ type: "dimensions", id, dimensions: { width: 340, height: 170 }, resizing: false, setAttributes: true }]);
    expect(store.history().past.length).toBe(steps + 1);
    expect(noteIn(store.diagram(), id)).toMatchObject({ width: 340, height: 170, data: { text: "Coupon?" } });
    store.undo();
    expect(noteIn(store.diagram(), id)).toMatchObject({ width: 220, height: 120 });
    store.undo();
    expect(noteIn(store.diagram(), id).data.text).toBe("");
  });

  it("accept connections from and to cards, but not from groups", () => {
    const store = createDiagramStore({ initial: withNote(), save: () => true });
    expect(store.isValidConnection({ source: "n", target: "a", sourceHandle: null, targetHandle: null })).toBe(true);
    expect(store.isValidConnection({ source: "a", target: "n", sourceHandle: null, targetHandle: null })).toBe(true);
  });

  it("copy and paste with new ids, their connections and text included", () => {
    const d = withNote();
    const { diagram, ids } = pasteItems(d, copyItems(d, ["a", "n"]), { x: 20, y: 20 });
    expect(ids).toHaveLength(2);
    const pasted = diagram.nodes.filter((n) => ids.includes(n.id));
    expect(pasted.find(isNote)).toMatchObject({ id: expect.stringMatching(/^note-/), data: { text: "Remember the coupon field" } });
    expect(diagram.edges).toHaveLength(2);
  });

  it("join groups, and the frame wraps the note's size", () => {
    const d = groupItems(withNote(), ["a", "n"], { id: "g" });
    expect(noteIn(d).parentId).toBe("g");
    const boxes = absoluteBoxes(d.nodes);
    const g = boxes.get("g")!;
    const n = boxes.get("n")!;
    expect(g.x + g.width).toBe(n.x + n.width + 16);
  });

  it("survive a save and open, and an older version 2 file still opens", () => {
    const d = withNote();
    const file = JSON.parse(serializeFile(d));
    expect(file.version).toBe(4);
    expect(serialize(parseFile(JSON.stringify(file)).diagram)).toBe(serialize(d));
    const v2 = JSON.stringify({ format: "wireflow", version: 2, diagram: { nodes: [card("a")], edges: [] } });
    expect(parseFile(v2).diagram.nodes).toHaveLength(1);
    expect(() => parseFile(JSON.stringify({ ...file, diagram: { nodes: [{ ...note("n"), data: { text: 5 } }], edges: [] } }))).toThrow(
      /has text that isn't text/
    );
  });
});

describe("notes and the AI", () => {
  it("are in the snapshot with their text, centre and size", () => {
    const s = snapshot({ data: withNote() });
    expect(s.notes).toEqual([{ id: "n", text: "Remember the coupon field", x: 510, y: 60, width: 220, height: 120, group: null }]);
    expect(s.screens.map((x) => x.id)).toEqual(["a"]);
  });

  it("add_note and update_note go through the same validation and apply as one batch", () => {
    const plan = planOps(
      {
        summary: "Notes",
        operations: [
          { op: "add_note", id: "tip", text: "Ask for the email first\nthen the password", x: 800, y: 60, height: 80 },
          { op: "connect", id: "to_tip", from: "a", to: "tip" },
          { op: "update_note", id: "n", text: "Coupon field: optional", width: 260 },
          { op: "group", id: "g", label: "Notes", members: ["tip", "n"] },
        ],
      },
      withNote()
    );
    if (plan.errors) throw new Error(JSON.stringify(plan.errors));
    const d = applyActions(withNote(), plan.actions);
    const tip = noteIn(d, "tip");
    expect(tip).toMatchObject({ width: NOTE_SIZE.width, height: 80, parentId: "g", data: { text: "Ask for the email first\nthen the password" } });
    const box = absoluteBoxes(d.nodes).get("tip")!;
    expect([box.x + box.width / 2, box.y + box.height / 2]).toEqual([800, 60]);
    expect(noteIn(d, "n")).toMatchObject({ width: 260, data: { text: "Coupon field: optional" } });
    expect(d.edges.map((e) => [e.source, e.target])).toContainEqual(["a", "tip"]);
    // Through the rules, unchanged.
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0 });
  });

  it("rejects bad note operations, and screen operations on notes", () => {
    const errors = (ops: unknown[]) => {
      const plan = planOps({ summary: "", operations: ops }, withNote());
      return plan.errors?.map((e) => e.message);
    };
    expect(errors([{ op: "add_note", id: "x" }])).toEqual(["text must be a string"]);
    expect(errors([{ op: "add_note", id: "x", text: "a", width: 5 }])).toEqual([
      `width must be a number from ${NOTE_BOUNDS.minWidth} to ${NOTE_BOUNDS.maxWidth}`,
    ]);
    expect(errors([{ op: "add_note", id: "x", text: "a", colour: "red" }])).toEqual(["unknown field(s): colour"]);
    expect(errors([{ op: "update_note", id: "a", text: "a" }])).toEqual(['no note "a"']);
    expect(errors([{ op: "update_note", id: "n" }])).toEqual(["nothing to update"]);
    expect(errors([{ op: "update_screen", id: "n", label: "x" }])).toEqual(['no screen "n"']);
  });

  it("warns when a new note covers a screen, as for screens", () => {
    const plan = planOps({ summary: "", operations: [{ op: "add_note", id: "x", text: "a", x: 110, y: 90 }] }, withNote());
    expect(plan.errors).toBeUndefined();
    expect(plan.errors ? [] : plan.warnings).toEqual(['screens "a" and "x" overlap']);
  });

  it("keeps control characters out of a note's text, but not its line breaks", () => {
    const plan = planOps({ summary: "", operations: [{ op: "add_note", id: "x", text: "one\r\ntwo\u0007three\t" }] }, withNote());
    if (plan.errors) throw new Error("unexpected");
    expect(plan.actions[0]).toMatchObject({ text: "one\ntwo three" });
  });
});
