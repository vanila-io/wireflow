// Diagrams from the previous editor (gg-editor 2 / G6 2.x, used on app.wireflow.co
// and on staging until this rewrite): localStorage['data'], #109's wireflow.json
// files ({format: "wireflow", version: 1}) and plain {nodes, edges, groups}.
//
// G6 format                                     Wireflow (React Flow)
// node {id, x, y (centre), size: [96, 88],      card {id, type: "flow", position (top-left),
//   shape, img | template, label, parent}         parentId, data: {graphicId, src, label,
//                                                  headerText, showHeader}}
// group {id, label, parent, x?, y?}             group {id, type: "group", data: {label}},
//                                                  framed around its members
// edge {id, source, target, label, color, ...}  edge {id, source, target, label, style.stroke}
//
// Cards are 220px wide instead of 96px, so positions are scaled by 220/96 around
// the origin: the layout keeps its shape. Anchors, line shapes and widths have no
// counterpart (cards connect bottom to top) and are not kept.
import legacyTemplates from '@/data/legacy-templates.json';
import { graphicById, graphicBySrc, type Graphic } from '@/lib/graphics';
import { fitGroups } from './groups';
import { ARROW, cardSize, CARD_WIDTH, DEFAULT_EDGE_COLOR, makeCard, type Diagram, type DiagramEdge, type DiagramNode } from './model';
import { COLOR_RE } from './rules';

export const G6_NODE_WIDTH = 96;
export const SCALE = CARD_WIDTH / G6_NODE_WIDTH;
const PLAIN_SHAPE = 'node-image-without-header';
const G6_DEFAULT_COLOR = '#a4b2c0';

// "<folder>/<file name>" (the old src/assets/images layout, and #109's file keys) -> graphic id.
const byKey = legacyTemplates as Record<string, string>;
const byFileName = new Map(Object.entries(byKey).map(([key, id]) => [key.split('/')[1], id]));

function decode(url: string) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/**
 * The template behind an old node: its #109 file key, or its image URL from any
 * earlier build: Create React App (/static/media/<file>.<hash>.svg), Vite
 * (/assets/<file>-<hash>.svg) or production (/graphics/<category>/<slug>.svg).
 */
export function legacyGraphic(node: Record<string, unknown>): Graphic | undefined {
  if (typeof node.template === 'string') return graphicById(byKey[node.template] ?? '');
  if (typeof node.img !== 'string') return undefined;
  const url = decode(node.img);
  const old = /\/(?:static\/media\/(.+)\.[0-9a-f]{8}|assets\/(.+)-[\w-]{8})\.svg$/.exec(url);
  if (old) return graphicById(byFileName.get(old[1] ?? old[2]) ?? '');
  const current = /\/graphics\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.exec(url);
  return current ? graphicBySrc(current[0]) : undefined;
}

type G6Item = Record<string, unknown> & { id: string };
export type G6Diagram = { nodes: G6Item[]; edges: G6Item[]; groups: G6Item[] };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Convert a G6 diagram whose items are already checked (ids, positions, templates). */
export function fromG6(g6: G6Diagram): Diagram {
  const groupIds = new Set(g6.groups.map((g) => g.id));
  const parentOf = (item: G6Item) => (typeof item.parent === 'string' && groupIds.has(item.parent) ? item.parent : undefined);

  // Every item first at its absolute position; groups at the origin, so a member's
  // position relative to its group is its absolute position. fitGroups then frames
  // each group around its members and keeps everyone in place.
  const groups: DiagramNode[] = g6.groups.map((g) => ({
    id: g.id,
    type: 'group',
    position: { x: num(g.x) * SCALE, y: num(g.y) * SCALE },
    ...(parentOf(g) && { parentId: parentOf(g) }),
    data: { label: typeof g.label === 'string' ? g.label : 'Group' },
  }));
  const hasMembers = new Set([...g6.nodes, ...g6.groups].map(parentOf).filter(Boolean));
  groups.forEach((g) => {
    if (hasMembers.has(g.id)) g.position = { x: 0, y: 0 };
  });

  const cards: DiagramNode[] = g6.nodes.map((n) => {
    const graphic = legacyGraphic(n)!;
    const showHeader = n.shape !== PLAIN_SHAPE;
    const { width, height } = cardSize({ graphicId: graphic.id, showHeader });
    const card = makeCard(graphic, { x: num(n.x) * SCALE - width / 2, y: num(n.y) * SCALE - height / 2 }, n.id);
    card.data.showHeader = showHeader;
    if (typeof n.label === 'string') card.data.headerText = n.label;
    const parentId = parentOf(n);
    return parentId ? { ...card, parentId } : card;
  });

  const edges: DiagramEdge[] = g6.edges.map((e) => {
    const color = typeof e.color === 'string' ? e.color.toLowerCase() : undefined;
    const custom = color && COLOR_RE.test(color) && color !== G6_DEFAULT_COLOR && color !== DEFAULT_EDGE_COLOR ? color : undefined;
    return {
      id: e.id,
      source: e.source as string,
      target: e.target as string,
      markerEnd: custom ? { type: ARROW, color: custom } : { type: ARROW },
      ...(typeof e.label === 'string' && e.label && { label: e.label }),
      ...(custom && { style: { stroke: custom } }),
    };
  });

  return { nodes: fitGroups([...groups, ...cards]), edges };
}
