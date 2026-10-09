// Where screens and groups end up on the canvas, so the model can be told when a
// change stacks screens or hides one behind a group frame (#105). Group frames
// are computed the way the editor draws them (lib/diagram/groups.ts).
import { GROUP_PADDING } from '@/lib/diagram/groups';

/** x, y: the screen's centre; size: [width, height]. */
export type Screen = { x: number; y: number; size: [number, number]; parent: string | null };
export type Group = { parent: string | null };
type Box = { minX: number; minY: number; maxX: number; maxY: number };

const overlap = (a: Box, b: Box) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const span = (b: Box) => `x ${Math.round(b.minX)} to ${Math.round(b.maxX)}, y ${Math.round(b.minY)} to ${Math.round(b.maxY)}`;

/**
 * Layout problems: screens that overlap, screens inside the frame of a group they
 * are not in (the frame covers them, or they look like members), and overlapping
 * groups. Returns stable key -> message, so callers can compare before and after.
 */
export function layoutIssues(screens: Map<string, Screen>, groups: Map<string, Group>): Map<string, string> {
  const box = new Map<string, Box>();
  for (const [id, s] of screens) {
    const [w, h] = s.size;
    box.set(id, { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 });
  }
  const children = (id: string) => [...screens, ...groups].filter(([, item]) => item.parent === id).map(([childId]) => childId);
  const groupBox = (id: string, path: string[] = []): Box | null => {
    if (box.has(id)) return box.get(id)!;
    if (path.includes(id)) return null; // a parent loop in bad data
    const boxes = children(id)
      .map((child) => groupBox(child, [...path, id]))
      .filter((b): b is Box => !!b);
    if (!boxes.length) return null;
    const b = {
      minX: Math.min(...boxes.map((c) => c.minX)) - GROUP_PADDING.left,
      maxX: Math.max(...boxes.map((c) => c.maxX)) + GROUP_PADDING.right,
      minY: Math.min(...boxes.map((c) => c.minY)) - GROUP_PADDING.top,
      maxY: Math.max(...boxes.map((c) => c.maxY)) + GROUP_PADDING.bottom,
    };
    box.set(id, b);
    return b;
  };
  const ancestors = (id: string) => {
    const found: string[] = [];
    for (let p = (screens.get(id) ?? groups.get(id))?.parent; p && !found.includes(p); p = groups.get(p)?.parent) found.push(p);
    return found;
  };

  const issues = new Map<string, string>();
  const ids = [...screens.keys()];
  ids.forEach((a, i) =>
    ids.slice(i + 1).forEach((b) => {
      if (overlap(box.get(a)!, box.get(b)!)) issues.set(`screens:${pair(a, b)}`, `screens "${a}" and "${b}" overlap`);
    }),
  );
  const groupIds = [...groups.keys()].filter((g) => groupBox(g));
  for (const g of groupIds) {
    for (const s of ids) {
      if (!ancestors(s).includes(g) && overlap(box.get(s)!, box.get(g)!)) {
        issues.set(`inside:${s}|${g}`, `screen "${s}" is not in group "${g}" but lies inside its frame (${span(box.get(g)!)})`);
      }
    }
  }
  groupIds.forEach((a, i) =>
    groupIds.slice(i + 1).forEach((b) => {
      const nested = ancestors(a).includes(b) || ancestors(b).includes(a);
      if (!nested && overlap(box.get(a)!, box.get(b)!)) issues.set(`groups:${pair(a, b)}`, `groups "${a}" and "${b}" overlap`);
    }),
  );
  return issues;
}
