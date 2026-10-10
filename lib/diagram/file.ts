// wireflow.json: the file Export JSON writes and Open file reads (#109).
//
//   {
//     "format": "wireflow",
//     "version": 2,
//     "diagram": { "nodes": [...], "edges": [...] }
//   }
//
// `diagram` is the stored diagram (see model.ts), except that a card keeps only
// its template id (data.graphicId, the stable ids in lib/graphics.json such as
// "e-commerce-cart") and not the image URL, which this build derives from it.
//
// Open file also reads, so that no earlier file is stranded:
// - Export JSON from before this change: React Flow's plain {nodes, edges};
// - the earlier gg-editor app's files (#109): {"format": "wireflow", "version": 1,
//   "diagram": {nodes, edges, groups}} in G6's format, cards named by
//   "<folder>/<file>" template keys;
// - that app's plain G6 {nodes, edges, groups} (its localStorage["data"]).
import { fromG6, legacyGraphic, type G6Diagram } from "./legacy";
import type { Diagram } from "./model";
import { dropProto, enforceRules, type Dropped } from "./rules";

export const FILE_FORMAT = "wireflow";
export const FILE_VERSION = 2;
export const FILE_NAME = "wireflow.json";
// Anything larger can't be a hand-made diagram and could hang the tab.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_NODES = 2000;
export const MAX_EDGES = 5000;

export class DiagramFileError extends Error {}

export function serializeFile(diagram: Diagram): string {
  const { nodes, edges } = enforceRules(diagram).diagram;
  const fileNodes = nodes.map((n) => {
    const data: Partial<typeof n.data> = { ...n.data };
    delete data.src;
    return { ...n, data };
  });
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, diagram: { nodes: fileNodes, edges } }, null, 2);
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v !== "";
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function check(condition: unknown, problem: string): asserts condition {
  if (!condition) throw new DiagramFileError(problem);
}

// Size and ids, the same for both formats. Edges are checked for ids only: one
// with a missing end is dropped later, with a message.
function checkIds(items: unknown[], edges: unknown[]) {
  check(items.length <= MAX_NODES && edges.length <= MAX_EDGES, "It has more items than Wireflow can show.");
  const ids = new Set<string>();
  const checkId = (item: unknown, kind: string) => {
    check(isObject(item) && isId(item.id), `It has ${kind} whose id is missing or isn't text.`);
    check(!ids.has(item.id as string), `It has more than one item with the id "${item.id}".`);
    ids.add(item.id as string);
  };
  items.forEach((item) => checkId(item, "an item"));
  edges.forEach((e) => checkId(e, "a connection"));
}

function parseCurrent(diagram: Obj): Obj {
  const { nodes, edges = [] } = diagram as { nodes: unknown[]; edges?: unknown };
  check(Array.isArray(edges), "It doesn't contain a Wireflow diagram.");
  nodes.forEach((n) => check(isObject(n), "It doesn't contain a Wireflow diagram."));
  checkIds(nodes, edges);
  for (const n of nodes as Obj[]) {
    check(n.type === "flow", `The item "${n.id}" isn't a card.`);
    check(isObject(n.position) && finite(n.position.x) && finite(n.position.y), `The item "${n.id}" has no position.`);
    const data = isObject(n.data) ? n.data : {};
    check(isId(data.graphicId), `The card "${n.id}" doesn't say which screen template it shows.`);
    check(
      enforceRules({ nodes: [n], edges: [] }).diagram.nodes.length === 1,
      `It uses a screen template this version of Wireflow doesn't have: "${data.graphicId}".`
    );
    for (const key of ["label", "headerText"]) {
      check(
        data[key] === undefined || typeof data[key] === "string",
        `The item "${n.id}" has a ${key === "label" ? "label" : "header"} that isn't text.`
      );
    }
  }
  return { nodes, edges };
}

function parseG6(diagram: Obj): G6Diagram {
  const { nodes, edges = [], groups = [] } = diagram as { nodes: unknown[]; edges?: unknown; groups?: unknown };
  check(Array.isArray(edges) && Array.isArray(groups), "It doesn't contain a Wireflow diagram.");
  [...nodes, ...groups].forEach((n) => check(isObject(n), "It doesn't contain a Wireflow diagram."));
  checkIds([...groups, ...nodes], edges);
  // Groups are left out, but a file whose groups are broken is broken (the old
  // editor hung on a group inside itself), so it is refused as before.
  const all = [...groups, ...nodes] as Obj[];
  const byId = new Map(all.map((n) => [n.id as string, n]));
  for (const n of all) {
    if (n.parent === undefined || n.parent === null) continue;
    check(
      isId(n.parent) && (groups as Obj[]).includes(byId.get(n.parent)!),
      `The item "${n.id}" is in a group that doesn't exist.`
    );
    let p: unknown = n.parent;
    for (let steps = 0; isId(p); steps++) {
      check(steps <= all.length, `The group "${p}" is inside itself.`);
      p = byId.get(p)?.parent;
    }
  }
  for (const n of nodes as Obj[]) {
    check(finite(n.x) && finite(n.y), `The item "${n.id}" has no position.`);
    check(n.label === undefined || typeof n.label === "string", `The item "${n.id}" has a label that isn't text.`);
    const graphic = legacyGraphic(n);
    if (typeof n.template === "string") {
      check(graphic, `It uses a screen template this version of Wireflow doesn't have: "${n.template}".`);
    }
    check(graphic, `The card "${n.id}" doesn't show one of Wireflow's screen templates.`);
  }
  return { nodes, edges, groups } as G6Diagram;
}

export type Opened = {
  diagram: Diagram;
  /** What the rules dropped (connections with a missing end). */
  dropped: Dropped;
  /** Groups of an old gg-editor file that were left out (their cards are kept). */
  groups: number;
};

/**
 * Read the text of a file picked with Open file. Returns the diagram in the
 * current format and what had to be left out. Throws a DiagramFileError, whose
 * message is for the user, if Wireflow can't open it.
 */
export function parseFile(text: string): Opened {
  let json: unknown;
  try {
    // A file can come from anyone: "__proto__" keys are dropped while parsing.
    json = JSON.parse(text, dropProto);
  } catch {
    throw new DiagramFileError("It isn't a JSON file.");
  }

  let diagram = json;
  let legacy: boolean | undefined;
  if (isObject(json) && "format" in json) {
    check(json.format === FILE_FORMAT, "It isn't a Wireflow file.");
    check(Number.isInteger(json.version) && (json.version as number) >= 1, "It has an unknown file version.");
    check((json.version as number) <= FILE_VERSION, "It was saved by a newer version of Wireflow.");
    diagram = json.diagram;
    legacy = json.version === 1;
  }
  check(isObject(diagram) && Array.isArray(diagram.nodes), "It doesn't contain a Wireflow diagram.");
  // Without a version, tell the two plain formats apart by how nodes are placed.
  legacy ??=
    "groups" in diagram || (diagram.nodes as unknown[]).some((n) => isObject(n) && !("position" in n) && "x" in n);

  if (legacy) {
    const g6 = parseG6(diagram);
    return { ...enforceRules(fromG6(g6)), groups: g6.groups.length };
  }
  return { ...enforceRules(parseCurrent(diagram)), groups: 0 };
}
