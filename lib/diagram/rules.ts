// The rules every stored diagram follows. Every write goes through
// `enforceRules` (the store's save boundary, store.ts), and so does everything
// read back from storage or a file, so no path can store or draw a diagram that
// breaks them:
//
// - every node and edge has a non-empty string id, unique across the diagram;
// - a card shows a catalog graphic, and its image URL is the catalog's;
// - no node has a parent (the editor has no groups), so there are no parent loops;
// - every edge connects two existing nodes (no loose or dangling edges);
// - only known fields are kept, so nothing like "__proto__" gets through, and
//   React Flow's selection, drag state and measurements never reach storage.
//
// It never throws on bad input: what it can't keep it drops, and it counts what
// it dropped so callers can tell the user.
import { graphicById } from "@/lib/graphics";
import { ARROW, type CardNode, type Diagram, type DiagramEdge } from "./model";

export type Dropped = { nodes: number; edges: number };

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
    data: {
      graphicId: graphic.id,
      src: graphic.src,
      label: text(data.label, MAX_LABEL) ?? graphic.label,
      ...(headerText !== undefined && { headerText }),
      ...(typeof data.showHeader === "boolean" && { showHeader: data.showHeader }),
    },
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
  const nodes: CardNode[] = [];
  for (const raw of rawNodes) {
    const id = isObject(raw) && isId(raw.id) && !ids.has(raw.id) ? raw.id : undefined;
    const node = id === undefined ? undefined : card(raw as Obj, id);
    if (!node) {
      dropped.nodes++;
      continue;
    }
    ids.add(node.id);
    nodes.push(node);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
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

  return { diagram: { nodes, edges }, dropped };
}

// A diagram as stored: only what the rules keep.
export const serialize = (diagram: Diagram) => JSON.stringify(enforceRules(diagram).diagram);
