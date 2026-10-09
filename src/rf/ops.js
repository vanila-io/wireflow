// Diagram operations for the React Flow editor. They work on the saved G6-format
// diagram ({nodes, edges, groups}), are pure, and the editor records each result as one
// undo step. Keeping them engine-independent is what lets #105 (AI edits) and #109
// (files) work on the same data whichever engine draws it.

import { absoluteBoxes } from './convert';

function withoutParent(item) {
  const rest = { ...item };
  delete rest.parent;
  return rest;
}

const normalize = (doc) => ({ nodes: doc?.nodes ?? [], edges: doc?.edges ?? [], groups: doc?.groups ?? [] });

// Ids of the given groups and everything nested in them.
function withDescendants(doc, ids) {
  const all = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    [...doc.nodes, ...doc.groups].forEach((item) => {
      if (item.parent !== undefined && all.has(item.parent) && !all.has(item.id)) {
        all.add(item.id);
        grew = true;
      }
    });
  }
  return all;
}

/**
 * Copy: the selected nodes and groups (with their contents) and every edge whose two
 * ends are both copied. gg-editor 2 copies only the nodes, so pasted screens lose
 * their arrows (#70).
 */
export function copyItems(data, ids) {
  const doc = normalize(data);
  const copied = withDescendants(doc, ids);
  const inside = (item) => copied.has(item.id);
  const dropOutsideParent = (item) => {
    return item.parent === undefined || copied.has(item.parent) ? item : withoutParent(item);
  };
  return {
    nodes: doc.nodes.filter(inside).map(dropOutsideParent),
    groups: doc.groups.filter(inside).map(dropOutsideParent),
    edges: doc.edges.filter((edge) => copied.has(edge.source) && copied.has(edge.target)),
  };
}

/**
 * Paste a copy with new ids, moved by `offset`. Returns {data, ids} with the ids of
 * the pasted top-level items, so the editor can select them.
 */
export function pasteItems(data, clip, { offset = { x: 20, y: 20 }, newId }) {
  const doc = normalize(data);
  const ids = new Map([...clip.nodes, ...clip.groups, ...clip.edges].map((item) => [item.id, newId()]));
  const parent = (item) => (item.parent === undefined ? {} : { parent: ids.get(item.parent) });
  const moved = (item) => ({
    ...item,
    id: ids.get(item.id),
    ...parent(item),
    ...(typeof item.x === 'number' && { x: item.x + offset.x }),
    ...(typeof item.y === 'number' && { y: item.y + offset.y }),
  });
  const pasted = {
    nodes: clip.nodes.map(moved),
    groups: clip.groups.map(moved),
    edges: clip.edges.map((edge) => ({ ...edge, id: ids.get(edge.id), source: ids.get(edge.source), target: ids.get(edge.target) })),
  };
  return {
    data: {
      nodes: [...doc.nodes, ...pasted.nodes],
      edges: [...doc.edges, ...pasted.edges],
      groups: [...doc.groups, ...pasted.groups],
    },
    ids: [...pasted.nodes, ...pasted.groups].filter((item) => item.parent === undefined).map((item) => item.id),
  };
}

// Remove nodes, groups (with their contents) and edges, and the edges left without an end.
export function removeItems(data, ids) {
  const doc = normalize(data);
  const removed = withDescendants(doc, ids);
  const keep = (item) => !removed.has(item.id);
  return {
    nodes: doc.nodes.filter(keep),
    groups: doc.groups.filter(keep),
    edges: doc.edges.filter((edge) => keep(edge) && keep({ id: edge.source }) && keep({ id: edge.target })),
  };
}

// Put items (that share a parent) into a new group.
export function groupItems(data, ids, { id, label = 'Group' }) {
  const doc = normalize(data);
  const members = new Set(ids);
  const [first] = [...doc.nodes, ...doc.groups].filter((item) => members.has(item.id));
  const outer = first?.parent;
  const join = (item) => (members.has(item.id) ? { ...item, parent: id } : item);
  return {
    nodes: doc.nodes.map(join),
    edges: doc.edges,
    groups: [...doc.groups.map(join), { id, label, ...(outer !== undefined && { parent: outer }) }],
  };
}

// Dissolve a group; its children move to the group's own parent.
export function ungroupItem(data, id) {
  const doc = normalize(data);
  const group = doc.groups.find((g) => g.id === id);
  if (!group) return doc;
  const leave = (item) => {
    if (item.parent !== id) return item;
    return group.parent === undefined ? withoutParent(item) : { ...item, parent: group.parent };
  };
  return { nodes: doc.nodes.map(leave), edges: doc.edges, groups: doc.groups.filter((g) => g.id !== id).map(leave) };
}

// Set or clear the parent group of items: {[id]: groupId | undefined}.
export function setParents(data, parents) {
  const doc = normalize(data);
  const apply = (item) => {
    if (!(item.id in parents)) return item;
    return parents[item.id] === undefined ? withoutParent(item) : { ...item, parent: parents[item.id] };
  };
  return { nodes: doc.nodes.map(apply), edges: doc.edges, groups: doc.groups.map(apply) };
}

/**
 * After a drag (React Flow nodes): which moved items changed group. An item stays in
 * its group while its center is inside the group's frame; dropped outside, it leaves
 * the group, and dropped inside another group's frame it joins the innermost one (#81).
 * Frames don't change during a drag, so this uses the frames the user saw.
 */
export function dropTargets(nodes, movedIds) {
  const boxes = absoluteBoxes(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isInside = (id, ancestor) => {
    for (let p = byId.get(id); p; p = byId.get(p.parentId)) if (p.id === ancestor) return true;
    return false;
  };
  const contains = (box, point) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  const changes = {};
  movedIds.forEach((id) => {
    const node = byId.get(id);
    // Items moved together with their group keep it.
    if (!node || (node.parentId !== undefined && movedIds.includes(node.parentId))) return;
    const box = boxes.get(id);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (node.parentId !== undefined && contains(boxes.get(node.parentId), center)) return;
    const target = nodes
      .filter((group) => group.type === 'group' && !isInside(group.id, id) && contains(boxes.get(group.id), center))
      .sort((a, b) => boxes.get(a.id).width * boxes.get(a.id).height - boxes.get(b.id).width * boxes.get(b.id).height)[0];
    if (target?.id !== node.parentId) changes[id] = target?.id;
  });
  return changes;
}

/**
 * Port of #105's apply step. PR #105 validates an AI tool call into a list of actions
 * ({kind: 'clear' | 'add' | 'update' | 'remove' | 'group' | 'ungroup', ...}) and runs
 * them inside one gg-editor command so they undo together. Here the same actions are a
 * pure function of the saved diagram; the editor records the result as one undo step.
 */
export function applyActions(data, actions) {
  return actions.reduce((doc, action) => {
    switch (action.kind) {
      case 'clear':
        return { nodes: [], edges: [], groups: [] };
      case 'add': {
        const list = action.type === 'edge' ? 'edges' : action.type === 'group' ? 'groups' : 'nodes';
        return { ...doc, [list]: [...doc[list], { ...action.model }] };
      }
      case 'update': {
        const update = (item) => (item.id === action.id ? { ...item, ...action.model } : item);
        return { nodes: doc.nodes.map(update), edges: doc.edges.map(update), groups: doc.groups.map(update) };
      }
      case 'remove':
        return removeItems(doc, [action.id]);
      case 'group':
        return groupItems(doc, action.members, { id: action.id, label: action.label });
      case 'ungroup':
        return ungroupItem(doc, action.id);
      default:
        throw new Error(`Unknown action ${JSON.stringify(action.kind)}`);
    }
  }, normalize(data));
}
