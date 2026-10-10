// The diagram layer the AI talks to (#105). `snapshot` and `planOps` are the
// engine-neutral planner and validator from #105 (ported in #113), reading
// Wireflow's diagram; `applyActions` is the React Flow apply step: a pure
// function whose result the store records as ONE undo step.
import { graphicById } from "@/lib/graphics";
import { ARROW, cardSize, DEFAULT_EDGE_COLOR, makeCard, type Diagram } from "@/lib/diagram/model";
import { removeItems, updateEdge } from "@/lib/diagram/ops";
import { templateExists } from "./catalog";
import { layoutIssues, type Screen } from "./layout";

const GAP_X = 300;
const MAX_LABEL = 80;
const MAX_NODES = 300;
const MAX_OPS = 200;
const MAX_COORD = 20000;
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_WARNINGS = 10;

export type View = { x: number; y: number; width: number; height: number };

const round = (n: number) => Math.round(n);
const centre = (n: Diagram["nodes"][number]) => {
  const { width, height } = cardSize(n.data);
  return { x: n.position.x + width / 2, y: n.position.y + height / 2, width, height };
};

// Compact view of the diagram sent to the model with every user message. x and
// y are a screen's centre on the canvas. `view` is the part of the canvas the
// user can see, when the caller knows it.
export function snapshot({ data, selected = [], view }: { data: Diagram; selected?: string[]; view?: View }) {
  return {
    selected,
    ...(view ? { view } : {}),
    screens: data.nodes.map((n) => {
      const c = centre(n);
      return {
        id: n.id,
        template: n.data.graphicId,
        label: (n.data.headerText ?? n.data.label).slice(0, MAX_LABEL),
        x: round(c.x),
        y: round(c.y),
        header: n.data.showHeader !== false,
      };
    }),
    connections: data.edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: typeof e.label === "string" ? e.label : "",
    })),
  };
}

// --- Tool definition (provider-neutral JSON Schema) ---------------------------

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const op = (name: string, description: string, properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  description,
  properties: { op: { type: "string", const: name }, ...properties },
  required: ["op", ...required],
  additionalProperties: false,
});

export const EDIT_DIAGRAM_TOOL = {
  name: "edit_diagram",
  description:
    "Apply a batch of changes to the wireflow diagram. The batch is validated as a whole against the " +
    "current diagram and applied atomically as one undo step; if any operation is invalid nothing is " +
    "applied and the errors are returned. Operations run in order, so later operations may reference " +
    "ids created earlier in the same batch. Removing a screen also removes its connections.",
  parameters: {
    type: "object",
    properties: {
      summary: str("One short sentence describing the change, shown to the user."),
      operations: {
        type: "array",
        items: {
          anyOf: [
            op(
              "clear",
              "Remove everything. Only as the first operation, and only when the user asked to start over.",
              {},
              []
            ),
            op(
              "add_screen",
              "Add a screen (a card showing a template image).",
              {
                id: str('New unique id, e.g. "login" or "cart_2". Letters, digits, _ and -; must start with a letter.'),
                template: str("Template id from the catalog."),
                label: str("Header text, ideally at most 23 characters."),
                x: num("Centre x in canvas pixels. Omit to auto-place."),
                y: num("Centre y in canvas pixels. Omit to auto-place."),
                header: { type: "boolean", description: "Show the label header. Default true." },
              },
              ["id", "template", "label"]
            ),
            op(
              "update_screen",
              "Change an existing screen. Only the given fields change.",
              {
                id: str("Screen id."),
                template: str("New template id."),
                label: str("New label."),
                x: num("New centre x."),
                y: num("New centre y."),
                header: { type: "boolean", description: "Show or hide the label header." },
              },
              ["id"]
            ),
            op(
              "connect",
              "Draw an arrow from one screen to another.",
              {
                id: str("New unique connection id."),
                from: str("Source screen id."),
                to: str("Target screen id."),
                label: str("Optional arrow label, e.g. the action that triggers it."),
              },
              ["id", "from", "to"]
            ),
            op(
              "update_connection",
              "Change an existing connection. Only the given fields change.",
              {
                id: str("Connection id."),
                label: str("New label; empty string clears it."),
                color: str("Hex colour like #e8590c."),
              },
              ["id"]
            ),
            op("remove", "Delete screens or connections.", { ids: { type: "array", items: { type: "string" } } }, [
              "ids",
            ]),
          ],
        },
      },
    },
    required: ["summary", "operations"],
    additionalProperties: false,
  },
};

// --- Validation + planning ---------------------------------------------------

export type Action =
  | { kind: "clear" }
  | { kind: "add_screen"; id: string; template: string; label: string; x: number; y: number; header: boolean }
  | { kind: "update_screen"; id: string; template?: string; label?: string; x?: number; y?: number; header?: boolean }
  | { kind: "connect"; id: string; from: string; to: string; label?: string }
  | { kind: "update_connection"; id: string; label?: string; color?: string }
  | { kind: "remove"; id: string };

export type PlanError = { index: number; op: string | null; message: string };
export type Plan =
  | { errors: PlanError[] }
  | {
      errors?: undefined;
      actions: Action[];
      placed: Record<string, [number, number]>;
      summary: string;
      warnings: string[];
    };

const cleanLabel = (s: unknown) =>
  String(s)
    .replace(/\p{Cc}/gu, " ")
    .trim()
    .slice(0, MAX_LABEL);

const has = (o: Record<string, unknown>, k: string) => o[k] !== undefined && o[k] !== null;

const ALLOWED: Record<string, string[]> = {
  clear: [],
  add_screen: ["id", "template", "label", "x", "y", "header"],
  update_screen: ["id", "template", "label", "x", "y", "header"],
  connect: ["id", "from", "to", "label"],
  update_connection: ["id", "label", "color"],
  remove: ["ids"],
};

const sizeFor = (template: string, header: boolean): [number, number] => {
  const { width, height } = cardSize({ graphicId: template, showHeader: header });
  return [width, height];
};

/**
 * Validate a tool input against the live diagram and turn it into actions.
 * Returns {errors} (nothing may be applied) or {actions, placed, summary,
 * warnings}. Warnings name screens the batch makes overlap; the batch is still
 * valid, and the model can move things in a follow-up call.
 */
export function planOps(input: unknown, data: Diagram): Plan {
  const errors: PlanError[] = [];
  const fail = (index: number, opName: string | null, message: string) => {
    errors.push({ index, op: opName, message });
    return false;
  };

  const ops = (input as { operations?: unknown })?.operations;
  if (!input || typeof input !== "object" || !Array.isArray(ops)) {
    return { errors: [{ index: -1, op: null, message: "input must be {summary, operations: [...]}" }] };
  }
  if (ops.length === 0) return { errors: [{ index: -1, op: null, message: "operations is empty" }] };
  if (ops.length > MAX_OPS)
    return { errors: [{ index: -1, op: null, message: `at most ${MAX_OPS} operations per call` }] };

  // Working copy of the diagram so each operation sees the effect of the previous ones.
  type S = Screen & { template: string; header: boolean };
  const N = new Map<string, S>(
    data.nodes.map((n) => {
      const c = centre(n);
      return [
        n.id,
        { x: c.x, y: c.y, size: [c.width, c.height], template: n.data.graphicId, header: n.data.showHeader !== false },
      ];
    })
  );
  const E = new Map(data.edges.map((e) => [e.id, { source: e.source, target: e.target }]));
  const exists = (id: string) => N.has(id) || E.has(id);
  const first = ops[0] as { op?: unknown } | null;
  const layoutBefore = first?.op === "clear" ? new Map() : layoutIssues(N);

  const removeNode = (id: string) => {
    N.delete(id);
    for (const [eid, e] of E) if (e.source === id || e.target === id) E.delete(eid);
  };

  // Every id the batch has seen, so a removal can tell "already removed by an
  // earlier id in this batch" (fine) from "never existed" (an error).
  const known = new Set([...N.keys(), ...E.keys()]);

  // Auto-placement: a row to the right of everything already on the canvas.
  let cursor: { x: number; y: number } | null = null;
  const autoPlace = () => {
    if (!cursor) {
      const xs = [...N.values()].map((n) => n.x);
      const ys = [...N.values()].map((n) => n.y);
      cursor = xs.length ? { x: Math.max(...xs) + GAP_X, y: Math.min(...ys) } : { x: 200, y: 200 };
    } else cursor = { x: cursor.x + GAP_X, y: cursor.y };
    return cursor;
  };

  const actions: Action[] = [];
  const placed: Record<string, [number, number]> = {};

  ops.forEach((raw, i) => {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = typeof o.op === "string" ? o.op : null;
    if (!name || !ALLOWED[name]) return fail(i, name, `unknown op ${JSON.stringify(o.op)}`);
    const extra = Object.keys(o).filter((k) => k !== "op" && !ALLOWED[name].includes(k));
    if (extra.length) return fail(i, name, `unknown field(s): ${extra.join(", ")}`);

    const newId = (id: unknown) => {
      if (typeof id !== "string" || !ID_RE.test(id)) return fail(i, name, `invalid id ${JSON.stringify(id)}`);
      if (exists(id)) return fail(i, name, `id "${id}" already exists`);
      known.add(id);
      return true;
    };
    const coord = (k: string) => {
      if (!has(o, k)) return true;
      const v = o[k];
      if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > MAX_COORD) {
        return fail(i, name, `${k} must be a number within ±${MAX_COORD}`);
      }
      return true;
    };
    const template = () => templateExists(o.template) || fail(i, name, `unknown template "${o.template}"`);
    const text = (k: string) => !has(o, k) || typeof o[k] === "string" || fail(i, name, `${k} must be a string`);
    const bool = (k: string) => !has(o, k) || typeof o[k] === "boolean" || fail(i, name, `${k} must be a boolean`);

    switch (name) {
      case "clear": {
        if (i !== 0) return fail(i, name, "clear is only allowed as the first operation");
        N.clear();
        E.clear();
        known.clear();
        actions.push({ kind: "clear" });
        return;
      }
      case "add_screen": {
        if (!newId(o.id) || !template() || !coord("x") || !coord("y") || !bool("header")) return;
        if (typeof o.label !== "string") return fail(i, name, "label must be a string");
        let x = o.x as number;
        let y = o.y as number;
        if (!has(o, "x") || !has(o, "y")) {
          const p = autoPlace();
          x = has(o, "x") ? x : p.x;
          y = has(o, "y") ? y : p.y;
          placed[o.id as string] = [x, y];
        }
        const header = o.header !== false;
        N.set(o.id as string, {
          x,
          y,
          size: sizeFor(o.template as string, header),
          template: o.template as string,
          header,
        });
        actions.push({
          kind: "add_screen",
          id: o.id as string,
          template: o.template as string,
          label: cleanLabel(o.label),
          x,
          y,
          header,
        });
        return;
      }
      case "update_screen": {
        const screen = N.get(o.id as string);
        if (!screen) return fail(i, name, `no screen "${o.id}"`);
        if (has(o, "template") && !template()) return;
        if (!coord("x") || !coord("y") || !bool("header") || !text("label")) return;
        const action: Action = { kind: "update_screen", id: o.id as string };
        if (has(o, "template")) action.template = screen.template = o.template as string;
        if (has(o, "label")) action.label = cleanLabel(o.label);
        if (has(o, "x")) action.x = screen.x = o.x as number;
        if (has(o, "y")) action.y = screen.y = o.y as number;
        if (has(o, "header")) action.header = screen.header = o.header as boolean;
        if (Object.keys(action).length === 2) return fail(i, name, "nothing to update");
        screen.size = sizeFor(screen.template, screen.header);
        actions.push(action);
        return;
      }
      case "connect": {
        if (!newId(o.id)) return;
        if (!N.has(o.from as string)) return fail(i, name, `no screen "${o.from}"`);
        if (!N.has(o.to as string)) return fail(i, name, `no screen "${o.to}"`);
        if (o.from === o.to) return fail(i, name, "a screen cannot connect to itself");
        if (!text("label")) return;
        E.set(o.id as string, { source: o.from as string, target: o.to as string });
        actions.push({
          kind: "connect",
          id: o.id as string,
          from: o.from as string,
          to: o.to as string,
          ...(o.label ? { label: cleanLabel(o.label) } : {}),
        });
        return;
      }
      case "update_connection": {
        if (!E.has(o.id as string)) return fail(i, name, `no connection "${o.id}"`);
        if (!text("label")) return;
        if (has(o, "color") && !(typeof o.color === "string" && COLOR_RE.test(o.color))) {
          return fail(i, name, "color must look like #e8590c");
        }
        if (!has(o, "label") && !has(o, "color")) return fail(i, name, "nothing to update");
        actions.push({
          kind: "update_connection",
          id: o.id as string,
          ...(has(o, "label") && { label: cleanLabel(o.label) }),
          ...(has(o, "color") && { color: (o.color as string).toLowerCase() }),
        });
        return;
      }
      case "remove": {
        if (!Array.isArray(o.ids) || !o.ids.length) return fail(i, name, "ids must be a non-empty array");
        for (const id of o.ids as unknown[]) {
          if (typeof id !== "string") return fail(i, name, "ids must be strings");
          if (N.has(id)) removeNode(id);
          else if (E.has(id)) E.delete(id);
          // Already removed with an earlier id of this batch (an edge of a
          // removed screen): nothing left to do.
          else if (known.has(id)) continue;
          else return fail(i, name, `no screen or connection "${id}"`);
          actions.push({ kind: "remove", id });
        }
        return;
      }
    }
  });

  // Only growth is limited: a diagram opened from a file may already be larger,
  // and must stay editable (renames, removals).
  if (!errors.length && N.size > MAX_NODES && N.size > data.nodes.length) {
    errors.push({ index: -1, op: null, message: `diagram would exceed ${MAX_NODES} screens` });
  }
  if (errors.length) return { errors };

  // Only problems this batch creates; the user's own layout is not the model's to fix.
  const warnings = [...layoutIssues(N)].filter(([key]) => !layoutBefore.has(key)).map(([, message]) => message);
  if (warnings.length > MAX_WARNINGS) {
    warnings.splice(MAX_WARNINGS, Infinity, `and ${warnings.length - MAX_WARNINGS} more`);
  }
  const summary = (input as { summary?: unknown }).summary;
  return { actions, placed, summary: typeof summary === "string" ? summary : "", warnings };
}

// --- Apply (React Flow) -----------------------------------------------------

function applyAction(d: Diagram, a: Action): Diagram {
  switch (a.kind) {
    case "clear":
      return { nodes: [], edges: [] };
    case "add_screen": {
      const g = graphicById(a.template)!;
      const { width, height } = cardSize({ graphicId: g.id, showHeader: a.header });
      const card = makeCard(g, { x: a.x - width / 2, y: a.y - height / 2 }, a.id);
      card.data.headerText = a.label || g.label;
      card.data.showHeader = a.header;
      return { nodes: [...d.nodes, card], edges: d.edges };
    }
    case "update_screen": {
      // Header and template change the card's height: apply them first, then
      // place the centre (the old one if none is given).
      return {
        nodes: d.nodes.map((n) => {
          if (n.id !== a.id) return n;
          const before = centre(n);
          const data = { ...n.data };
          if (a.template) {
            const g = graphicById(a.template)!;
            Object.assign(data, { graphicId: g.id, src: g.src, label: g.label });
          }
          if (a.label !== undefined) data.headerText = a.label || data.label;
          if (a.header !== undefined) data.showHeader = a.header;
          const { width, height } = cardSize(data);
          const x = (a.x ?? before.x) - width / 2;
          const y = (a.y ?? before.y) - height / 2;
          return { ...n, data, position: { x, y } };
        }),
        edges: d.edges,
      };
    }
    case "connect":
      return {
        nodes: d.nodes,
        edges: [
          ...d.edges,
          { id: a.id, source: a.from, target: a.to, markerEnd: { type: ARROW }, ...(a.label && { label: a.label }) },
        ],
      };
    case "update_connection":
      return updateEdge(d, a.id, {
        ...(a.label !== undefined && { label: a.label }),
        ...(a.color && { color: a.color === DEFAULT_EDGE_COLOR ? null : a.color }),
      });
    case "remove":
      return removeItems(d, [a.id]);
  }
}

/** Apply planned actions to a diagram; the caller stores the result as one undo step. */
export function applyActions(d: Diagram, actions: Action[]): Diagram {
  return actions.reduce(applyAction, d);
}
