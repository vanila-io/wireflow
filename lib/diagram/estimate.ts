// Estimates (#84): hours per card, summed per group and for the project, plus
// the project's stages, and turned into cost with the project's hourly rate.
import { toCsv, type Cell } from "./csv";
import { withDescendants } from "./ops";
import { DEFAULT_CURRENCY, isCard, isGroup, type CardNode, type Diagram, type DiagramNode, type Stage } from "./model";

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

/** A stage's hours: its own, or its percentage of the cards' hours. */
export const stageHours = (stage: Stage, cardHours: number) =>
  stage.hours !== undefined ? stage.hours : (cardHours * stage.percent) / 100;

/** A stage's name as shown ("Stage" while it has none). */
export const stageLabel = (stage: Stage) => stage.label.trim() || "Stage";

/**
 * The whole estimate: the cards' total, each stage with its hours, and the
 * project's hours (cards and stages). Group totals never include stages: a
 * stage belongs to the project, not to a group.
 */
export function projectEstimate(d: Pick<Diagram, "nodes" | "settings">) {
  const cards = projectTotal(d);
  const stages = (d.settings?.stages ?? []).map((stage) => ({ stage, hours: stageHours(stage, cards.hours) }));
  return { cards, stages, hours: stages.reduce((h, s) => h + s.hours, cards.hours) };
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

// The estimate as a table for a spreadsheet (wireflow-estimate.csv): every card
// (by group, with the group's name), every group's total, the cards' subtotal, the stages and
// the project total; with the rate and the cost on every row once a rate is set.
export const ESTIMATE_FILE_NAME = "wireflow-estimate.csv";

const round2 = (n: number) => Math.round(n * 100) / 100;
const cardName = (c: CardNode) => c.data.headerText ?? c.data.label;

export function estimateCsv(d: Pick<Diagram, "nodes" | "settings">): string {
  const rate = d.settings?.hourlyRate;
  const currency = d.settings?.currency ?? DEFAULT_CURRENCY;
  const byId = new Map(d.nodes.map((n) => [n.id, n]));
  // "Outer / Inner": the groups a node is in, outermost first.
  const path = (id: string | undefined): string => {
    const labels: string[] = [];
    for (let p = id; p !== undefined; p = byId.get(p)?.parentId) {
      const g = byId.get(p);
      if (!g || !isGroup(g)) break;
      labels.unshift(g.data.label);
    }
    return labels.join(" / ");
  };
  const counted = (t: Total) => `${t.estimated} of ${t.cards} ${t.cards === 1 ? "card" : "cards"} estimated`;
  const row = (type: string, name: string, group: string, hours: number | undefined, basis: string): Cell[] => [
    type,
    name,
    group,
    hours === undefined ? null : round2(hours),
    basis,
    ...(rate === undefined ? [] : [rate, hours === undefined ? null : round2(hours * rate)]),
  ];

  const { cards, stages, hours } = projectEstimate(d);
  const groups = d.nodes.filter(isGroup);
  // Cards by group (in the groups' order), then the cards in none.
  const order = (c: CardNode) => (c.parentId === undefined ? groups.length : groups.findIndex((g) => g.id === c.parentId));
  const rows: Cell[][] = [
    ["Type", "Name", "Group", "Hours", "Basis", ...(rate === undefined ? [] : [`Rate (${currency}/h)`, `Cost (${currency})`])],
    ...d.nodes
      .filter(isCard)
      .sort((a, b) => order(a) - order(b))
      .map((c) => row("Card", cardName(c), path(c.parentId), c.data.estimate, "")),
    ...groups.map((g) => {
      const t = groupTotal(d.nodes, g.id);
      return row("Group", g.data.label, path(g.parentId), t.hours, counted(t));
    }),
    row("Subtotal", "Cards", "", cards.hours, counted(cards)),
    ...stages.map(({ stage, hours: h }) =>
      row("Stage", stageLabel(stage), "", h, stage.hours !== undefined ? "Fixed hours" : `${stage.percent}% of card hours`)
    ),
    row("Total", "Total", "", hours, ""),
  ];
  return toCsv(rows);
}
