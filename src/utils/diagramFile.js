import { currentImg, templateKey, templateUrl } from './templates';

// "Save to file" writes the diagram as JSON in this format:
//
//   {
//     "format": "wireflow",
//     "version": 1,
//     "diagram": { "nodes": [...], "edges": [...], "groups": [...] }
//   }
//
// `diagram` holds the same items as gg-editor's save() and localStorage['data'], with
// one change: a node that shows a template screen stores the template's key
// ("template": "E-Commerce/Cart", see ./templates.js) instead of its "img" URL, which
// belongs to one build of the app. "Open file" also accepts a plain
// { nodes, edges, groups } object, i.e. the contents of localStorage['data'].
export const FILE_FORMAT = 'wireflow';
export const FILE_VERSION = 1;
export const FILE_NAME = 'wireflow.json';

// Emitted on gg-editor's editor (editor.emit) after Open file has replaced the whole
// diagram and cleared the undo history, so other panels can let go of earlier changes.
export const DIAGRAM_REPLACED = 'afterdiagramreplace';

export class DiagramFileError extends Error {}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
// Wireflow and gg-editor only write string ids, and G6 can't select an item whose id is
// a number, so ids must be text.
const isId = (value) => typeof value === 'string' && value !== '';
// Before #65 was fixed, an edge dropped on empty canvas was saved with a canvas point,
// { x, y }, as that end instead of an item id. Files saved then still open: the point is
// valid here, and opening drops such edges (removeDanglingEdges) like every other load.
const isPoint = (value) => isObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y);

function nodeToFile(node) {
  const template = templateKey(node.img);
  if (!template) return node;

  const fileNode = { ...node, template };
  delete fileNode.img;
  return fileNode;
}

function nodeFromFile(node) {
  // Plain diagrams (and nodes with a custom image) keep their URL; repair it if it's a template.
  if (node.template === undefined) return node.img === undefined ? node : { ...node, img: currentImg(node.img) };

  const { template, ...rest } = node;
  const img = templateUrl(template);
  check(img, `It uses a screen template this version of Wireflow doesn't have: "${template}".`);
  return { ...rest, img };
}

export function serializeDiagram({ nodes = [], edges = [], groups = [] } = {}) {
  const file = { format: FILE_FORMAT, version: FILE_VERSION, diagram: { nodes: nodes.map(nodeToFile), edges, groups } };
  return JSON.stringify(file, null, 2);
}

function check(condition, problem) {
  if (!condition) throw new DiagramFileError(problem);
}

function checkItems(nodes, edges, groups) {
  const ids = new Set();
  const checkId = (item, kind) => {
    check(isObject(item) && isId(item.id), `It has ${kind} whose id is missing or isn't text.`);
    check(!ids.has(item.id), `It has more than one item with the id "${item.id}".`);
    ids.add(item.id);
  };

  groups.forEach((group) => checkId(group, 'a group'));
  const groupIds = new Set(ids);
  const checkParent = (item, kind) =>
    check(item.parent === undefined || groupIds.has(item.parent), `The ${kind} "${item.id}" is in a group that doesn't exist.`);
  groups.forEach((group) => checkParent(group, 'group'));
  // G6 follows `parent` links until they run out, so a group inside itself would hang
  // the page. A chain longer than the number of groups has a loop.
  const parentOf = new Map(groups.map((group) => [group.id, group.parent]));
  groups.forEach((group) => {
    let parent = group.parent;
    for (let steps = 0; parent !== undefined; steps += 1) {
      check(steps < groups.length, `The group "${parent}" is inside itself.`);
      parent = parentOf.get(parent);
    }
  });

  nodes.forEach((node) => {
    checkId(node, 'a node');
    check(Number.isFinite(node.x) && Number.isFinite(node.y), `The node "${node.id}" has no position.`);
    check(node.label === undefined || typeof node.label === 'string', `The node "${node.id}" has a label that isn't text.`);
    checkParent(node, 'node');
  });

  const endIds = new Set(ids); // nodes and groups
  const isEnd = (end) => endIds.has(end) || isPoint(end);
  edges.forEach((edge) => {
    checkId(edge, 'an edge');
    check(isEnd(edge.source) && isEnd(edge.target), `The edge "${edge.id}" isn't connected to items in the diagram.`);
    // The edge panel reads these when the edge is selected.
    check(edge.style === undefined || isObject(edge.style), `The edge "${edge.id}" has a style that isn't valid.`);
    check(edge.color === undefined || typeof edge.color === 'string', `The edge "${edge.id}" has a color that isn't text.`);
  });
}

// Parse the text of a file picked with "Open file" into { nodes, edges, groups } with this
// build's image URLs, ready for gg-editor's read(). Throws a DiagramFileError, whose
// message is meant for the user, if the file isn't a diagram Wireflow can open.
export function parseDiagramFile(text) {
  let json;
  try {
    // A file can come from anyone. Drop "__proto__" keys: G6 deep-merges item models
    // (Util.mix(true, ...)), and merging such a key would change Object.prototype.
    json = JSON.parse(text, (key, value) => (key === '__proto__' ? undefined : value));
  } catch {
    throw new DiagramFileError("It isn't a JSON file.");
  }

  let diagram = json;
  if (isObject(json) && 'format' in json) {
    check(json.format === FILE_FORMAT, "It isn't a Wireflow file.");
    check(Number.isInteger(json.version) && json.version >= 1, 'It has an unknown file version.');
    check(json.version <= FILE_VERSION, 'It was saved by a newer version of Wireflow.');
    diagram = json.diagram;
  }

  check(isObject(diagram) && Array.isArray(diagram.nodes), "It doesn't contain a Wireflow diagram.");
  const { nodes, edges = [], groups = [] } = diagram;
  check(Array.isArray(edges) && Array.isArray(groups), "It doesn't contain a Wireflow diagram.");
  checkItems(nodes, edges, groups);

  return { nodes: nodes.map(nodeFromFile), edges, groups };
}
