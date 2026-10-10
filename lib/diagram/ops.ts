// Pure operations on a diagram. The store applies each one as a single undo step.
import { ARROW, newCardId, newId, type Diagram, type DiagramEdge } from "./model";

// Remove nodes and edges, plus the edges left without an end.
export function removeItems(d: Diagram, ids: Iterable<string>): Diagram {
  const removed = new Set(ids);
  return {
    nodes: d.nodes.filter((n) => !removed.has(n.id)),
    edges: d.edges.filter((e) => !removed.has(e.id) && !removed.has(e.source) && !removed.has(e.target)),
  };
}

export type Clip = Diagram;

// The given cards and the connections between them.
export function copyItems(d: Diagram, ids: Iterable<string>): Clip {
  const copied = new Set(ids);
  return {
    nodes: d.nodes.filter((n) => copied.has(n.id)),
    edges: d.edges.filter((e) => copied.has(e.source) && copied.has(e.target)),
  };
}

// Paste a copy with new ids, moved by `offset`. Returns the ids of the pasted
// cards, so the editor can select them.
export function pasteItems(
  d: Diagram,
  clip: Clip,
  offset: { x: number; y: number }
): { diagram: Diagram; ids: string[] } {
  const ids = new Map<string, string>();
  clip.nodes.forEach((n) => ids.set(n.id, newCardId(n.data.graphicId)));
  clip.edges.forEach((e) => ids.set(e.id, newId("edge")));
  const nodes = clip.nodes.map((n) => ({
    ...n,
    id: ids.get(n.id)!,
    position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
  }));
  const edges = clip.edges.map((e) => ({
    ...e,
    id: ids.get(e.id)!,
    source: ids.get(e.source)!,
    target: ids.get(e.target)!,
  }));
  return { diagram: { nodes: [...d.nodes, ...nodes], edges: [...d.edges, ...edges] }, ids: nodes.map((n) => n.id) };
}

// An edge's colour (null: the default colour) and label (empty: none).
export function updateEdge(d: Diagram, id: string, patch: { color?: string | null; label?: string }): Diagram {
  return {
    nodes: d.nodes,
    edges: d.edges.map((e): DiagramEdge => {
      if (e.id !== id) return e;
      const next: DiagramEdge = { ...e };
      if (patch.color !== undefined) {
        if (patch.color === null) {
          delete next.style;
          next.markerEnd = { type: ARROW };
        } else {
          next.style = { stroke: patch.color };
          next.markerEnd = { type: ARROW, color: patch.color };
        }
      }
      if (patch.label !== undefined) {
        const label = patch.label.trim();
        if (label) next.label = label;
        else delete next.label;
      }
      return next;
    }),
  };
}

// The H shortcut: show or hide the header of each given card.
export function toggleHeaders(d: Diagram, ids: string[]): Diagram {
  const set = new Set(ids);
  return {
    nodes: d.nodes.map((n) =>
      set.has(n.id) ? { ...n, data: { ...n.data, showHeader: n.data.showHeader === false } } : n
    ),
    edges: d.edges,
  };
}

// A card's header text; empty means the template's label (as before).
export function setHeaderText(d: Diagram, id: string, value: string): Diagram {
  return {
    nodes: d.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, headerText: value.trim() || n.data.label } } : n
    ),
    edges: d.edges,
  };
}
