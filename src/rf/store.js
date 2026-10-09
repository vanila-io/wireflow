import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';

import { NODE_SIZE, HEADER_SHAPE, DEFAULT_EDGE_COLOR, DEFAULT_EDGE_SHAPE, fitGroups, fromG6, toG6, toRfEdge } from './convert';
import { canRedo, canUndo, createHistory, record, redo, undo } from './history';
import { copyItems, dropTargets, groupItems, pasteItems, removeItems, setParents, ungroupItem } from './ops';

// gg-editor's ids are 8 hex characters; keep new ids in the same style.
export const newId = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * State of the React Flow editor, outside React so that every change goes through one
 * place: apply it, and unless a drag is still in progress, save the diagram in the G6
 * format and record it as one undo step (unchanged JSON, e.g. a selection change, is
 * neither saved nor recorded). Components read it with useSyncExternalStore.
 *
 * `doc` is the G6-format diagram to start from; `save(json)` persists it.
 */
export function createDiagramStore({ doc, img, save }) {
  const loaded = fromG6(doc, { img });
  let json = JSON.stringify(toG6(loaded));
  let history = createHistory(json);
  let clipboard = null;
  let pastes = 0;
  let state = { nodes: loaded.nodes, edges: loaded.edges, dropped: loaded.dropped, dropTarget: null, canUndo: false, canRedo: false };
  const listeners = new Set();

  function set(next) {
    state = { ...state, ...next };
    if (!state.nodes.some((node) => node.dragging)) {
      const nextJson = JSON.stringify(toG6(state));
      if (nextJson !== json) {
        json = nextJson;
        save(json);
        history = record(history, json);
      }
    }
    state = { ...state, canUndo: canUndo(history), canRedo: canRedo(history) };
    listeners.forEach((listener) => listener());
  }

  // Replace the whole diagram (an undo step, a paste, an AI batch) and select `select`.
  function load(nextDoc, select = []) {
    const selected = new Set(select);
    const { nodes, edges } = fromG6(nextDoc);
    set({ nodes: nodes.map((node) => ({ ...node, selected: selected.has(node.id) })), edges, dropTarget: null });
  }

  const current = () => toG6(state);
  const selectedIds = () => [...state.nodes, ...state.edges].filter((item) => item.selected).map((item) => item.id);

  function travel(move) {
    history = move(history);
    json = history.present;
    save(json);
    load(JSON.parse(json));
  }

  // After a drag: update group membership (#81), then re-fit group frames like G6.
  function settle(nodes, movedIds) {
    const parents = dropTargets(nodes, movedIds);
    if (Object.keys(parents).length === 0) return fitGroups(nodes);
    const selected = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    return fromG6(setParents(toG6({ nodes }), parents)).nodes.map((node) => ({ ...node, selected: selected.has(node.id) }));
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,

    onNodesChange(changes) {
      let nodes = applyNodeChanges(changes, state.nodes);
      const moving = changes.filter((change) => change.type === 'position');
      const ended = moving.filter((change) => change.dragging === false).map((change) => change.id);
      let dropTarget = null;
      if (ended.length) {
        nodes = settle(nodes, ended);
      } else if (moving.some((change) => change.dragging)) {
        // Highlight the group a dragged item would join.
        const ids = moving.map((change) => change.id);
        dropTarget = Object.values(dropTargets(nodes, ids)).find((id) => id !== undefined) ?? null;
      }
      set({ nodes, dropTarget });
    },
    onEdgesChange(changes) {
      set({ edges: applyEdgeChanges(changes, state.edges) });
    },
    onConnect({ source, target, sourceHandle, targetHandle }) {
      const edge = toRfEdge(
        { id: newId(), source, target, shape: DEFAULT_EDGE_SHAPE, color: DEFAULT_EDGE_COLOR, style: { lineWidth: 2 } },
        { sourceHandle, targetHandle },
      );
      set({ edges: [...state.edges, edge] });
    },

    // Add a screen template centered on `center` (flow coordinates).
    addScreen({ img: url, label }, center) {
      const [width, height] = NODE_SIZE[HEADER_SHAPE];
      const id = newId();
      const node = {
        id,
        type: 'screen',
        position: { x: center.x - width / 2, y: center.y - height / 2 },
        width,
        height,
        selected: true,
        data: { img: url, label, shape: HEADER_SHAPE, header: true, g6: {} },
      };
      const nodes = [...state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node];
      set({ nodes: settle(nodes, [id]) });
    },

    remove() {
      const ids = selectedIds();
      if (ids.length) load(removeItems(current(), ids));
    },
    copy() {
      const ids = state.nodes.filter((node) => node.selected).map((node) => node.id);
      if (ids.length === 0) return;
      clipboard = copyItems(current(), ids);
      pastes = 0;
    },
    paste() {
      if (!clipboard) return;
      pastes += 1;
      const { data, ids } = pasteItems(current(), clipboard, { offset: { x: 20 * pastes, y: 20 * pastes }, newId });
      load(data, ids);
    },
    group() {
      const selected = state.nodes.filter((node) => node.selected);
      if (selected.length < 2 || new Set(selected.map((node) => node.parentId)).size > 1) return;
      const id = newId();
      load(groupItems(current(), selected.map((node) => node.id), { id, label: 'Group' }), [id]);
    },
    ungroup() {
      const [group, ...rest] = state.nodes.filter((node) => node.selected);
      if (group?.type === 'group' && rest.length === 0) load(ungroupItem(current(), group.id));
    },
    // Any batch of G6-format changes (e.g. an AI edit via ops.applyActions) as one undo step.
    apply(change, select = []) {
      load(change(current()), select);
    },
    undo: () => canUndo(history) && travel(undo),
    redo: () => canRedo(history) && travel(redo),
  };
}
