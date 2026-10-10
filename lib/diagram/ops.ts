// Pure operations on a diagram. The store applies each one as a single undo step.
import { newCardId, newId, type Diagram } from "./model";

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
