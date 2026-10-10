// The one diagram store. React Flow and every editor feature read it with
// useSyncExternalStore and change it only through these methods, and every
// change ends in `commit`, the single save boundary: unless a drag is still in
// progress, the diagram goes through the rules (rules.ts), is saved, and is
// recorded as one undo step. A change that leaves the stored JSON as it was
// (selection, React Flow's measurements) is neither saved nor recorded.
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { Graphic } from "@/lib/graphics";
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from "./history";
import { ARROW, makeCard, type Diagram, type DiagramEdge, type DiagramNode } from "./model";
import { copyItems, pasteItems, removeItems, setHeaderText, toggleHeaders, type Clip } from "./ops";
import { enforceRules, serialize } from "./rules";

export type StoreState = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  canUndo: boolean;
  canRedo: boolean;
  /** The last save failed (storage full or blocked); the diagram is only in memory. */
  saveFailed: boolean;
};

export type StoreOptions = {
  initial: Diagram;
  /** Persist the stored JSON. Returns false if it could not be saved. */
  save: (json: string) => boolean;
  /** An undo history to continue (e.g. after a reload); used only if it ends at `initial`. */
  history?: History | null;
};

export type DiagramStore = ReturnType<typeof createDiagramStore>;

export function createDiagramStore({ initial, save, history: restored }: StoreOptions) {
  const startJson = serialize(initial);
  let history = restored && restored.present.json === startJson ? restored : createHistory(startJson);
  let state: StoreState = {
    ...enforceRules(initial).diagram,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    saveFailed: false,
  };
  const listeners = new Set<() => void>();
  let clipboard: Clip | null = null;
  let pastes = 0;
  const emit = () => listeners.forEach((l) => l());

  const live = (): Diagram => ({ nodes: state.nodes, edges: state.edges });
  /** The current diagram as stored (through the rules). */
  const current = () => enforceRules(live()).diagram;

  // The save boundary. `kind` labels the undo step this change makes. Returns
  // the id of the step it recorded, or null if the stored diagram didn't change.
  function commit(next: Partial<Pick<StoreState, "nodes" | "edges">>, kind?: string): number | null {
    state = { ...state, ...next };
    let recorded: number | null = null;
    if (!state.nodes.some((n) => n.dragging)) {
      const json = serialize(live());
      if (json !== history.present.json) {
        state.saveFailed = !save(json);
        history = record(history, json, kind);
        recorded = history.present.id;
      }
    }
    state = { ...state, canUndo: canUndo(history), canRedo: canRedo(history) };
    emit();
    return recorded;
  }

  // Show a stored diagram, keeping the selection and React Flow's measurements
  // of items that are still there (no flicker, and an open panel stays open).
  function show(d: Diagram, select?: string[]) {
    const old = new Map<string, DiagramNode | DiagramEdge>([...state.nodes, ...state.edges].map((i) => [i.id, i]));
    const selected = (id: string) => (select ? select.includes(id) : !!old.get(id)?.selected);
    const nodes = d.nodes.map((n) => {
      const prev = old.get(n.id) as DiagramNode | undefined;
      return { ...n, selected: selected(n.id), ...(prev?.measured && { measured: prev.measured }) };
    });
    const edges = d.edges.map((e) => ({ ...e, selected: selected(e.id) }));
    return { nodes, edges };
  }

  function travel(move: (h: History) => History) {
    const next = move(history);
    if (next === history) return;
    history = next;
    state.saveFailed = !save(history.present.json);
    state = {
      ...state,
      ...show(JSON.parse(history.present.json)),
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    };
    emit();
  }

  const selectedIds = () => [...state.nodes, ...state.edges].filter((i) => i.selected).map((i) => i.id);

  // Only a handle-to-handle connection between two existing nodes becomes an
  // edge. React Flow asks while dragging, so an invalid target never
  // highlights, and a release anywhere else creates nothing.
  const isValidConnection = (c: Connection | DiagramEdge) => {
    const ids = new Set(state.nodes.map((n) => n.id));
    return !!c.source && !!c.target && ids.has(c.source) && ids.has(c.target);
  };

  /** Apply a batch of changes as one undo step. Returns the step's id (null: nothing changed). */
  const apply = (change: (d: Diagram) => Diagram, { kind, select }: { kind?: string; select?: string[] } = {}) =>
    commit(show(enforceRules(change(current())).diagram, select), kind);

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getState: () => state,
    diagram: current,
    history: () => history,
    selectedIds,
    apply,
    isValidConnection,

    onNodesChange(changes: NodeChange<DiagramNode>[]) {
      commit({ nodes: applyNodeChanges(changes, state.nodes) });
    },
    onEdgesChange(changes: EdgeChange<DiagramEdge>[]) {
      commit({ edges: applyEdgeChanges(changes, state.edges) });
    },
    onConnect(c: Connection) {
      if (isValidConnection(c)) commit({ edges: addEdge({ ...c, markerEnd: { type: ARROW } }, state.edges) });
    },

    addCard(g: Graphic, position: { x: number; y: number }) {
      const card = makeCard(g, position);
      return apply((d) => ({ nodes: [...d.nodes, card], edges: d.edges }));
    },
    /** Nodes with their edges, and selected edges: one undo step. */
    removeSelected() {
      const ids = selectedIds();
      if (ids.length) apply((d) => removeItems(d, ids));
    },
    toggleHeaders(ids: string[]) {
      if (ids.length) apply((d) => toggleHeaders(d, ids));
    },
    setHeaderText(id: string, value: string) {
      apply((d) => setHeaderText(d, id, value));
    },
    /** Copy the selected cards (and the connections between them). Returns false if nothing is selected. */
    copy() {
      const ids = state.nodes.filter((n) => n.selected).map((n) => n.id);
      if (!ids.length) return false;
      clipboard = copyItems(current(), ids);
      pastes = 0;
      return true;
    },
    /** Paste with new ids, a little further down each time, and select the copy: one undo step. */
    paste() {
      if (!clipboard) return false;
      pastes += 1;
      const { diagram, ids } = pasteItems(current(), clipboard, { x: 20 * pastes, y: 20 * pastes });
      apply(() => diagram, { select: ids });
      return true;
    },
    clear() {
      if (state.nodes.length) apply(() => ({ nodes: [], edges: [] }));
    },
    /**
     * Show a diagram another tab has just saved, as an undo step of its own,
     * without writing it back (it is already stored).
     */
    adopt(next: Diagram) {
      const { diagram: d } = enforceRules(next);
      const json = serialize(d);
      if (json === history.present.json) return;
      history = record(history, json, "sync");
      state = { ...state, ...show(d), canUndo: canUndo(history), canRedo: canRedo(history) };
      emit();
    },
    undo: () => travel(undo),
    redo: () => travel(redo),
  };
}
