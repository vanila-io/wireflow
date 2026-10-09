import { describe, expect, it } from 'vitest';
import { EDGE_PALETTE, parseColor, toRgb } from '@/lib/color';
import { DEFAULT_EDGE_COLOR } from '@/lib/diagram/model';
import { usedColors } from '@/components/editor/EdgePanel';
import { createDiagramStore } from '@/lib/diagram/store';
import { card, edge } from './helpers';

describe('edge colours', () => {
  it('reads hex and rgb() and keeps edges opaque', () => {
    expect(parseColor('#E8590C')).toBe('#e8590c');
    expect(parseColor(' e8590c ')).toBe('#e8590c');
    expect(parseColor('#e8590c80')).toBe('#e8590c');
    expect(parseColor('#abc')).toBe('#aabbcc');
    expect(parseColor('rgb(232, 89, 12)')).toBe('#e8590c');
    expect(parseColor('rgba(232,89,12,0.5)')).toBe('#e8590c');
    expect(parseColor('rgb(232 89 12 / 50%)')).toBe('#e8590c');
    for (const bad of ['', 'red', '#12345', 'rgb(300, 0, 0)', 'url(x)', '#ggg']) expect(parseColor(bad)).toBeNull();
    expect(toRgb('#e8590c')).toBe('rgb(232, 89, 12)');
  });

  it("starts the palette with production's default edge colour", () => {
    expect(EDGE_PALETTE[0]).toBe(DEFAULT_EDGE_COLOR);
    expect(new Set(EDGE_PALETTE).size).toBe(EDGE_PALETTE.length);
  });

  it('lists the colours used in the diagram once each, newest edge first', () => {
    const edges = [edge('1', 'a', 'b'), edge('2', 'a', 'b', { style: { stroke: '#e8590c' } }), edge('3', 'a', 'b', { style: { stroke: '#13c2c2' } }), edge('4', 'a', 'b', { style: { stroke: '#e8590c' } })];
    expect(usedColors(edges)).toEqual(['#e8590c', '#13c2c2', DEFAULT_EDGE_COLOR]);
  });

  it('stores a colour as one undo step, the same colour as none, and the default as no colour', () => {
    const saves: string[] = [];
    const store = createDiagramStore({ initial: { nodes: [card('a'), card('b', 0, 400)], edges: [edge('e', 'a', 'b')] }, save: (j) => (saves.push(j), true) });
    store.updateEdge('e', { color: '#e8590c' });
    expect(JSON.parse(saves[0]).edges[0]).toMatchObject({ style: { stroke: '#e8590c' }, markerEnd: { type: 'arrowclosed', color: '#e8590c' } });
    store.updateEdge('e', { color: '#e8590c' });
    expect(saves).toHaveLength(1);
    store.updateEdge('e', { color: DEFAULT_EDGE_COLOR });
    expect(JSON.parse(saves[1]).edges[0]).toEqual(edge('e', 'a', 'b'));
    store.updateEdge('e', { label: '  Pay  ' });
    expect(JSON.parse(saves[2]).edges[0].label).toBe('Pay');
    store.undo();
    store.undo();
    expect(JSON.parse(saves[saves.length - 1]).edges[0]).toMatchObject({ style: { stroke: '#e8590c' } });
  });
});
