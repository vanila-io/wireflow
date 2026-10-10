// Where screens end up on the canvas, so the model can be told when a change
// stacks screens on top of each other (#105). Sizes are the editor's own card
// geometry (cardSize in lib/diagram/model.ts).

/** x, y: the screen's centre; size: [width, height]. */
export type Screen = { x: number; y: number; size: [number, number] };
type Box = { minX: number; minY: number; maxX: number; maxY: number };

const overlap = (a: Box, b: Box) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Layout problems: screens that overlap. Returns stable key -> message, so
 * callers can compare before and after a change.
 */
export function layoutIssues(screens: Map<string, Screen>): Map<string, string> {
  const box = new Map<string, Box>();
  for (const [id, s] of screens) {
    const [w, h] = s.size;
    box.set(id, { minX: s.x - w / 2, minY: s.y - h / 2, maxX: s.x + w / 2, maxY: s.y + h / 2 });
  }
  const issues = new Map<string, string>();
  const ids = [...screens.keys()];
  ids.forEach((a, i) =>
    ids.slice(i + 1).forEach((b) => {
      if (overlap(box.get(a)!, box.get(b)!)) issues.set(`screens:${pair(a, b)}`, `screens "${a}" and "${b}" overlap`);
    })
  );
  return issues;
}
