// wireflow.json: the file Export JSON writes and Open file reads.
//
//   {
//     "format": "wireflow",
//     "version": 2,
//     "diagram": { "nodes": [...], "edges": [...] }
//   }
//
// `diagram` is the stored diagram (see model.ts), except that a card keeps only
// its template id (data.graphicId, production's stable ids such as
// "e-commerce-cart") and not the image URL, which this build derives from it.
//
// Open file also reads, so that no earlier file or backup is stranded:
// - production's Export JSON: React Flow's plain {nodes, edges};
// - the previous editor's files (#109): {"format": "wireflow", "version": 1,
//   "diagram": {nodes, edges, groups}} in G6's format, cards named by
//   "<folder>/<file>" template keys;
// - the previous editor's plain G6 {nodes, edges, groups} (its localStorage['data']).
import { fromG6, legacyGraphic, type G6Diagram } from './legacy';
import { isCard, type Diagram } from './model';
import { dropProto, enforceRules, enforceRulesOnLoad, type Dropped } from './rules';

export const FILE_FORMAT = 'wireflow';
export const FILE_VERSION = 2;
export const FILE_NAME = 'wireflow.json';
// Anything larger can't be a hand-made diagram and could hang the tab.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_NODES = 2000;
export const MAX_EDGES = 5000;

export class DiagramFileError extends Error {}

export function serializeFile(diagram: Diagram): string {
  const { nodes, edges } = enforceRules(diagram).diagram;
  const fileNodes = nodes.map((n) => {
    if (!isCard(n)) return n;
    const data: Partial<typeof n.data> = { ...n.data };
    delete data.src;
    return { ...n, data };
  });
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, diagram: { nodes: fileNodes, edges } }, null, 2);
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '';
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

function check(condition: unknown, problem: string): asserts condition {
  if (!condition) throw new DiagramFileError(problem);
}

// Ids, uniqueness and group nesting, the same for both formats. Edges are checked
// for ids only: one with a missing end is dropped later, with a message.
function checkStructure(nodes: Obj[], edges: unknown[], groups: Obj[], parentKey: 'parentId' | 'parent') {
  check(nodes.length + groups.length <= MAX_NODES && edges.length <= MAX_EDGES, "It has more items than Wireflow can show.");
  const ids = new Set<string>();
  const checkId = (item: unknown, kind: string) => {
    check(isObject(item) && isId(item.id), `It has ${kind} whose id is missing or isn't text.`);
    check(!ids.has(item.id as string), `It has more than one item with the id "${item.id}".`);
    ids.add(item.id as string);
  };
  [...groups, ...nodes].forEach((item) => checkId(item, 'an item'));
  edges.forEach((e) => checkId(e, 'a connection'));

  const all = [...groups, ...nodes];
  const byId = new Map(all.map((n) => [n.id as string, n]));
  const isGroupItem = (n: Obj | undefined) => !!n && (parentKey === 'parent' ? groups.includes(n) : n.type === 'group');
  for (const n of all) {
    const parent = n[parentKey];
    if (parent === undefined || parent === null) continue;
    check(isId(parent) && isGroupItem(byId.get(parent)), `The item "${n.id}" is in a group that doesn't exist.`);
    // A chain longer than the number of items has a loop (the old editor hung on it).
    let p: unknown = parent;
    for (let steps = 0; isId(p); steps++) {
      check(steps <= all.length, `The group "${p}" is inside itself.`);
      p = byId.get(p)?.[parentKey];
    }
  }
}

function parseCurrent(diagram: Obj): Obj {
  const { nodes, edges = [] } = diagram as { nodes: unknown[]; edges?: unknown };
  check(Array.isArray(edges), "It doesn't contain a Wireflow diagram.");
  nodes.forEach((n) => check(isObject(n), "It doesn't contain a Wireflow diagram."));
  checkStructure(nodes as Obj[], edges, [], 'parentId');
  for (const n of nodes as Obj[]) {
    check(n.type === 'flow' || n.type === 'group', `The item "${n.id}" isn't a card or a group.`);
    check(isObject(n.position) && finite(n.position.x) && finite(n.position.y), `The item "${n.id}" has no position.`);
    const data = isObject(n.data) ? n.data : {};
    if (n.type === 'flow') {
      check(isId(data.graphicId), `The card "${n.id}" doesn't say which screen template it shows.`);
      check(enforceRules({ nodes: [n], edges: [] }).diagram.nodes.length === 1, `It uses a screen template this version of Wireflow doesn't have: "${data.graphicId}".`);
    }
    for (const key of ['label', 'headerText'])
      check(data[key] === undefined || typeof data[key] === 'string', `The item "${n.id}" has a ${key === 'label' ? 'label' : 'header'} that isn't text.`);
  }
  return { nodes, edges };
}

function parseG6(diagram: Obj): Obj {
  const { nodes, edges = [], groups = [] } = diagram as { nodes: unknown[]; edges?: unknown; groups?: unknown };
  check(Array.isArray(edges) && Array.isArray(groups), "It doesn't contain a Wireflow diagram.");
  [...nodes, ...groups].forEach((n) => check(isObject(n), "It doesn't contain a Wireflow diagram."));
  checkStructure(nodes as Obj[], edges, groups as Obj[], 'parent');
  for (const n of nodes as Obj[]) {
    check(finite(n.x) && finite(n.y), `The item "${n.id}" has no position.`);
    check(n.label === undefined || typeof n.label === 'string', `The item "${n.id}" has a label that isn't text.`);
    const graphic = legacyGraphic(n);
    if (typeof n.template === 'string') check(graphic, `It uses a screen template this version of Wireflow doesn't have: "${n.template}".`);
    check(graphic, `The card "${n.id}" doesn't show one of Wireflow's screen templates.`);
  }
  for (const g of groups as Obj[]) check(g.label === undefined || typeof g.label === 'string', `The group "${g.id}" has a label that isn't text.`);
  return fromG6({ nodes, edges, groups } as G6Diagram);
}

/**
 * Read the text of a file picked with Open file. Returns the diagram in the
 * current format and what had to be dropped (connections with a missing end).
 * Throws a DiagramFileError, whose message is for the user, if Wireflow can't
 * open it.
 */
export function parseFile(text: string): { diagram: Diagram; dropped: Dropped } {
  let json: unknown;
  try {
    // A file can come from anyone: "__proto__" keys are dropped while parsing.
    json = JSON.parse(text, dropProto);
  } catch {
    throw new DiagramFileError("It isn't a JSON file.");
  }

  let diagram = json;
  let legacy: boolean | undefined;
  if (isObject(json) && 'format' in json) {
    check(json.format === FILE_FORMAT, "It isn't a Wireflow file.");
    check(Number.isInteger(json.version) && (json.version as number) >= 1, 'It has an unknown file version.');
    check((json.version as number) <= FILE_VERSION, 'It was saved by a newer version of Wireflow.');
    diagram = json.diagram;
    legacy = json.version === 1;
  }
  check(isObject(diagram) && Array.isArray(diagram.nodes), "It doesn't contain a Wireflow diagram.");
  // Without a version, tell the two plain formats apart by how nodes are placed.
  legacy ??= 'groups' in diagram || (diagram.nodes as unknown[]).some((n) => isObject(n) && !('position' in n) && 'x' in n);

  return enforceRulesOnLoad(legacy ? parseG6(diagram) : parseCurrent(diagram));
}

/** Read the previous editor's localStorage['data'], or null if it can't be used. */
export function parseLegacyStorage(text: string): Diagram | null {
  try {
    const { diagram } = parseFile(text);
    return diagram.nodes.length ? diagram : null;
  } catch {
    return null;
  }
}
