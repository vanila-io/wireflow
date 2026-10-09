// Pure operations on a diagram. The store applies each one as a single undo step.
import { fitGroups } from './groups';
import { isCard, type Diagram, type DiagramNode } from './model';

// Ids of the given nodes and everything nested in them.
export function withDescendants(nodes: DiagramNode[], ids: Iterable<string>): Set<string> {
  const all = new Set(ids);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId !== undefined && all.has(n.parentId) && !all.has(n.id)) {
        all.add(n.id);
        grew = true;
      }
    }
  }
  return all;
}

// Remove nodes (a group with its contents) and edges, plus edges left without an end.
export function removeItems(d: Diagram, ids: Iterable<string>): Diagram {
  const removed = withDescendants(d.nodes, ids);
  const nodes = d.nodes.filter((n) => !removed.has(n.id));
  const edges = d.edges.filter((e) => !removed.has(e.id) && !removed.has(e.source) && !removed.has(e.target));
  return { nodes: fitGroups(nodes), edges };
}

// The H shortcut: show or hide the header of each given card.
export function toggleHeaders(d: Diagram, ids: string[]): Diagram {
  const set = new Set(ids);
  const nodes = d.nodes.map((n): DiagramNode =>
    set.has(n.id) && isCard(n) ? { ...n, data: { ...n.data, showHeader: n.data.showHeader === false } } : n,
  );
  return { nodes: fitGroups(nodes), edges: d.edges };
}

// A card's header text; empty means the template's label (as on production).
export function setHeaderText(d: Diagram, id: string, value: string): Diagram {
  return {
    nodes: d.nodes.map((n): DiagramNode => (n.id === id && isCard(n) ? { ...n, data: { ...n.data, headerText: value.trim() || n.data.label } } : n)),
    edges: d.edges,
  };
}
