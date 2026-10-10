// Pure operations on a diagram. The store applies each one as a single undo step.
import type { Diagram } from "./model";

// Remove nodes and edges, plus the edges left without an end.
export function removeItems(d: Diagram, ids: Iterable<string>): Diagram {
  const removed = new Set(ids);
  return {
    nodes: d.nodes.filter((n) => !removed.has(n.id)),
    edges: d.edges.filter((e) => !removed.has(e.id) && !removed.has(e.source) && !removed.has(e.target)),
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
