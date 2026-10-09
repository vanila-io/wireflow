import { currentImg, templateKey, templateUrl } from './templates';

// "Save file" writes the diagram as JSON in this format:
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
// changes between builds. "Open file" also accepts a plain { nodes, edges, groups }
// object, i.e. the contents of localStorage['data'].
export const FILE_FORMAT = 'wireflow';
export const FILE_VERSION = 1;
export const FILE_NAME = 'wireflow.json';

export class DiagramFileError extends Error {}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value) => (typeof value === 'string' && value !== '') || Number.isFinite(value);

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
    check(isObject(item) && isId(item.id), `It has a ${kind} without an id.`);
    check(!ids.has(item.id), `It has more than one item with the id "${item.id}".`);
    ids.add(item.id);
  };

  groups.forEach((group) => checkId(group, 'group'));
  const groupIds = new Set(ids);
  nodes.forEach((node) => {
    checkId(node, 'node');
    check(Number.isFinite(node.x) && Number.isFinite(node.y), `The node "${node.id}" has no position.`);
    check(node.label === undefined || typeof node.label === 'string', `The node "${node.id}" has a label that isn't text.`);
    check(node.parent === undefined || groupIds.has(node.parent), `The node "${node.id}" is in a group that doesn't exist.`);
  });
  groups.forEach((group) => {
    check(group.parent === undefined || groupIds.has(group.parent), `The group "${group.id}" is in a group that doesn't exist.`);
  });
  edges.forEach((edge) => {
    checkId(edge, 'edge');
    check(ids.has(edge.source) && ids.has(edge.target), `The edge "${edge.id}" isn't connected to items in the diagram.`);
  });
}

// Parse the text of a file picked with "Open file" into { nodes, edges, groups } with this
// build's image URLs, ready for gg-editor's read(). Throws a DiagramFileError, whose
// message is meant for the user, if the file isn't a diagram Wireflow can open.
export function parseDiagramFile(text) {
  let json;
  try {
    json = JSON.parse(text);
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
