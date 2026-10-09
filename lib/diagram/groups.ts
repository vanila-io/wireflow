// Geometry: absolute boxes, and group frames that wrap their members.
//
// A group is a React Flow parent node: its members' positions are relative to
// it. Like the old editor, a frame always wraps its members, so after any change
// frames are re-fitted with `fitGroups`, which keeps every item where it is on
// the canvas.
import { cardSize, isCard, isGroup, type DiagramNode } from './model';

export type Box = { x: number; y: number; width: number; height: number };

// Space between a frame and its members' boxes; the top holds the label.
export const GROUP_PADDING = { top: 36, right: 16, bottom: 16, left: 16 };
export const EMPTY_GROUP = { width: 252, height: 120 };

export function sizeOf(node: DiagramNode): { width: number; height: number } {
  if (isCard(node)) return cardSize(node.data);
  return { width: node.width ?? EMPTY_GROUP.width, height: node.height ?? EMPTY_GROUP.height };
}

// Absolute top-left of every node (positions of members are relative to their group).
export function absolutePositions(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, { x: number; y: number }>();
  const resolve = (node: DiagramNode, seen: Set<string>): { x: number; y: number } => {
    const known = out.get(node.id);
    if (known) return known;
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
    let pos = node.position;
    if (parent && !seen.has(parent.id)) {
      const p = resolve(parent, new Set([...seen, node.id]));
      pos = { x: p.x + node.position.x, y: p.y + node.position.y };
    }
    out.set(node.id, pos);
    return pos;
  };
  nodes.forEach((n) => resolve(n, new Set()));
  return out;
}

export function absoluteBoxes(nodes: DiagramNode[]): Map<string, Box> {
  const positions = absolutePositions(nodes);
  return new Map(nodes.map((n) => [n.id, { ...positions.get(n.id)!, ...sizeOf(n) }]));
}

/**
 * Re-fit every group frame around its members, innermost first, keeping every
 * item's absolute position. Other fields (selection etc.) are kept.
 */
export function fitGroups<T extends DiagramNode>(nodes: T[]): T[] {
  if (!nodes.some(isGroup)) return nodes;
  const abs = absolutePositions(nodes);
  const size = new Map(nodes.map((n) => [n.id, sizeOf(n)]));
  const children = new Map<string, string[]>();
  nodes.forEach((n) => n.parentId !== undefined && children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]));

  const byId = new Map<string, DiagramNode>(nodes.map((m) => [m.id, m]));
  const depth = (n: DiagramNode) => {
    let d = 0;
    for (let p = n.parentId; p !== undefined && d <= nodes.length; p = byId.get(p)?.parentId) d++;
    return d;
  };
  const groups = nodes.filter(isGroup).sort((a, b) => depth(b) - depth(a));
  for (const g of groups) {
    const kids = children.get(g.id) ?? [];
    if (!kids.length) continue;
    const boxes = kids.map((id) => ({ ...abs.get(id)!, ...size.get(id)! }));
    const minX = Math.min(...boxes.map((b) => b.x)) - GROUP_PADDING.left;
    const minY = Math.min(...boxes.map((b) => b.y)) - GROUP_PADDING.top;
    const maxX = Math.max(...boxes.map((b) => b.x + b.width)) + GROUP_PADDING.right;
    const maxY = Math.max(...boxes.map((b) => b.y + b.height)) + GROUP_PADDING.bottom;
    abs.set(g.id, { x: minX, y: minY });
    size.set(g.id, { width: maxX - minX, height: maxY - minY });
  }

  return nodes.map((n) => {
    const a = abs.get(n.id)!;
    const p = n.parentId === undefined ? { x: 0, y: 0 } : abs.get(n.parentId)!;
    const position = { x: a.x - p.x, y: a.y - p.y };
    const fitted = isGroup(n) && (children.get(n.id)?.length ?? 0) > 0 ? size.get(n.id)! : undefined;
    const same =
      position.x === n.position.x && position.y === n.position.y && (!fitted || (fitted.width === n.width && fitted.height === n.height));
    return same ? n : { ...n, position, ...fitted };
  });
}
