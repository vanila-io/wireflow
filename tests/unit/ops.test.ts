import { describe, expect, it } from 'vitest';
import { absoluteBoxes, fitGroups, GROUP_PADDING } from '@/lib/diagram/groups';
import { cardSize, type Diagram } from '@/lib/diagram/model';
import { canGroup, copyItems, dropTargets, groupItems, pasteItems, removeItems, setParents, ungroupItem } from '@/lib/diagram/ops';
import { enforceRules } from '@/lib/diagram/rules';
import { createDiagramStore } from '@/lib/diagram/store';
import { card, edge } from './helpers';

const H = cardSize({ graphicId: 'article-article-1' }).height;
const abs = (d: Diagram, id: string) => absoluteBoxes(d.nodes).get(id)!;
const two = (): Diagram => ({ nodes: [card('a', 0, 0), card('b', 300, 100)], edges: [edge('ab', 'a', 'b')] });

describe('groups', () => {
  it('a new group wraps its members and keeps them where they were', () => {
    const d = groupItems(two(), ['a', 'b'], { id: 'g', label: 'Checkout' });
    const g = d.nodes.find((n) => n.id === 'g')!;
    expect(d.nodes.findIndex((n) => n.id === 'g')).toBeLessThan(d.nodes.findIndex((n) => n.id === 'a'));
    expect(abs(d, 'a')).toMatchObject({ x: 0, y: 0 });
    expect(abs(d, 'b')).toMatchObject({ x: 300, y: 100 });
    expect(g.position).toEqual({ x: -GROUP_PADDING.left, y: -GROUP_PADDING.top });
    expect(g.width).toBe(300 + 220 + GROUP_PADDING.left + GROUP_PADDING.right);
    expect(g.height).toBeCloseTo(100 + H + GROUP_PADDING.top + GROUP_PADDING.bottom);
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0, parents: 0 });
  });

  it('groups only two or more nodes that share a parent', () => {
    const d = groupItems(two(), ['a', 'b'], { id: 'g' });
    expect(canGroup(two(), ['a'])).toBe(false);
    expect(canGroup({ ...d, nodes: [...d.nodes, card('c', 900, 0)] }, ['a', 'c'])).toBe(false);
    expect(canGroup(d, ['g', 'a'])).toBe(false);
  });

  it('nests groups, and ungrouping keeps members in place in the outer group', () => {
    let d: Diagram = { nodes: [card('a'), card('b', 300), card('c', 0, 400)], edges: [] };
    d = groupItems(d, ['a', 'b'], { id: 'inner' });
    d = groupItems(d, ['inner', 'c'], { id: 'outer' });
    expect(d.nodes.find((n) => n.id === 'inner')!.parentId).toBe('outer');
    const before = ['a', 'b', 'c'].map((id) => abs(d, id));
    d = ungroupItem(d, 'inner');
    expect(d.nodes.map((n) => n.id)).not.toContain('inner');
    expect(d.nodes.find((n) => n.id === 'a')!.parentId).toBe('outer');
    expect(['a', 'b', 'c'].map((id) => abs(d, id))).toEqual(before);
  });

  it('removing a group removes its contents and their edges', () => {
    const d = removeItems({ ...groupItems(two(), ['a', 'b'], { id: 'g' }), nodes: [...groupItems(two(), ['a', 'b'], { id: 'g' }).nodes, card('c', 900)] }, ['g']);
    expect(d.nodes.map((n) => n.id)).toEqual(['c']);
    expect(d.edges).toEqual([]);
  });

  it('a card dropped into a frame joins it, and dragged out of it leaves', () => {
    let d = groupItems(two(), ['a', 'b'], { id: 'g' });
    d = { ...d, nodes: [...d.nodes, card('c', 2000, 0)] };
    // Move c onto the frame (absolute 100,50 is inside it).
    const moved = d.nodes.map((n) => (n.id === 'c' ? { ...n, position: { x: 100, y: 50 } } : n));
    expect(dropTargets(moved, ['c'])).toEqual({ c: 'g' });
    // Move a far outside its frame (its position is relative to g).
    const out = d.nodes.map((n) => (n.id === 'a' ? { ...n, position: { x: 3000, y: 3000 } } : n));
    expect(dropTargets(out, ['a'])).toEqual({ a: undefined });
    const left = setParents({ nodes: out, edges: d.edges }, { a: undefined });
    expect(left.nodes.find((n) => n.id === 'a')!.parentId).toBeUndefined();
    // Moving the whole group keeps its members.
    expect(dropTargets(d.nodes, ['g', 'a', 'b'])).toEqual({});
  });

  it('re-fits frames when a member moves, keeping everything else in place', () => {
    const d = groupItems(two(), ['a', 'b'], { id: 'g' });
    const nodes = d.nodes.map((n) => (n.id === 'b' ? { ...n, position: { x: n.position.x + 200, y: n.position.y } } : n));
    const fitted = fitGroups(nodes);
    const g = fitted.find((n) => n.id === 'g')!;
    expect(g.width).toBe(500 + 220 + GROUP_PADDING.left + GROUP_PADDING.right);
    expect(absoluteBoxes(fitted).get('a')).toMatchObject({ x: 0, y: 0 });
    expect(absoluteBoxes(fitted).get('b')).toMatchObject({ x: 500, y: 100 });
  });
});

describe('copy and paste', () => {
  it('copies the edges between copied cards and re-links them to the copies (#70)', () => {
    const d: Diagram = { nodes: [card('a'), card('b', 300), card('c', 600)], edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')] };
    const clip = copyItems(d, ['a', 'b']);
    expect(clip.edges.map((e) => e.id)).toEqual(['ab']);
    const { diagram, ids } = pasteItems(d, clip, { x: 20, y: 20 });
    expect(ids).toHaveLength(2);
    const pastedEdge = diagram.edges.find((e) => !['ab', 'bc'].includes(e.id))!;
    expect(new Set([pastedEdge.source, pastedEdge.target])).toEqual(new Set(ids));
    expect(enforceRules(diagram).dropped.edges).toBe(0);
    const copyOfA = diagram.nodes.find((n) => n.id === ids[0])!;
    expect(copyOfA.position).toEqual({ x: 20, y: 20 });
  });

  it('copies a member without its group at its place on the canvas', () => {
    const d = groupItems(two(), ['a', 'b'], { id: 'g' });
    const clip = copyItems(d, ['b']);
    expect(clip.nodes[0].parentId).toBeUndefined();
    expect(clip.nodes[0].position).toEqual({ x: 300, y: 100 });
  });

  it('copies a group with its contents and new ids', () => {
    const d = groupItems(two(), ['a', 'b'], { id: 'g' });
    const { diagram, ids } = pasteItems(d, copyItems(d, ['g']), { x: 40, y: 40 });
    expect(ids).toHaveLength(1);
    const kids = diagram.nodes.filter((n) => n.parentId === ids[0]);
    expect(kids).toHaveLength(2);
    expect(new Set(diagram.nodes.map((n) => n.id)).size).toBe(diagram.nodes.length);
  });
});

describe('batch operations in the store are single undo steps', () => {
  const setup = () => {
    const saves: string[] = [];
    const store = createDiagramStore({ initial: two(), save: (j) => (saves.push(j), true) });
    const last = () => JSON.parse(saves[saves.length - 1]) as Diagram;
    return { store, last };
  };

  it('group and paste each undo at once', () => {
    const { store, last } = setup();
    store.onNodesChange([
      { type: 'select', id: 'a', selected: true },
      { type: 'select', id: 'b', selected: true },
    ]);
    store.group();
    expect(last().nodes.filter((n) => n.type === 'group')).toHaveLength(1);
    const groupId = last().nodes.find((n) => n.type === 'group')!.id;
    expect(store.getState().nodes.find((n) => n.id === groupId)!.selected).toBe(true);

    expect(store.copy()).toBe(true);
    store.paste();
    expect(last().nodes).toHaveLength(6);
    expect(last().edges).toHaveLength(2);
    store.undo();
    expect(last().nodes).toHaveLength(3);
    store.undo();
    expect(last().nodes.map((n) => n.type)).toEqual(['flow', 'flow']);
    expect(last().nodes.map((n) => n.position)).toEqual([{ x: 0, y: 0 }, { x: 300, y: 100 }]);
  });

  it('a drag that ends inside a frame puts the card in the group, as one step', () => {
    const { store, last } = setup();
    store.apply((d) => ({ ...groupItems(d, ['a', 'b'], { id: 'g' }), nodes: [...groupItems(d, ['a', 'b'], { id: 'g' }).nodes, card('c', 2000, 0)] }));
    store.onNodesChange([{ type: 'position', id: 'c', position: { x: 100, y: 50 }, dragging: true }]);
    expect(store.getState().dropTarget).toBe('g');
    store.onNodesChange([{ type: 'position', id: 'c', position: { x: 100, y: 50 }, dragging: false }]);
    expect(store.getState().dropTarget).toBeNull();
    expect(last().nodes.find((n) => n.id === 'c')!.parentId).toBe('g');
    store.undo();
    expect(last().nodes.find((n) => n.id === 'c')).toMatchObject({ position: { x: 2000, y: 0 } });
    expect(last().nodes.find((n) => n.id === 'c')!.parentId).toBeUndefined();
  });
});
