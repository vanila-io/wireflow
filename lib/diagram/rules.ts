// The rules every stored diagram follows. Every write goes through
// `enforceRules` (the store's save boundary, store.ts), and so does everything
// read back from storage or a file, so no path can store or draw a diagram that
// breaks them:
//
// - every node and edge has a non-empty string id, unique across the diagram;
// - a card shows a catalog graphic, and its image URL is the catalog's;
// - a parentId names an existing group, parent chains have no loops, and
//   parents come before their children (React Flow requires it);
// - every edge connects two existing cards (no loose or dangling edges);
// - only known fields are kept, so nothing like "__proto__" gets through, and
//   React Flow's selection, drag state and measurements never reach storage.
//
// It never throws on bad input: what it can't keep it drops, and it counts what
// it dropped so callers can tell the user.
import { graphicById } from "@/lib/graphics";
import { EMPTY_GROUP, fitGroups } from "./groups";
import { ARROW, isGroup, type CardNode, type Diagram, type DiagramEdge, type DiagramNode, type GroupNode } from "./model";

// `parents` (only when there were any): items taken out of a group that doesn't
// exist or contains itself.
export type Dropped = { nodes: number; edges: number; parents?: number };

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export const MAX_LABEL = 200;
export const COLOR_RE = /^#[0-9a-f]{6}$/;

// JSON.parse reviver for anything that came from outside the app.
export const dropProto = (key: string, value: unknown) => (key === "__proto__" ? undefined : value);

function position(v: unknown) {
  return isObject(v) && isNum(v.x) && isNum(v.y) ? { x: v.x, y: v.y } : undefined;
}

function card(raw: Obj, id: string): CardNode | undefined {
  const pos = position(raw.position);
  const data = raw.data;
  if (raw.type !== "flow" || !pos || !isObject(data) || !isId(data.graphicId)) return undefined;
  const graphic = graphicById(data.graphicId);
  if (!graphic) return undefined;
  const headerText = text(data.headerText, MAX_LABEL);
  return {
    id,
    type: "flow",
    position: pos,
    ...(isId(raw.parentId) && { parentId: raw.parentId }),
    data: {
      graphicId: graphic.id,
      src: graphic.src,
      label: text(data.label, MAX_LABEL) ?? graphic.label,
      ...(headerText !== undefined && { headerText }),
      ...(typeof data.showHeader === "boolean" && { showHeader: data.showHeader }),
    },
  };
}

function group(raw: Obj, id: string): GroupNode | undefined {
  const pos = position(raw.position);
  if (raw.type !== "group" || !pos) return undefined;
  const data = isObject(raw.data) ? raw.data : {};
  // A group always has a size: React Flow would draw one without it as a 150px sliver.
  const size =
    isNum(raw.width) && isNum(raw.height) && raw.width > 0 && raw.height > 0
      ? { width: raw.width, height: raw.height }
      : { ...EMPTY_GROUP };
  return {
    id,
    type: "group",
    position: pos,
    ...(isId(raw.parentId) && { parentId: raw.parentId }),
    ...size,
    data: { label: text(data.label, MAX_LABEL) ?? "Group" },
  };
}

function edge(raw: Obj, id: string): DiagramEdge | undefined {
  if (!isId(raw.source) || !isId(raw.target)) return undefined;
  const label = text(raw.label, MAX_LABEL);
  const stroke =
    isObject(raw.style) && typeof raw.style.stroke === "string" ? raw.style.stroke.toLowerCase() : undefined;
  const color = stroke && COLOR_RE.test(stroke) ? stroke : undefined;
  return {
    id,
    source: raw.source,
    target: raw.target,
    markerEnd: color ? { type: ARROW, color } : { type: ARROW },
    ...(label && { label }),
    ...(color && { style: { stroke: color } }),
  };
}

export function enforceRules(input: unknown): { diagram: Diagram; dropped: Dropped } {
  const dropped: Dropped = { nodes: 0, edges: 0 };
  const rawNodes = isObject(input) && Array.isArray(input.nodes) ? input.nodes : [];
  const rawEdges = isObject(input) && Array.isArray(input.edges) ? input.edges : [];

  const ids = new Set<string>();
  const nodes: DiagramNode[] = [];
  for (const raw of rawNodes) {
    const id = isObject(raw) && isId(raw.id) && !ids.has(raw.id) ? raw.id : undefined;
    const node = id === undefined ? undefined : (card(raw as Obj, id) ?? group(raw as Obj, id));
    if (!node) {
      dropped.nodes++;
      continue;
    }
    ids.add(node.id);
    nodes.push(node);
  }

  // Parents must be groups, and following parents must end. A broken link is
  // cut, which leaves that item at the top level, where it is drawn.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cut = (node: DiagramNode) => {
    delete node.parentId;
    dropped.parents = (dropped.parents ?? 0) + 1;
  };
  for (const node of nodes) {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    if (node.parentId !== undefined && !(parent && isGroup(parent))) cut(node);
  }
  for (const node of nodes) {
    const seen = new Set([node.id]);
    for (let p = node.parentId; p !== undefined; p = byId.get(p)!.parentId) {
      if (seen.has(p)) {
        cut(node);
        break;
      }
      seen.add(p);
    }
  }
  // Parents before children, otherwise in the given order (the drawing order).
  const depth = (node: DiagramNode) => {
    let d = 0;
    for (let p = node.parentId; p !== undefined; p = byId.get(p)!.parentId) d++;
    return d;
  };
  const ordered = nodes
    .map((node, index) => ({ node, index, depth: depth(node) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((o) => o.node);

  // Groups have no handles, so a connection joins two cards.
  const nodeIds = new Set(nodes.filter((n) => n.type === "flow").map((n) => n.id));
  const edges: DiagramEdge[] = [];
  for (const raw of rawEdges) {
    const id = isObject(raw) && isId(raw.id) && !ids.has(raw.id) ? raw.id : undefined;
    const e = id === undefined ? undefined : edge(raw as Obj, id);
    if (!e || !nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      dropped.edges++;
      continue;
    }
    ids.add(e.id);
    edges.push(e);
  }

  return { diagram: { nodes: ordered, edges }, dropped };
}

// A diagram as stored: only what the rules keep.
export const serialize = (diagram: Diagram) => JSON.stringify(enforceRules(diagram).diagram);

// For a diagram from outside (storage, a file, another tab): the rules, then
// every group framed around its members (a hand-made file may give groups no size).
export function enforceRulesOnLoad(input: unknown): { diagram: Diagram; dropped: Dropped } {
  const { diagram, dropped } = enforceRules(input);
  return { diagram: { nodes: fitGroups(diagram.nodes), edges: diagram.edges }, dropped };
}
