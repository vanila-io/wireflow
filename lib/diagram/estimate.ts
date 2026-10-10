// Estimates (#84): hours per card, summed per group and for the project, and
// turned into cost with the project's hourly rate.
import { withDescendants } from "./ops";
import { DEFAULT_CURRENCY, isCard, isGroup, type Diagram, type DiagramNode } from "./model";

export type Total = { hours: number; estimated: number; cards: number };

const sum = (nodes: DiagramNode[]): Total =>
  nodes.filter(isCard).reduce<Total>(
    (t, n) =>
      n.data.estimate === undefined
        ? { ...t, cards: t.cards + 1 }
        : { hours: t.hours + n.data.estimate, estimated: t.estimated + 1, cards: t.cards + 1 },
    { hours: 0, estimated: 0, cards: 0 }
  );

/** Every card's estimate added up; `estimated` cards out of `cards`. */
export const projectTotal = (d: Pick<Diagram, "nodes">) => sum(d.nodes);

/** The cards inside a group, at any depth. */
export function groupTotal(nodes: DiagramNode[], groupId: string): Total {
  const inside = withDescendants(nodes, [groupId]);
  return sum(nodes.filter((n) => n.id !== groupId && inside.has(n.id)));
}

/** Rows that add up to the project total: each top-level group, then the cards in none. */
export function totalsByGroup(d: Pick<Diagram, "nodes">): { id: string | null; label: string; total: Total }[] {
  const rows = d.nodes
    .filter((n) => isGroup(n) && n.parentId === undefined)
    .map((g) => ({ id: g.id, label: isGroup(g) ? g.data.label : "", total: groupTotal(d.nodes, g.id) }));
  const loose = sum(d.nodes.filter((n) => n.parentId === undefined));
  return [...rows, { id: null, label: "Not in a group", total: loose }].filter((r) => r.total.estimated > 0);
}

/** "12 h", "1.5 h", "0.25 h". */
export const formatHours = (hours: number) => `${Math.round(hours * 100) / 100} h`;

/** The cost of some hours at the rate, in the project's currency, in the reader's number format. */
export function formatCost(amount: number, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}
