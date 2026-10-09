import { describe, expect, it } from 'vitest';
import { DiagramFileError, parseFile, parseLegacyStorage, serializeFile, MAX_NODES } from '@/lib/diagram/file';
import { absoluteBoxes } from '@/lib/diagram/groups';
import { SCALE, legacyGraphic } from '@/lib/diagram/legacy';
import { cardSize, isCard, isGroup, type CardNode, type Diagram } from '@/lib/diagram/model';
import { copyItems, groupItems, pasteItems } from '@/lib/diagram/ops';
import { serialize } from '@/lib/diagram/rules';
import legacyTemplates from '@/data/legacy-templates.json';
import graphics from '@/data/graphics.json';
import { card, edge, PRODUCTION_SAMPLE } from './helpers';

const sample = (): Diagram => {
  const d: Diagram = {
    nodes: [
      card('a', 0, 0),
      { ...card('b', 300, 0), data: { graphicId: 'e-commerce-cart', src: '/graphics/e-commerce/cart.svg', label: 'Cart', headerText: 'Basket', showHeader: false } },
      card('c', 600, 300),
    ],
    edges: [edge('ab', 'a', 'b', { label: 'Buy', style: { stroke: '#e8590c' }, markerEnd: { type: 'arrowclosed', color: '#e8590c' } }), edge('bc', 'b', 'c')],
  };
  return groupItems(d, ['a', 'b'], { id: 'g', label: 'Checkout' });
};

const reject = (text: string, message: RegExp) => {
  expect(() => parseFile(text)).toThrow(DiagramFileError);
  expect(() => parseFile(text)).toThrow(message);
};

describe('wireflow.json', () => {
  it('writes a versioned file that names templates by id, without image URLs', () => {
    const file = JSON.parse(serializeFile(sample()));
    expect(file).toMatchObject({ format: 'wireflow', version: 2 });
    const cards = file.diagram.nodes.filter((n: CardNode) => n.type === 'flow');
    expect(cards.map((n: CardNode) => n.data.graphicId).sort()).toEqual(['article-article-1', 'article-article-1', 'e-commerce-cart']);
    expect(JSON.stringify(file)).not.toContain('/graphics/');
  });

  it('opens what it saves, unchanged', () => {
    const d = sample();
    const { diagram, dropped } = parseFile(serializeFile(d));
    expect(serialize(diagram)).toBe(serialize(d));
    expect(dropped).toEqual({ nodes: 0, edges: 0, parents: 0 });
  });

  it('opens everything the editor can make: nested groups, edges to groups, copies, hidden headers', () => {
    let d = sample();
    d = groupItems({ ...d, nodes: [...d.nodes, card('d', 900, 300)] }, ['c', 'd'], { id: 'g2' });
    d = groupItems(d, ['g', 'g2'], { id: 'outer' });
    d = { ...d, edges: [...d.edges, edge('to-group', 'd', 'g')] };
    const pasted = pasteItems(d, copyItems(d, ['outer']), { x: 40, y: 40 }).diagram;
    expect(serialize(parseFile(serializeFile(pasted)).diagram)).toBe(serialize(pasted));
  });

  it("opens production's Export JSON (plain React Flow {nodes, edges})", () => {
    const { diagram } = parseFile(JSON.stringify(PRODUCTION_SAMPLE));
    expect(diagram.nodes.map((n) => n.id)).toEqual(PRODUCTION_SAMPLE.nodes.map((n) => n.id));
    expect(diagram.edges).toHaveLength(1);
  });

  // Review finding: React Flow draws a group without a size as a 150px sliver.
  it('gives every group a real frame: around its members, or a default size when empty', () => {
    const file = {
      nodes: [
        { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: { label: 'G' } },
        { ...card('a', 20, 50), parentId: 'g' },
        { id: 'empty', type: 'group', position: { x: 900, y: 0 }, data: { label: 'E' } },
      ],
      edges: [],
    };
    const { diagram } = parseFile(JSON.stringify(file));
    const g = diagram.nodes.find((n) => n.id === 'g')!;
    expect(g.width).toBe(220 + 32);
    expect(g.height).toBeCloseTo(cardSize({ graphicId: 'article-article-1' }).height + 52);
    expect(absoluteBoxes(diagram.nodes).get('a')).toMatchObject({ x: 20, y: 50 });
    expect(diagram.nodes.find((n) => n.id === 'empty')).toMatchObject({ width: 252, height: 120 });
    const legacyEmpty = parseFile(JSON.stringify({ nodes: [], edges: [], groups: [{ id: 'lone', label: 'Lone', x: 10, y: 10 }] })).diagram;
    expect(legacyEmpty.nodes[0]).toMatchObject({ width: 252, height: 120 });
  });

  it('drops connections with a missing end and says how many', () => {
    const d = { nodes: [card('a'), card('b')], edges: [edge('ok', 'a', 'b'), edge('x', 'a', 'gone')] };
    const { diagram, dropped } = parseFile(JSON.stringify(d));
    expect(diagram.edges.map((e) => e.id)).toEqual(['ok']);
    expect(dropped.edges).toBe(1);
  });

  it('drops __proto__ keys, so a file cannot change Object.prototype', () => {
    const text = `{"nodes":[{"id":"a","type":"flow","position":{"x":0,"y":0},"data":{"graphicId":"article-article-1","__proto__":{"polluted":true}},"__proto__":{"polluted":true}}],"edges":[]}`;
    const { diagram } = parseFile(text);
    expect(diagram.nodes).toHaveLength(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(diagram)).not.toContain('polluted');
  });

  it("rejects files that aren't Wireflow diagrams, or are newer", () => {
    reject('not json', /isn't a JSON file/);
    reject('{"name":"wireflow","version":"1.0.0"}', /doesn't contain a Wireflow diagram/);
    reject('{"format":"excalidraw","version":2,"elements":[]}', /isn't a Wireflow file/);
    reject('{"format":"wireflow","version":3,"diagram":{"nodes":[],"edges":[]}}', /newer version/);
    reject('{"format":"wireflow","version":"2","diagram":{"nodes":[],"edges":[]}}', /unknown file version/);
    reject('{"format":"wireflow","version":2}', /doesn't contain a Wireflow diagram/);
  });

  it('rejects diagrams the editor could not show or that would hang the tab', () => {
    const file = (nodes: unknown[], edges: unknown[] = []) => JSON.stringify({ format: 'wireflow', version: 2, diagram: { nodes, edges } });
    reject(file([{ ...card('a'), id: 1 }]), /id is missing or isn't text/);
    reject(file([card('a'), card('a')]), /more than one item with the id "a"/);
    reject(file([card('a')], [edge('a', 'a', 'a')]), /more than one item with the id "a"/);
    reject(file([{ ...card('a'), position: { x: 'left' } }]), /has no position/);
    reject(file([{ ...card('a'), data: { graphicId: 'no-such-template' } }]), /doesn't have: "no-such-template"/);
    reject(file([{ ...card('a'), data: { graphicId: 'article-article-1', label: 5 } }]), /label that isn't text/);
    reject(file([{ ...card('a'), parentId: 'nope' }]), /in a group that doesn't exist/);
    reject(file([{ id: 'g1', type: 'group', position: { x: 0, y: 0 }, parentId: 'g2', data: {} }, { id: 'g2', type: 'group', position: { x: 0, y: 0 }, parentId: 'g1', data: {} }]), /inside itself/);
    reject(file([{ ...card('a'), type: 'input' }]), /isn't a card or a group/);
    reject(file(Array.from({ length: MAX_NODES + 1 }, (_, i) => card(`n${i}`))), /more items than Wireflow can show/);
  });
});

describe('files and storage from the previous editor (gg-editor / G6)', () => {
  // A file saved by #109 on staging: template keys, a group, a coloured edge and a
  // loose edge that the old editor allowed.
  const v1 = {
    format: 'wireflow',
    version: 1,
    diagram: {
      nodes: [
        { type: 'node', size: [96, 88], label: 'Sign in', x: 100, y: 100, id: '3a85f3e3', shape: 'node-image-header', template: 'Sign in/Sign in 1', parent: 'grp1' },
        { type: 'node', size: [96, 78], label: 'Cart', x: 300, y: 100, id: '24e3e373', shape: 'node-image-without-header', template: 'E-Commerce/Cart', parent: 'grp1' },
        { type: 'node', size: [96, 88], label: 'Thanks', x: 500, y: 300, id: 'aa000001', shape: 'node-image-header', template: 'Misc/Error' },
      ],
      edges: [
        { source: '3a85f3e3', sourceAnchor: 1, target: '24e3e373', targetAnchor: 3, shape: 'flow-polyline-round', color: '#E8590C', style: { lineWidth: 2 }, id: '13396ba6', label: 'Add' },
        { source: '24e3e373', target: 'aa000001', color: '#a4b2c0', id: 'e2' },
        { source: '24e3e373', target: { x: 300, y: 560 }, id: 'loose' },
      ],
      groups: [{ id: 'grp1', label: 'Shop', x: 42, y: 50 }],
    },
  };

  it('maps every old template key to a production graphic, one to one', () => {
    const ids = Object.values(legacyTemplates);
    expect(new Set(ids).size).toBe(graphics.length);
    expect(new Set(ids)).toEqual(new Set(graphics.map((g) => g.id)));
  });

  it("opens #109's version 1 files, scaling the layout to the new card size", () => {
    expect(legacyGraphic({ template: 'Misc/Error' })).toBeDefined();
    const { diagram, dropped } = parseFile(JSON.stringify(v1));
    expect(dropped.edges).toBe(1);
    const cards = diagram.nodes.filter(isCard);
    const byId = Object.fromEntries(cards.map((n) => [n.id, n]));
    expect(byId['3a85f3e3'].data).toMatchObject({ graphicId: 'sign-in-sign-in-1', headerText: 'Sign in', showHeader: true });
    expect(byId['24e3e373'].data).toMatchObject({ graphicId: 'e-commerce-cart', headerText: 'Cart', showHeader: false });
    // Centres scale by 220/96 around the origin.
    const boxes = absoluteBoxes(diagram.nodes);
    for (const n of v1.diagram.nodes) {
      const b = boxes.get(n.id)!;
      expect(b.x + b.width / 2).toBeCloseTo(n.x * SCALE);
      expect(b.y + b.height / 2).toBeCloseTo(n.y * SCALE);
      expect(b.height).toBeCloseTo(cardSize(byId[n.id].data).height);
    }
    const group = diagram.nodes.find(isGroup)!;
    expect(group).toMatchObject({ id: 'grp1', data: { label: 'Shop' } });
    expect(cards.filter((n) => n.parentId === 'grp1').map((n) => n.id).sort()).toEqual(['24e3e373', '3a85f3e3']);
    const [colored, plain] = diagram.edges;
    expect(colored).toMatchObject({ id: '13396ba6', label: 'Add', style: { stroke: '#e8590c' }, markerEnd: { color: '#e8590c' } });
    // The old default colour becomes the new default (no colour of its own).
    expect(plain).toEqual({ id: 'e2', source: '24e3e373', target: 'aa000001', markerEnd: { type: 'arrowclosed' } });
  });

  it('opens a plain G6 diagram with image URLs of any earlier build', () => {
    const plain = {
      nodes: [
        { id: 'n1', x: 10, y: 10, shape: 'node-image-header', img: '/static/media/Cart.2ae03932.svg', label: 'Cart' },
        { id: 'n2', x: 200, y: 10, shape: 'node-image-header', img: '/assets/Sign%20Up%201-BfX1a2b3.svg', label: 'Join' },
        { id: 'n3', x: 400, y: 10, img: 'https://app.wireflow.co/static/media/Article 1.5e1c7a0b.svg' },
        { id: 'n4', x: 600, y: 10, img: '/graphics/blog/articles-2.svg' },
      ],
      edges: [{ id: 'e', source: 'n1', target: 'n2' }],
    };
    const { diagram } = parseFile(JSON.stringify(plain));
    expect(diagram.nodes.map((n) => isCard(n) && n.data.graphicId)).toEqual(['e-commerce-cart', 'sign-in-sign-up-1', 'article-article-1', 'blog-articles-2']);
    expect(diagram.edges).toHaveLength(1);
  });

  it('rejects old files with unknown templates or a group inside itself', () => {
    const bad = structuredClone(v1);
    bad.diagram.nodes[0].template = 'Misc/Spaceship';
    reject(JSON.stringify(bad), /doesn't have: "Misc\/Spaceship"/);
    const custom = { nodes: [{ id: 'n', x: 0, y: 0, img: 'https://example.com/x.png' }], edges: [] };
    reject(JSON.stringify(custom), /doesn't show one of Wireflow's screen templates/);
    const loop = { nodes: [], edges: [], groups: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }] };
    reject(JSON.stringify(loop), /inside itself/);
  });

  it("brings over the previous editor's localStorage['data'], or nothing", () => {
    expect(parseLegacyStorage(JSON.stringify(v1.diagram))?.nodes.filter(isCard)).toHaveLength(3);
    expect(parseLegacyStorage('null')).toBeNull();
    expect(parseLegacyStorage('{"nodes":[],"edges":[]}')).toBeNull();
    expect(parseLegacyStorage('garbage')).toBeNull();
  });
});
