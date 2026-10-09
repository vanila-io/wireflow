// Pure operations on a diagram. The store applies each one as a single undo step.
import { absoluteBoxes, absolutePositions, fitGroups, GROUP_PADDING } from './groups';
import { isCard, isGroup, newCardId, newId, type Diagram, type DiagramNode, type GroupNode } from './model';

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

export type Clip = Diagram;

// The given nodes (groups with their contents) and the edges between them. Items
// whose group isn't copied are copied at their place on the canvas, ungrouped.
export function copyItems(d: Diagram, ids: Iterable<string>): Clip {
  const copied = withDescendants(d.nodes, ids);
  const abs = absolutePositions(d.nodes);
  const nodes = d.nodes
    .filter((n) => copied.has(n.id))
    .map((n): DiagramNode => {
      if (n.parentId === undefined || copied.has(n.parentId)) return n;
      const rest = { ...n, position: abs.get(n.id)! };
      delete rest.parentId;
      return rest;
    });
  const edges = d.edges.filter((e) => copied.has(e.source) && copied.has(e.target));
  return { nodes, edges };
}

// Paste a copy with new ids, moved by `offset`. Returns the ids of the pasted
// top-level nodes, so the editor can select them.
export function pasteItems(d: Diagram, clip: Clip, offset: { x: number; y: number }): { diagram: Diagram; ids: string[] } {
  const ids = new Map<string, string>();
  clip.nodes.forEach((n) => ids.set(n.id, isCard(n) ? newCardId(n.data.graphicId) : newId('group')));
  clip.edges.forEach((e) => ids.set(e.id, newId('edge')));
  const nodes = clip.nodes.map((n): DiagramNode => {
    const top = n.parentId === undefined;
    return {
      ...n,
      id: ids.get(n.id)!,
      ...(top ? { position: { x: n.position.x + offset.x, y: n.position.y + offset.y } } : { parentId: ids.get(n.parentId!)! }),
    } as DiagramNode;
  });
  const edges = clip.edges.map((e) => ({ ...e, id: ids.get(e.id)!, source: ids.get(e.source)!, target: ids.get(e.target)! }));
  return {
    diagram: { nodes: [...d.nodes, ...nodes], edges: [...d.edges, ...edges] },
    ids: nodes.filter((n) => !n.parentId).map((n) => n.id),
  };
}

// Whether these nodes can form a group: at least two, all in the same group (or none).
export function canGroup(d: Diagram, ids: string[]): boolean {
  const members = d.nodes.filter((n) => ids.includes(n.id));
  return members.length >= 2 && members.length === new Set(ids).size && new Set(members.map((n) => n.parentId)).size === 1;
}

// Put nodes that share a parent into a new group.
export function groupItems(d: Diagram, ids: string[], { id = newId('group'), label = 'Group' } = {}): Diagram {
  if (!canGroup(d, ids)) return d;
  const members = new Set(ids);
  const boxes = absoluteBoxes(d.nodes);
  const memberBoxes = [...members].map((m) => boxes.get(m)!);
  const frame = {
    x: Math.min(...memberBoxes.map((b) => b.x)) - GROUP_PADDING.left,
    y: Math.min(...memberBoxes.map((b) => b.y)) - GROUP_PADDING.top,
  };
  const parentId = d.nodes.find((n) => members.has(n.id))!.parentId;
  const parentPos = parentId === undefined ? { x: 0, y: 0 } : boxes.get(parentId)!;
  const group: GroupNode = {
    id,
    type: 'group',
    position: { x: frame.x - parentPos.x, y: frame.y - parentPos.y },
    ...(parentId !== undefined && { parentId }),
    data: { label },
  };
  const nodes = d.nodes.map((n): DiagramNode => {
    if (!members.has(n.id)) return n;
    const b = boxes.get(n.id)!;
    return { ...n, parentId: id, position: { x: b.x - frame.x, y: b.y - frame.y } } as DiagramNode;
  });
  // The group goes right before its first member, so it is drawn below them.
  const first = nodes.findIndex((n) => members.has(n.id));
  nodes.splice(first, 0, group);
  return { nodes: fitGroups(nodes), edges: d.edges };
}

// Dissolve a group: its members move to the group's own parent and stay where they are.
export function ungroupItem(d: Diagram, id: string): Diagram {
  const g = d.nodes.find((n) => n.id === id);
  if (!g || !isGroup(g)) return d;
  const moved = Object.fromEntries(d.nodes.filter((n) => n.parentId === id).map((n) => [n.id, g.parentId]));
  const reparented = setParents(d, moved);
  return removeItems(reparented, [id]);
}

// Set or clear the group of nodes ({id: groupId | undefined}), keeping their place on the canvas.
export function setParents(d: Diagram, parents: Record<string, string | undefined>): Diagram {
  const abs = absolutePositions(d.nodes);
  const nodes = d.nodes.map((n): DiagramNode => {
    if (!(n.id in parents)) return n;
    const parentId = parents[n.id];
    const a = abs.get(n.id)!;
    const p = parentId === undefined ? { x: 0, y: 0 } : abs.get(parentId)!;
    const next = { ...n, position: { x: a.x - p.x, y: a.y - p.y } } as DiagramNode;
    if (parentId === undefined) delete next.parentId;
    else next.parentId = parentId;
    return next;
  });
  // React Flow needs parents before children.
  const depth = (n: DiagramNode): number => (n.parentId === undefined ? 0 : 1 + depth(nodes.find((m) => m.id === n.parentId)!));
  const ordered = nodes.map((n, i) => ({ n, i, d: depth(n) })).sort((a, b) => a.d - b.d || a.i - b.i).map((o) => o.n);
  return { nodes: fitGroups(ordered), edges: d.edges };
}

/**
 * After a drag: which moved nodes change group. A node stays in its group while
 * its centre is inside the group's frame; dropped outside it leaves, and dropped
 * inside another frame it joins the innermost one. Frames don't change during a
 * drag, so this uses the frames the user saw.
 */
export function dropTargets(nodes: DiagramNode[], movedIds: string[]): Record<string, string | undefined> {
  const boxes = absoluteBoxes(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isInside = (id: string, ancestor: string) => {
    for (let p = byId.get(id); p; p = p.parentId === undefined ? undefined : byId.get(p.parentId)) if (p.id === ancestor) return true;
    return false;
  };
  const contains = (b: { x: number; y: number; width: number; height: number }, pt: { x: number; y: number }) =>
    pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height;
  const changes: Record<string, string | undefined> = {};
  for (const id of movedIds) {
    const node = byId.get(id);
    // Nodes moved together with their group keep it.
    if (!node || (node.parentId !== undefined && movedIds.includes(node.parentId))) continue;
    const b = boxes.get(id)!;
    const centre = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    if (node.parentId !== undefined && contains(boxes.get(node.parentId)!, centre)) continue;
    const target = nodes
      .filter((g) => isGroup(g) && !isInside(g.id, id) && contains(boxes.get(g.id)!, centre))
      .sort((a, b2) => boxes.get(a.id)!.width * boxes.get(a.id)!.height - boxes.get(b2.id)!.width * boxes.get(b2.id)!.height)[0];
    if (target?.id !== node.parentId) changes[id] = target?.id;
  }
  return changes;
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

export function setGroupLabel(d: Diagram, id: string, value: string): Diagram {
  return {
    nodes: d.nodes.map((n): DiagramNode => (n.id === id && isGroup(n) ? { ...n, data: { ...n.data, label: value.trim() || 'Group' } } : n)),
    edges: d.edges,
  };
}

