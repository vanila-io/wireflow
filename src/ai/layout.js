// Where screens and groups end up on the canvas, so the model can be told when a
// change stacks screens or hides one behind a group box.

// gg-editor-core draws a group as the bounding box of its members, widened to at least
// 164 px, plus 40 px above (the title) and 10 px on the other sides.
const GROUP_PADDING = { top: 40, right: 10, bottom: 10, left: 10 };
const GROUP_MIN_WIDTH = 164;

const overlap = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
const pair = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const span = (b) => `x ${Math.round(b.minX)} to ${Math.round(b.maxX)}, y ${Math.round(b.minY)} to ${Math.round(b.maxY)}`;

/**
 * Layout problems: screens that overlap, screens inside the box of a group they are not
 * in (the box covers them, or they look like members), and overlapping groups.
 * screens: Map id -> { x, y, size: [w, h], parent }; groups: Map id -> { parent }.
 * Returns a Map of stable key -> message, so callers can compare before and after.
 */
export function layoutIssues(screens, groups) {
  const box = new Map();
  for (const [id, s] of screens) {
    const [w, h] = s.size;
    box.set(id, { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 });
  }
  const children = (id) => [...screens, ...groups].filter(([, item]) => item.parent === id).map(([childId]) => childId);
  const groupBox = (id, path = []) => {
    if (box.has(id)) return box.get(id);
    if (path.includes(id)) return null; // a parent cycle in bad data
    const boxes = children(id)
      .map((child) => groupBox(child, [...path, id]))
      .filter(Boolean);
    if (!boxes.length) return null;
    let minX = Math.min(...boxes.map((b) => b.minX));
    let maxX = Math.max(...boxes.map((b) => b.maxX));
    if (maxX - minX < GROUP_MIN_WIDTH) {
      const grow = (GROUP_MIN_WIDTH - (maxX - minX)) / 2;
      minX -= grow;
      maxX += grow;
    }
    const b = {
      minX: minX - GROUP_PADDING.left,
      maxX: maxX + GROUP_PADDING.right,
      minY: Math.min(...boxes.map((c) => c.minY)) - GROUP_PADDING.top,
      maxY: Math.max(...boxes.map((c) => c.maxY)) + GROUP_PADDING.bottom,
    };
    box.set(id, b);
    return b;
  };
  const ancestors = (id) => {
    const found = [];
    for (let p = (screens.get(id) ?? groups.get(id))?.parent; p && !found.includes(p); p = groups.get(p)?.parent) found.push(p);
    return found;
  };

  const issues = new Map();
  const ids = [...screens.keys()];
  ids.forEach((a, i) =>
    ids.slice(i + 1).forEach((b) => {
      if (overlap(box.get(a), box.get(b))) issues.set(`screens:${pair(a, b)}`, `screens "${a}" and "${b}" overlap`);
    }),
  );
  const groupIds = [...groups.keys()].filter((g) => groupBox(g));
  for (const g of groupIds) {
    for (const s of ids) {
      if (!ancestors(s).includes(g) && overlap(box.get(s), box.get(g))) {
        issues.set(`inside:${s}|${g}`, `screen "${s}" is not in group "${g}" but lies inside its box (${span(box.get(g))})`);
      }
    }
  }
  groupIds.forEach((a, i) =>
    groupIds.slice(i + 1).forEach((b) => {
      const nested = ancestors(a).includes(b) || ancestors(b).includes(a);
      if (!nested && overlap(box.get(a), box.get(b))) issues.set(`groups:${pair(a, b)}`, `groups "${a}" and "${b}" overlap`);
    }),
  );
  return issues;
}
