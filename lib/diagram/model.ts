// The diagram, as React Flow draws it and as Wireflow stores it.
//
// The editor has always saved React Flow's own shape in
// localStorage["wireflow-flow-v1"]: {nodes, edges}. That is version 1 (no
// "version" field). Version 2 adds the field, group nodes (React Flow parent
// nodes, as in the earlier gg-editor app) and edges with a label and a colour;
// everything a version 1 diagram holds keeps its meaning, so version 1 data is
// read as it is (see migrate in storage.ts), and the editor before this change
// can still read what version 2 writes (a group is React Flow's built-in
// "group" node type there). Edges may also carry a line shape (React Flow's
// edge `type`) and a width (style.strokeWidth), as in the earlier editor.
//
// Version 3 adds note nodes (#83): free text in a resizable box that connects
// like a card. An editor that knows only version 2 would drop them, so it sees
// version 3 data as newer and doesn't save over it (see readDiagram).
import type { Edge, Node } from "@xyflow/react";
import graphicSizes from "@/lib/graphic-sizes.json";
import { graphicById, type Graphic } from "@/lib/graphics";

export const STORAGE_KEY = "wireflow-flow-v1";
export const DIAGRAM_VERSION = 3;

// The same fields flow-node.tsx has always used.
export type CardData = {
  graphicId: string;
  src: string;
  label: string;
  headerText?: string;
  showHeader?: boolean;
};
export type GroupData = { label: string };
export type NoteData = { text: string };

export type CardNode = Node<CardData, "flow">;
export type GroupNode = Node<GroupData, "group">;
export type NoteNode = Node<NoteData, "note">;
export type DiagramNode = CardNode | GroupNode | NoteNode;
export type DiagramEdge = Edge;

export type Diagram = { nodes: DiagramNode[]; edges: DiagramEdge[] };

export const isCard = (node: Node): node is CardNode => node.type === "flow";
export const isGroup = (node: Node): node is GroupNode => node.type === "group";
export const isNote = (node: Node): node is NoteNode => node.type === "note";
/** What a connection can join: cards and notes (groups have no handles). */
export const isConnectable = (node: Node): node is CardNode | NoteNode => isCard(node) || isNote(node);

// Notes (#83): a box of free text, stored with its size (React Flow's node
// width and height), resizable within these bounds.
export const NOTE_SIZE = { width: 220, height: 120 };
export const NOTE_BOUNDS = { minWidth: 120, minHeight: 48, maxWidth: 800, maxHeight: 800 };
export const MAX_NOTE_TEXT = 2000;

export function makeNote(position: { x: number; y: number }, text = "", id = newId("note")): NoteNode {
  return { id, type: "note", position, ...NOTE_SIZE, data: { text } };
}

// Card geometry, from components/editor/editor.css: a 220px wide box with a 1px
// border, a 24px header and the graphic drawn at the inner width.
export const CARD_WIDTH = 220;
const BORDER = 1;
const HEADER = 24;
const ratios = graphicSizes as Record<string, number>;
// Graphics share one aspect ratio within a few percent; this is the median.
const DEFAULT_RATIO = 0.7872;

export function cardSize(data: Pick<CardData, "graphicId" | "showHeader">): {
  width: number;
  height: number;
} {
  const ratio = ratios[data.graphicId] ?? DEFAULT_RATIO;
  const header = data.showHeader === false ? 0 : HEADER;
  return { width: CARD_WIDTH, height: 2 * BORDER + header + (CARD_WIDTH - 2 * BORDER) * ratio };
}

// New card ids, as the editor has always made them: <graphic id>-<time>-<random>.
export const newCardId = (graphicId: string) => `${graphicId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Ids for edges and groups made by Wireflow itself (not React Flow's addEdge).
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function makeCard(g: Graphic, position: { x: number; y: number }, id = newCardId(g.id)): CardNode {
  return {
    id,
    type: "flow",
    position,
    data: { graphicId: g.id, src: g.src, label: g.label, headerText: g.label, showHeader: true },
  };
}

// The template a card shows. Its image URL is always the catalog's, whatever was
// saved, so stored or opened data can't point an image at another host.
export const cardGraphic = (data: Pick<CardData, "graphicId">) => graphicById(data.graphicId);

// How an edge without a colour or width of its own is drawn: #a3a8c3 at 2px,
// what globals.css always meant (and close to the earlier app's #a4b2c0 at 2px).
// editor.css sets React Flow's --xy-edge-stroke-default and
// --xy-edge-stroke-width-default to these values; keep the two in step. The
// panel shows the colour and width that are drawn.
export const DEFAULT_EDGE_COLOR = "#a3a8c3";
export const ARROW = "arrowclosed" as const;

// Line shapes, as the earlier editor named them, and the React Flow edge type
// that draws each. Smooth (a bezier curve) is React Flow's default type, which
// edges without a `type` already use, so it is never stored.
export const EDGE_SHAPES = [
  { shape: "smooth", label: "Smooth", type: undefined },
  { shape: "polyline", label: "Polyline", type: "step" },
  { shape: "polyline-round", label: "Rounded polyline", type: "smoothstep" },
] as const;
export type EdgeShape = (typeof EDGE_SHAPES)[number]["shape"];
export const edgeShape = (e: Pick<DiagramEdge, "type">): EdgeShape =>
  EDGE_SHAPES.find((s) => s.type === e.type)?.shape ?? "smooth";
export const edgeType = (shape: EdgeShape) => EDGE_SHAPES.find((s) => s.shape === shape)?.type;

// Line width in px, 1 to 10 as in the earlier editor; the default (see above)
// is never stored.
export const DEFAULT_EDGE_WIDTH = 2;
export const MIN_EDGE_WIDTH = 1;
export const MAX_EDGE_WIDTH = 10;
export const edgeWidth = (e: Pick<DiagramEdge, "style">) =>
  typeof e.style?.strokeWidth === "number" ? e.style.strokeWidth : DEFAULT_EDGE_WIDTH;
