import { describe, expect, it } from 'vitest';
import { graphicById } from '@/lib/graphics';
import { createDiagramStore } from '@/lib/diagram/store';
import { serialize } from '@/lib/diagram/rules';
import type { Diagram } from '@/lib/diagram/model';
import { card, edge } from './helpers';

function setup(initial: Diagram = { nodes: [card('a', 0, 0), card('b', 400, 0)], edges: [] }, history?: Parameters<typeof createDiagramStore>[0]['history']) {
  const saves: string[] = [];
  let full = false;
  const store = createDiagramStore({
    initial,
    save: (json) => {
      if (full) return false;
      saves.push(json);
      return true;
    },
    history,
  });
  const last = () => JSON.parse(saves[saves.length - 1]) as Diagram;
  return { store, saves, last, fill: () => (full = true) };
}

describe('diagram store', () => {
  it('saves nothing on load, on selection or on React Flow measuring', () => {
    const { store, saves } = setup();
    store.onNodesChange([{ type: 'select', id: 'a', selected: true }]);
    store.onNodesChange([{ type: 'dimensions', id: 'a', dimensions: { width: 220, height: 198 } }]);
    expect(saves).toEqual([]);
    expect(store.getState().canUndo).toBe(false);
  });

  it('saves a drag once, when it ends, as one undo step', () => {
    const { store, saves, last } = setup();
    for (let x = 1; x <= 5; x++) store.onNodesChange([{ type: 'position', id: 'a', position: { x: x * 10, y: 0 }, dragging: true }]);
    expect(saves).toHaveLength(0);
    store.onNodesChange([{ type: 'position', id: 'a', position: { x: 60, y: 0 }, dragging: false }]);
    expect(saves).toHaveLength(1);
    expect(last().nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 60, y: 0 });
    store.undo();
    expect(last().nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 0, y: 0 });
  });

  // #107: React Flow only offers handle-to-handle connections; the store also
  // refuses any connection whose ends aren't nodes, so no loose edge exists.
  it('creates an edge only between two existing nodes', () => {
    const { store, saves, last } = setup();
    expect(store.isValidConnection({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null })).toBe(true);
    expect(store.isValidConnection({ source: 'a', target: 'nowhere', sourceHandle: null, targetHandle: null })).toBe(false);
    store.onConnect({ source: 'a', target: 'nowhere', sourceHandle: null, targetHandle: null });
    expect(saves).toHaveLength(0);
    store.onConnect({ source: 'a', target: 'b', sourceHandle: null, targetHandle: null });
    expect(last().edges).toEqual([expect.objectContaining({ source: 'a', target: 'b', markerEnd: { type: 'arrowclosed' } })]);
  });

  it('never saves a dangling edge, whatever path produced it', () => {
    const { store, last } = setup();
    // An edge change that bypasses onConnect, e.g. a future feature or a bad batch.
    store.onEdgesChange([{ type: 'add', item: edge('loose', 'a', 'deleted') }, { type: 'add', item: edge('ok', 'a', 'b') }]);
    expect(last().edges.map((e) => e.id)).toEqual(['ok']);
    store.apply((d) => ({ ...d, edges: [...d.edges, edge('loose2', 'gone', 'b')] }));
    expect(last().edges.map((e) => e.id)).toEqual(['ok']);
  });

  it('deletes selected cards with their edges in one undo step', () => {
    const { store, last } = setup({ nodes: [card('a'), card('b', 400), card('c', 800)], edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')] });
    store.onNodesChange([{ type: 'select', id: 'b', selected: true }]);
    store.removeSelected();
    expect(last().nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(last().edges).toEqual([]);
    store.undo();
    expect(last().nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(last().edges.map((e) => e.id).sort()).toEqual(['ab', 'bc']);
  });

  it('applies a batch as one undo step, and redo restores the same ids', () => {
    const { store, last } = setup({ nodes: [], edges: [] });
    store.apply(() => ({ nodes: [card('x'), card('y', 300)], edges: [edge('xy', 'x', 'y')] }), { kind: 'ai' });
    expect(store.history().present.kind).toBe('ai');
    const after = serialize(last());
    store.undo();
    expect(last()).toEqual({ nodes: [], edges: [] });
    expect(store.getState().canUndo).toBe(false);
    store.redo();
    expect(serialize(last())).toBe(after);
  });

  // #105: undo and redo are saved too, so a reload shows the undone state.
  it('saves the result of undo and redo', () => {
    const { store, saves } = setup({ nodes: [], edges: [] });
    store.addCard(graphicById('article-article-1')!, { x: 1, y: 2 });
    expect(saves).toHaveLength(1);
    store.undo();
    expect(saves).toHaveLength(2);
    expect(JSON.parse(saves[1]).nodes).toEqual([]);
    store.redo();
    expect(JSON.parse(saves[2]).nodes).toHaveLength(1);
  });

  it('keeps the selection by id across undo and redo', () => {
    const { store } = setup({ nodes: [card('a'), card('b', 400)], edges: [edge('e', 'a', 'b')] });
    store.onEdgesChange([{ type: 'select', id: 'e', selected: true }]);
    store.toggleHeaders(['a']);
    store.undo();
    expect(store.getState().edges.find((e) => e.id === 'e')!.selected).toBe(true);
  });

  it('toggles headers and edits header text as undo steps', () => {
    const { store, last } = setup();
    store.toggleHeaders(['a']);
    expect(last().nodes.find((n) => n.id === 'a')!.data).toMatchObject({ showHeader: false });
    store.setHeaderText('b', '  Checkout  ');
    expect(last().nodes.find((n) => n.id === 'b')!.data).toMatchObject({ headerText: 'Checkout' });
    store.setHeaderText('b', '   ');
    expect(last().nodes.find((n) => n.id === 'b')!.data).toMatchObject({ headerText: 'Article' });
    store.undo();
    store.undo();
    store.undo();
    expect(last().nodes.find((n) => n.id === 'a')!.data).toMatchObject({ showHeader: true });
  });

  it('reports a failed save and keeps the diagram in memory', () => {
    const { store, fill } = setup();
    fill();
    store.toggleHeaders(['a']);
    expect(store.getState().saveFailed).toBe(true);
    expect(store.diagram().nodes.find((n) => n.id === 'a')!.data).toMatchObject({ showHeader: false });
  });

  // #109: opening a file that can't be stored must leave everything as it was.
  it('replaces the diagram as one undo step, or not at all if it cannot be saved', () => {
    const { store, last, fill } = setup();
    expect(store.replace({ nodes: [card('x')], edges: [] })).toBe(true);
    expect(last().nodes.map((n) => n.id)).toEqual(['x']);
    expect(store.history().present.kind).toBe('open');
    store.undo();
    expect(last().nodes.map((n) => n.id)).toEqual(['a', 'b']);

    fill();
    const before = store.getState();
    expect(store.replace({ nodes: [card('y')], edges: [] })).toBe(false);
    expect(store.getState()).toBe(before);
    expect(store.diagram().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(store.getState().canRedo).toBe(true);
  });

  it('continues a restored history only if it ends at the loaded diagram', () => {
    const first = setup({ nodes: [], edges: [] });
    first.store.addCard(graphicById('article-article-1')!, { x: 0, y: 0 });
    const history = first.store.history();
    const loaded = first.last();

    const resumed = setup(loaded, history);
    expect(resumed.store.getState().canUndo).toBe(true);
    resumed.store.undo();
    expect(resumed.last().nodes).toEqual([]);

    const other = setup({ nodes: [card('z')], edges: [] }, history);
    expect(other.store.getState().canUndo).toBe(false);
  });
});
