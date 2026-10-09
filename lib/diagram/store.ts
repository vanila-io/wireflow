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
} from '@xyflow/react';
import type { Graphic } from '@/lib/graphics';
import { fitGroups } from './groups';
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from './history';
import { ARROW, DEFAULT_EDGE_COLOR, isGroup, makeCard, newId, type Diagram, type DiagramEdge, type DiagramNode } from './model';
import { canGroup, copyItems, dropTargets, groupItems, pasteItems, removeItems, setGroupLabel, setHeaderText, setParents, toggleHeaders, ungroupItem, updateEdge, type Clip } from './ops';
import { enforceRules, serialize } from './rules';

export type StoreState = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  canUndo: boolean;
  canRedo: boolean;
  /** The last save failed (storage full or blocked); the diagram is only in memory. */
  saveFailed: boolean;
  /** While a card is dragged: the group it would join if dropped now. */
  dropTarget: string | null;
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
    dropTarget: null,
  };
  const listeners = new Set<() => void>();
  let clipboard: Clip | null = null;
  let pastes = 0;
  const emit = () => listeners.forEach((l) => l());

  const live = (): Diagram => ({ nodes: state.nodes, edges: state.edges });
  /** The current diagram as stored (through the rules). */
  const current = () => enforceRules(live()).diagram;

  // The save boundary. `kind` labels the undo step this change makes. Returns the
  // id of the step it recorded, or null if the stored diagram didn't change.
  function commit(next: Partial<Pick<StoreState, 'nodes' | 'edges' | 'dropTarget'>>, kind?: string): number | null {
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
  // of items that are still there (no flicker, and the detail panel stays open).
  function show(d: Diagram, select?: string[]) {
    const old = new Map<string, DiagramNode | DiagramEdge>([...state.nodes, ...state.edges].map((i) => [i.id, i]));
    const selected = (id: string) => (select ? select.includes(id) : !!old.get(id)?.selected);
    const nodes = d.nodes.map((n) => {
      const prev = old.get(n.id) as DiagramNode | undefined;
      return { ...n, selected: selected(n.id), ...(prev?.measured && { measured: prev.measured }) } as DiagramNode;
    });
    const edges = d.edges.map((e) => ({ ...e, selected: selected(e.id) }));
    return { nodes, edges };
  }

  function travel(move: (h: History) => History) {
    const next = move(history);
    if (next === history) return;
    history = next;
    state.saveFailed = !save(history.present.json);
    state = { ...state, ...show(JSON.parse(history.present.json)), canUndo: canUndo(history), canRedo: canRedo(history) };
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

  /** Selected nodes that can be grouped (two or more in the same group, or in none). */
  const groupable = () => {
    const ids = state.nodes.filter((n) => n.selected).map((n) => n.id);
    return canGroup(current(), ids) ? ids : null;
  };
  /** The one selected node, if it is a group. */
  const selectedGroup = () => {
    const selected = state.nodes.filter((n) => n.selected);
    return selected.length === 1 && isGroup(selected[0]) ? selected[0].id : null;
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
      let nodes = applyNodeChanges(changes, state.nodes);
      const moving = changes.filter((c) => c.type === 'position');
      const ended = moving.filter((c) => c.dragging === false).map((c) => c.id);
      let dropTarget: string | null = null;
      if (ended.length) {
        // A drag ended: a card dropped into a frame joins that group, one dragged
        // out leaves it, and frames wrap their members again.
        // If this ever fails, the move is still committed (and the drag state
        // cleared, without which nothing more would be saved).
        try {
          const parents = dropTargets(nodes, ended);
          nodes = Object.keys(parents).length ? (setParents({ nodes, edges: state.edges }, parents).nodes as DiagramNode[]) : fitGroups(nodes);
        } catch (error) {
          console.warn('Wireflow: could not update groups after a drag', error);
        }
      } else if (moving.some((c) => c.dragging)) {
        // While dragging, highlight the group the card would join.
        dropTarget = Object.values(dropTargets(nodes, moving.map((c) => c.id))).find((id) => id !== undefined) ?? null;
      }
      commit({ nodes, dropTarget });
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
    clear() {
      if (state.nodes.length) apply(() => ({ nodes: [], edges: [] }));
    },

    groupable,
    group() {
      const ids = groupable();
      if (!ids) return;
      const id = newId('group');
      apply((d) => groupItems(d, ids, { id }), { select: [id] });
    },
    selectedGroup,
    ungroup() {
      const id = selectedGroup();
      if (id) apply((d) => ungroupItem(d, id), { select: state.nodes.filter((n) => n.parentId === id).map((n) => n.id) });
    },
    /** An edge's colour (null or the default colour: none of its own) and label. Unchanged values add no step. */
    updateEdge(id: string, patch: { color?: string | null; label?: string }) {
      const color = patch.color === DEFAULT_EDGE_COLOR ? null : patch.color;
      apply((d) => updateEdge(d, id, { ...patch, ...(color !== undefined && { color }) }));
    },
    setGroupLabel(id: string, value: string) {
      apply((d) => setGroupLabel(d, id, value));
    },
    /** Copy the selected nodes (and the edges between them). Returns false if nothing is selected. */
    copy() {
      const ids = state.nodes.filter((n) => n.selected).map((n) => n.id);
      if (!ids.length) return false;
      clipboard = copyItems(current(), ids);
      pastes = 0;
      return true;
    },
    /** Paste with new ids, a little further down each time, and select the copy. */
    paste() {
      if (!clipboard) return;
      pastes += 1;
      const { diagram, ids } = pasteItems(current(), clipboard, { x: 20 * pastes, y: 20 * pastes });
      apply(() => diagram, { select: ids });
    },
    /**
     * Replace the whole diagram (Open file) as one undo step of `kind`. It is saved
     * first: if the browser refuses, nothing changes and this returns false.
     */
    replace(next: Diagram, kind = 'open') {
      const { diagram: d } = enforceRules(next);
      const json = serialize(d);
      if (json !== history.present.json) {
        if (!save(json)) return false;
        history = record(history, json, kind);
      }
      state = { ...state, ...show(d, []), saveFailed: false, canUndo: canUndo(history), canRedo: canRedo(history) };
      emit();
      return true;
    },
    /**
     * Show a diagram another tab has just saved, as an undo step of its own,
     * without writing it back (it is already stored).
     */
    adopt(next: Diagram) {
      const { diagram: d } = enforceRules(next);
      const json = serialize(d);
      if (json === history.present.json) return;
      history = record(history, json, 'sync');
      state = { ...state, ...show(d), dropTarget: null, canUndo: canUndo(history), canRedo: canRedo(history) };
      emit();
    },
    undo: () => travel(undo),
    redo: () => travel(redo),
  };
}
