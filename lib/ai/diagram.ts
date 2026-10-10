// The diagram layer the AI talks to (#105). `snapshot` and `planOps` are the
// engine-neutral planner and validator from #105 (ported in #113), reading
// Wireflow's diagram; `applyActions` is the React Flow apply step: a pure
// function whose result the store records as ONE undo step.
import { graphicById } from "@/lib/graphics";
import { absoluteBoxes, absolutePositions, fitGroups } from "@/lib/diagram/groups";
import {
  ARROW,
  cardSize,
  DEFAULT_EDGE_COLOR,
  isCard,
  isGroup,
  isNote,
  makeCard,
  makeNote,
  MAX_NOTE_TEXT,
  NOTE_BOUNDS,
  NOTE_SIZE,
  type Diagram,
  type DiagramNode,
} from "@/lib/diagram/model";
import { groupItems, removeItems, ungroupItem, updateEdge } from "@/lib/diagram/ops";
import { templateExists } from "./catalog";
import { layoutIssues, type Group, type Screen } from "./layout";

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

// Compact view of the diagram sent to the model with every user message. x and
// y are a screen's centre on the canvas. `view` is the part of the canvas the
// user can see, when the caller knows it.
export function snapshot({ data, selected = [], view }: { data: Diagram; selected?: string[]; view?: View }) {
  const boxes = absoluteBoxes(data.nodes);
  return {
    selected,
    ...(view ? { view } : {}),
    screens: data.nodes.filter(isCard).map((n) => {
      const b = boxes.get(n.id)!;
      return {
        id: n.id,
        template: n.data.graphicId,
        label: (n.data.headerText ?? n.data.label).slice(0, MAX_LABEL),
        x: round(b.x + b.width / 2),
        y: round(b.y + b.height / 2),
        header: n.data.showHeader !== false,
        group: n.parentId ?? null,
      };
    }),
    connections: data.edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: typeof e.label === "string" ? e.label : "",
    })),
    groups: data.nodes.filter(isGroup).map((g) => ({ id: g.id, label: g.data.label, parent: g.parentId ?? null })),
    notes: data.nodes.filter(isNote).map((n) => {
      const b = boxes.get(n.id)!;
      return {
        id: n.id,
        text: n.data.text,
        x: round(b.x + b.width / 2),
        y: round(b.y + b.height / 2),
        width: round(b.width),
        height: round(b.height),
        group: n.parentId ?? null,
      };
    }),
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
    "ids created earlier in the same batch. Removing a screen also removes its connections; removing a " +
    "group also removes the screens inside it (use ungroup to keep them).",
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
              "add_note",
              "Add a note: a box of free text (several lines allowed) for comments, requirements or annotations.",
              {
                id: str('New unique id, e.g. "note_login". Letters, digits, _ and -; must start with a letter.'),
                text: str(`The note's text, at most ${MAX_NOTE_TEXT} characters; line breaks are kept.`),
                x: num("Centre x in canvas pixels. Omit to auto-place."),
                y: num("Centre y in canvas pixels. Omit to auto-place."),
                width: num(`Width in px (${NOTE_BOUNDS.minWidth} to ${NOTE_BOUNDS.maxWidth}). Default ${NOTE_SIZE.width}.`),
                height: num(`Height in px (${NOTE_BOUNDS.minHeight} to ${NOTE_BOUNDS.maxHeight}). Default ${NOTE_SIZE.height}.`),
              },
              ["id", "text"]
            ),
            op(
              "update_note",
              "Change an existing note. Only the given fields change.",
              {
                id: str("Note id."),
                text: str("New text (replaces the old text)."),
                x: num("New centre x."),
                y: num("New centre y."),
                width: num("New width in px."),
                height: num("New height in px."),
              },
              ["id"]
            ),
            op(
              "connect",
              "Draw an arrow from one screen or note to another.",
              {
                id: str("New unique connection id."),
                from: str("Source screen or note id."),
                to: str("Target screen or note id."),
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
            op(
              "group",
              "Put two or more screens, notes or groups into a new labelled group frame.",
              {
                id: str("New unique group id."),
                label: str("Group label."),
                members: { type: "array", items: { type: "string" }, description: "Ids of screens, notes or groups to include." },
              },
              ["id", "label", "members"]
            ),
            op("ungroup", "Dissolve a group, keeping its screens.", { id: str("Group id.") }, ["id"]),
            op(
              "remove",
              "Delete screens, notes, connections or groups.",
              { ids: { type: "array", items: { type: "string" } } },
              ["ids"]
            ),
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
  | { kind: "add_note"; id: string; text: string; x: number; y: number; width: number; height: number }
  | { kind: "update_note"; id: string; text?: string; x?: number; y?: number; width?: number; height?: number }
  | { kind: "connect"; id: string; from: string; to: string; label?: string }
  | { kind: "update_connection"; id: string; label?: string; color?: string }
  | { kind: "group"; id: string; label: string; members: string[] }
  | { kind: "ungroup"; id: string }
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

// A note's text keeps its line breaks; other control characters become spaces.
const cleanText = (s: unknown) =>
  String(s)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n]/gu, " ")
    .replace(/\s+$/, "")
    .slice(0, MAX_NOTE_TEXT);

const has = (o: Record<string, unknown>, k: string) => o[k] !== undefined && o[k] !== null;

const ALLOWED: Record<string, string[]> = {
  clear: [],
  add_screen: ["id", "template", "label", "x", "y", "header"],
  update_screen: ["id", "template", "label", "x", "y", "header"],
  add_note: ["id", "text", "x", "y", "width", "height"],
  update_note: ["id", "text", "x", "y", "width", "height"],
  connect: ["id", "from", "to", "label"],
  update_connection: ["id", "label", "color"],
  group: ["id", "label", "members"],
  ungroup: ["id"],
  remove: ["ids"],
};

const sizeFor = (template: string, header: boolean, ratio?: number): [number, number] => {
  const { width, height } = cardSize({ graphicId: template, showHeader: header, ratio });
  return [width, height];
};

/**
 * Validate a tool input against the live diagram and turn it into actions.
 * Returns {errors} (nothing may be applied) or {actions, placed, summary,
 * warnings}. Warnings name layout problems the batch creates (overlapping
 * screens, a screen inside the frame of a group it is not in); the batch is
 * still valid, and the model can move things in a follow-up call.
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

  // Working copy of the diagram so each operation sees the effect of the previous
  // ones. N holds what a connection can join: screens, and notes (no template).
  type S = Screen & { kind: "screen" | "note"; template: string; header: boolean; ratio?: number };
  const boxes = absoluteBoxes(data.nodes);
  const N = new Map<string, S>(
    data.nodes.filter((n) => isCard(n) || isNote(n)).map((n) => {
      const b = boxes.get(n.id)!;
      return [
        n.id,
        {
          kind: isCard(n) ? "screen" : "note",
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          size: [b.width, b.height],
          parent: n.parentId ?? null,
          template: isCard(n) ? n.data.graphicId : "",
          header: isCard(n) ? n.data.showHeader !== false : false,
          ...(isCard(n) && { ratio: n.data.ratio }),
        },
      ];
    })
  );
  const E = new Map(data.edges.map((e) => [e.id, { source: e.source, target: e.target }]));
  const G = new Map<string, Group>(data.nodes.filter(isGroup).map((g) => [g.id, { parent: g.parentId ?? null }]));
  const exists = (id: string) => N.has(id) || E.has(id) || G.has(id);
  const first = ops[0] as { op?: unknown } | null;
  const layoutBefore = first?.op === "clear" ? new Map() : layoutIssues(N, G);

  const removeNode = (id: string) => {
    N.delete(id);
    for (const [eid, e] of E) if (e.source === id || e.target === id) E.delete(eid);
  };
  const removeGroup = (id: string) => {
    G.delete(id);
    for (const [nid, n] of N) if (n.parent === id) removeNode(nid);
    for (const [gid, g] of G) if (g.parent === id) removeGroup(gid);
    for (const [eid, e] of E) if (e.source === id || e.target === id) E.delete(eid);
  };

  // Every id the batch has seen, so a removal can tell "already removed by an
  // earlier id in this batch" (fine) from "never existed" (an error).
  const known = new Set([...N.keys(), ...E.keys(), ...G.keys()]);

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
    const size = (k: "width" | "height") => {
      if (!has(o, k)) return true;
      const [min, max] = k === "width" ? [NOTE_BOUNDS.minWidth, NOTE_BOUNDS.maxWidth] : [NOTE_BOUNDS.minHeight, NOTE_BOUNDS.maxHeight];
      const v = o[k];
      return (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) || fail(i, name, `${k} must be a number from ${min} to ${max}`);
    };

    switch (name) {
      case "clear": {
        if (i !== 0) return fail(i, name, "clear is only allowed as the first operation");
        N.clear();
        E.clear();
        G.clear();
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
          kind: "screen",
          x,
          y,
          size: sizeFor(o.template as string, header),
          parent: null,
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
        if (!screen || screen.kind !== "screen") return fail(i, name, `no screen "${o.id}"`);
        if (has(o, "template") && !template()) return;
        if (!coord("x") || !coord("y") || !bool("header") || !text("label")) return;
        const action: Action = { kind: "update_screen", id: o.id as string };
        if (has(o, "template")) action.template = screen.template = o.template as string;
        if (has(o, "label")) action.label = cleanLabel(o.label);
        if (has(o, "x")) action.x = screen.x = o.x as number;
        if (has(o, "y")) action.y = screen.y = o.y as number;
        if (has(o, "header")) action.header = screen.header = o.header as boolean;
        if (Object.keys(action).length === 2) return fail(i, name, "nothing to update");
        if (has(o, "template")) delete screen.ratio;
        screen.size = sizeFor(screen.template, screen.header, screen.ratio);
        actions.push(action);
        return;
      }
      case "add_note": {
        if (!newId(o.id) || !coord("x") || !coord("y") || !size("width") || !size("height")) return;
        if (typeof o.text !== "string") return fail(i, name, "text must be a string");
        let x = o.x as number;
        let y = o.y as number;
        if (!has(o, "x") || !has(o, "y")) {
          const p = autoPlace();
          x = has(o, "x") ? x : p.x;
          y = has(o, "y") ? y : p.y;
          placed[o.id as string] = [x, y];
        }
        const width = has(o, "width") ? Math.round(o.width as number) : NOTE_SIZE.width;
        const height = has(o, "height") ? Math.round(o.height as number) : NOTE_SIZE.height;
        N.set(o.id as string, { kind: "note", x, y, size: [width, height], parent: null, template: "", header: false });
        actions.push({ kind: "add_note", id: o.id as string, text: cleanText(o.text), x, y, width, height });
        return;
      }
      case "update_note": {
        const note = N.get(o.id as string);
        if (!note || note.kind !== "note") return fail(i, name, `no note "${o.id}"`);
        if (!coord("x") || !coord("y") || !size("width") || !size("height") || !text("text")) return;
        const action: Action = { kind: "update_note", id: o.id as string };
        if (has(o, "text")) action.text = cleanText(o.text);
        if (has(o, "x")) action.x = note.x = o.x as number;
        if (has(o, "y")) action.y = note.y = o.y as number;
        if (has(o, "width")) note.size = [(action.width = Math.round(o.width as number)), note.size[1]];
        if (has(o, "height")) note.size = [note.size[0], (action.height = Math.round(o.height as number))];
        if (Object.keys(action).length === 2) return fail(i, name, "nothing to update");
        actions.push(action);
        return;
      }
      case "connect": {
        if (!newId(o.id)) return;
        if (!N.has(o.from as string)) return fail(i, name, `no screen or note "${o.from}"`);
        if (!N.has(o.to as string)) return fail(i, name, `no screen or note "${o.to}"`);
        if (o.from === o.to) return fail(i, name, "a screen or note cannot connect to itself");
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
      case "group": {
        if (!newId(o.id)) return;
        if (typeof o.label !== "string") return fail(i, name, "label must be a string");
        if (!Array.isArray(o.members) || new Set(o.members).size < 2) {
          return fail(i, name, "a group needs at least 2 distinct members");
        }
        const members = [...new Set(o.members as unknown[])];
        if (members.some((m) => typeof m !== "string")) return fail(i, name, "members must be strings");
        const missing = (members as string[]).filter((m) => !N.has(m) && !G.has(m));
        if (missing.length) return fail(i, name, `unknown member(s): ${missing.join(", ")}`);
        const parents = new Set((members as string[]).map((m) => (N.get(m) ?? G.get(m))!.parent));
        if (parents.size > 1) return fail(i, name, "all members must currently be in the same group (or in none)");
        const [parent] = parents;
        G.set(o.id as string, { parent });
        (members as string[]).forEach((m) => ((N.get(m) ?? G.get(m))!.parent = o.id as string));
        known.add(o.id as string);
        actions.push({ kind: "group", id: o.id as string, label: cleanLabel(o.label), members: members as string[] });
        return;
      }
      case "ungroup": {
        const group = G.get(o.id as string);
        if (!group) return fail(i, name, `no group "${o.id}"`);
        for (const n of [...N.values(), ...G.values()]) if (n.parent === o.id) n.parent = group.parent;
        G.delete(o.id as string);
        for (const [eid, e] of E) if (e.source === o.id || e.target === o.id) E.delete(eid);
        actions.push({ kind: "ungroup", id: o.id as string });
        return;
      }
      case "remove": {
        if (!Array.isArray(o.ids) || !o.ids.length) return fail(i, name, "ids must be a non-empty array");
        for (const id of o.ids as unknown[]) {
          if (typeof id !== "string") return fail(i, name, "ids must be strings");
          if (N.has(id)) removeNode(id);
          else if (E.has(id)) E.delete(id);
          else if (G.has(id)) removeGroup(id);
          // Already removed with an earlier id of this batch (an edge of a
          // removed screen, a screen in a removed group): nothing left to do.
          else if (known.has(id)) continue;
          else return fail(i, name, `no screen, note, connection or group "${id}"`);
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
  const warnings = [...layoutIssues(N, G)].filter(([key]) => !layoutBefore.has(key)).map(([, message]) => message);
  if (warnings.length > MAX_WARNINGS) {
    warnings.splice(MAX_WARNINGS, Infinity, `and ${warnings.length - MAX_WARNINGS} more`);
  }
  const summary = (input as { summary?: unknown }).summary;
  return { actions, placed, summary: typeof summary === "string" ? summary : "", warnings };
}

// --- Apply (React Flow) -----------------------------------------------------

// Move a node so its centre is at (x, y) on the canvas, inside its group if it has one.
function moveCentre(d: Diagram, id: string, centre: { x: number; y: number }): DiagramNode[] {
  const boxes = absoluteBoxes(d.nodes);
  const positions = absolutePositions(d.nodes);
  return d.nodes.map((n) => {
    if (n.id !== id) return n;
    const b = boxes.get(id)!;
    const parent = n.parentId === undefined ? { x: 0, y: 0 } : positions.get(n.parentId)!;
    return { ...n, position: { x: centre.x - b.width / 2 - parent.x, y: centre.y - b.height / 2 - parent.y } };
  });
}

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
      // place the centre (the old one if none is given). A card in a group is
      // placed relative to it.
      const before = absoluteBoxes(d.nodes).get(a.id)!;
      const nodes = d.nodes.map((n): DiagramNode => {
        if (n.id !== a.id || !isCard(n)) return n;
        const data = { ...n.data };
        if (a.template) {
          const g = graphicById(a.template)!;
          Object.assign(data, { graphicId: g.id, src: g.src, label: g.label });
        }
        if (a.label !== undefined) data.headerText = a.label || data.label;
        if (a.header !== undefined) data.showHeader = a.header;
        return { ...n, data };
      });
      const centre = { x: a.x ?? before.x + before.width / 2, y: a.y ?? before.y + before.height / 2 };
      return { nodes: moveCentre({ nodes, edges: d.edges }, a.id, centre), edges: d.edges };
    }
    case "add_note": {
      const note = makeNote({ x: a.x - a.width / 2, y: a.y - a.height / 2 }, a.text, a.id);
      return { nodes: [...d.nodes, { ...note, width: a.width, height: a.height }], edges: d.edges };
    }
    case "update_note": {
      // Size first, then the centre (the old one if none is given).
      const before = absoluteBoxes(d.nodes).get(a.id)!;
      const nodes = d.nodes.map((n): DiagramNode => {
        if (n.id !== a.id || !isNote(n)) return n;
        return {
          ...n,
          ...(a.width !== undefined && { width: a.width }),
          ...(a.height !== undefined && { height: a.height }),
          ...(a.text !== undefined && { data: { ...n.data, text: a.text } }),
        };
      });
      const centre = { x: a.x ?? before.x + before.width / 2, y: a.y ?? before.y + before.height / 2 };
      return { nodes: moveCentre({ nodes, edges: d.edges }, a.id, centre), edges: d.edges };
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
    case "group":
      return groupItems(d, a.members, { id: a.id, label: a.label });
    case "ungroup":
      return ungroupItem(d, a.id);
    case "remove":
      // A group's contents may already be gone with an earlier removal.
      return d.nodes.some((n) => n.id === a.id) || d.edges.some((e) => e.id === a.id) ? removeItems(d, [a.id]) : d;
  }
}

/** Apply planned actions to a diagram; the caller stores the result as one undo step. */
export function applyActions(d: Diagram, actions: Action[]): Diagram {
  const result = actions.reduce(applyAction, d);
  return { nodes: fitGroups(result.nodes), edges: result.edges };
}
