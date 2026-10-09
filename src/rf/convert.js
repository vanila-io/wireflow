// Converts between the diagram format Wireflow saves (gg-editor 2 / G6 2.x `save()`,
// kept in localStorage['data']) and React Flow's nodes and edges.
//
// G6 format                                      React Flow
// ---------------------------------------------  ---------------------------------------------
// node {id, type:'node', shape, size:[w,h],      node {id, type:'screen', position (top-left,
//   img, label, x, y (CENTER), parent?}            relative to the parent frame), width, height,
//                                                  parentId?, data:{img, label, header, shape}}
// group {id, label, parent?, x?, y?}             node {id, type:'group', position, width,
//   (G6 draws it around its children)              height, parentId?, data:{label}}
// edge {id, source, target, sourceAnchor,        edge {id, source, target, sourceHandle,
//   targetAnchor, shape, color,                    targetHandle, type, label, style,
//   style:{lineWidth}, label?}                     markerEnd, data:{shape, color, lineWidth}}
//
// Every field the converter does not map is kept in `data.g6` and written back, so a
// load followed by a save returns the same diagram. Positions that were not changed
// in React Flow are written back as the exact original numbers.

// gg-editor's flow nodes have four anchors: 0 top, 1 right, 2 bottom, 3 left.
export const HANDLES = ['top', 'right', 'bottom', 'left'];
export const anchorToHandle = (anchor) => HANDLES[anchor] ?? null;
export const handleToAnchor = (handle) => {
  const index = HANDLES.indexOf(handle);
  return index === -1 ? undefined : index;
};

// G6 edge shapes and the React Flow built-in edge type that draws them closest.
export const EDGE_TYPES = {
  'flow-polyline-round': { type: 'smoothstep', pathOptions: { borderRadius: 8 } },
  'flow-polyline': { type: 'step' },
  'flow-smooth': { type: 'default' },
};
export const DEFAULT_EDGE_SHAPE = 'flow-polyline-round';
export const DEFAULT_EDGE_COLOR = '#a4b2c0';

export const HEADER_SHAPE = 'node-image-header';
export const PLAIN_SHAPE = 'node-image-without-header';
export const NODE_SIZE = { [HEADER_SHAPE]: [96, 88], [PLAIN_SHAPE]: [96, 78] };

// Space between a group's frame and its children's boxes. gg-editor pads the children's
// bounding box by [40, 10, 10, 10] (top, right, bottom, left), but G6's bounding box of a
// node is larger than its rectangle (anchor markers, selection outline). These values
// reproduce the frame gg-editor draws, measured on e2e/fixtures/checkout-flow.json.
export const GROUP_PADDING = { top: 52, right: 10, bottom: 16, left: 10 };
// G6 stores a group's x/y as the top-left of its children's bounding box, i.e. the
// frame's top-left plus padding [40, 10, 10, 10].
const G6_GROUP_OFFSET = { x: 10, y: 40 };
// G6's size for a group without children (shape `common`: defaultWidth/defaultHeight).
export const EMPTY_GROUP_SIZE = [184, 40];

const EPSILON = 1e-6;
const same = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < EPSILON;
// Write back the original number when React Flow didn't move the item.
const keep = (original, computed) => (same(original, computed) ? original : computed);

function omit(object, keys) {
  const rest = { ...object };
  keys.forEach((key) => delete rest[key]);
  return rest;
}

const nodeSize = (node) => {
  const size = Array.isArray(node.size) ? node.size : NODE_SIZE[node.shape] ?? NODE_SIZE[HEADER_SHAPE];
  return [Number(size[0]) || 96, Number(size[1]) || 88];
};

/**
 * G6 diagram -> React Flow. Returns {nodes, edges, dropped} where `dropped` lists the
 * edges that can't be drawn because an end is not a node or group in the diagram
 * (e.g. saved with a canvas point as its end, see #107).
 *
 * `img` maps a saved image URL to the one to show (e.g. to repair old template URLs).
 */
export function fromG6(data, { img = (url) => url } = {}) {
  const g6Nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const g6Groups = Array.isArray(data?.groups) ? data.groups : [];
  const g6Edges = Array.isArray(data?.edges) ? data.edges : [];

  const groupById = new Map(g6Groups.map((group) => [group.id, group]));
  // A parent that doesn't exist (or a cycle) leaves the item at the top level.
  const parentOf = (item) => {
    let parent = item.parent;
    const seen = new Set([item.id]);
    for (let p = parent; p !== undefined; p = groupById.get(p)?.parent) {
      if (!groupById.has(p) || seen.has(p)) return undefined;
      seen.add(p);
    }
    return parent;
  };

  // Absolute boxes (top-left + size) of nodes, then of groups, children first.
  const boxes = new Map();
  g6Nodes.forEach((node) => {
    const [width, height] = nodeSize(node);
    boxes.set(node.id, { x: node.x - width / 2, y: node.y - height / 2, width, height });
  });
  const children = new Map(g6Groups.map((group) => [group.id, []]));
  [...g6Nodes, ...g6Groups].forEach((item) => {
    const parent = parentOf(item);
    if (parent !== undefined) children.get(parent).push(item.id);
  });
  const groupBox = (id) => {
    if (boxes.has(id)) return boxes.get(id);
    const group = groupById.get(id);
    const kids = children.get(id).map((child) => (groupById.has(child) ? groupBox(child) : boxes.get(child)));
    let box;
    if (kids.length === 0) {
      box = { x: group.x ?? 0, y: group.y ?? 0, width: EMPTY_GROUP_SIZE[0], height: EMPTY_GROUP_SIZE[1] };
    } else {
      const minX = Math.min(...kids.map((b) => b.x)) - GROUP_PADDING.left;
      const minY = Math.min(...kids.map((b) => b.y)) - GROUP_PADDING.top;
      const maxX = Math.max(...kids.map((b) => b.x + b.width)) + GROUP_PADDING.right;
      const maxY = Math.max(...kids.map((b) => b.y + b.height)) + GROUP_PADDING.bottom;
      box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    boxes.set(id, box);
    return box;
  };
  g6Groups.forEach((group) => groupBox(group.id));

  const relative = (id, parent) => {
    const box = boxes.get(id);
    if (parent === undefined) return { x: box.x, y: box.y };
    const frame = boxes.get(parent);
    return { x: box.x - frame.x, y: box.y - frame.y };
  };

  // React Flow needs a parent before its children: groups outermost first, then nodes.
  const depth = (group) => {
    let d = 0;
    for (let p = parentOf(group); p !== undefined; p = parentOf(groupById.get(p))) d += 1;
    return d;
  };
  const groups = [...g6Groups]
    .map((group, index) => ({ group, index, depth: depth(group) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map(({ group }) => {
      const parent = parentOf(group);
      const box = boxes.get(group.id);
      return {
        id: group.id,
        type: 'group',
        position: relative(group.id, parent),
        width: box.width,
        height: box.height,
        ...(parent !== undefined && { parentId: parent }),
        data: {
          label: group.label,
          // Where the frame was on load, to write back the original x/y if it didn't move.
          loaded: { x: box.x, y: box.y },
          g6: omit(group, ['id', 'label', 'parent']),
        },
      };
    });

  const nodes = g6Nodes.map((node) => {
    const parent = parentOf(node);
    const box = boxes.get(node.id);
    return {
      id: node.id,
      type: 'screen',
      position: relative(node.id, parent),
      width: box.width,
      height: box.height,
      ...(parent !== undefined && { parentId: parent }),
      data: {
        img: img(node.img),
        label: node.label,
        shape: node.shape,
        header: node.shape !== PLAIN_SHAPE,
        g6: omit(node, ['id', 'type', 'size', 'img', 'label', 'shape', 'parent']),
      },
    };
  });

  const ids = new Set([...g6Nodes, ...g6Groups].map((item) => item.id));
  const dropped = g6Edges.filter((edge) => !ids.has(edge.source) || !ids.has(edge.target));
  const edges = g6Edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) =>
      toRfEdge(edge, {
        sourceHandle: anchorToHandle(edge.sourceAnchor),
        targetHandle: anchorToHandle(edge.targetAnchor),
      }),
    );

  return { nodes: [...groups, ...nodes], edges, dropped };
}

// A React Flow edge for a G6 edge model; also used for new connections.
export function toRfEdge(edge, { sourceHandle = null, targetHandle = null } = {}) {
  const shape = edge.shape ?? DEFAULT_EDGE_SHAPE;
  const color = edge.color ?? DEFAULT_EDGE_COLOR;
  const lineWidth = edge.style?.lineWidth ?? 1;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle,
    targetHandle,
    ...edgeAppearance({ shape, color, lineWidth, label: edge.label }),
    data: {
      shape,
      color,
      lineWidth,
      label: edge.label,
      g6: omit(edge, ['id', 'source', 'target', 'sourceAnchor', 'targetAnchor', 'shape', 'color', 'label']),
    },
  };
}

// How an edge is drawn, from its G6 properties.
export function edgeAppearance({ shape, color, lineWidth, label }) {
  const { type, pathOptions } = EDGE_TYPES[shape] ?? EDGE_TYPES[DEFAULT_EDGE_SHAPE];
  return {
    type,
    ...(pathOptions && { pathOptions }),
    ...(label ? { label } : {}),
    style: { stroke: color, strokeWidth: lineWidth },
    // React Flow's markers scale with the stroke width (markerUnits="strokeWidth");
    // G6's arrow keeps about the same size, so shrink the marker as the line gets wider.
    markerEnd: { type: 'arrowclosed', color, width: 24 / lineWidth, height: 24 / lineWidth },
    labelStyle: { fill: '#666', fontSize: 12 },
    labelBgStyle: { fill: '#fff' },
    labelBgPadding: [6, 4],
  };
}

/**
 * React Flow -> G6 diagram, in the format gg-editor reads and saves.
 */
export function toG6({ nodes = [], edges = [] } = {}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const boxes = absoluteBoxes(nodes);
  const parentField = (node) => (node.parentId !== undefined && byId.has(node.parentId) ? { parent: node.parentId } : {});
  const hasChildren = new Set(nodes.map((node) => node.parentId));

  // Known fields come first in a fixed order and unmapped fields after them, so saving
  // a diagram that was just loaded gives the same JSON string (undo relies on that).
  const g6Nodes = nodes
    .filter((node) => node.type === 'screen')
    .map((node) => {
      const { g6 = {}, img, label, shape } = node.data;
      const { x, y, width, height } = boxes.get(node.id);
      return {
        type: 'node',
        size: [width, height],
        shape: shape ?? HEADER_SHAPE,
        img,
        ...(label !== undefined && { label }),
        x: keep(g6.x, x + width / 2),
        y: keep(g6.y, y + height / 2),
        id: node.id,
        ...parentField(node),
        ...omit(g6, ['x', 'y']),
      };
    });

  const g6Groups = nodes
    .filter((node) => node.type === 'group')
    .map((node) => {
      const { g6 = {}, label, loaded } = node.data;
      const frame = boxes.get(node.id);
      let position;
      if (loaded && 'x' in g6 && 'y' in g6) {
        // Move the saved x/y by as much as the frame moved.
        position = { x: keep(g6.x, g6.x + frame.x - loaded.x), y: keep(g6.y, g6.y + frame.y - loaded.y) };
      } else {
        const offset = hasChildren.has(node.id) ? G6_GROUP_OFFSET : { x: 0, y: 0 };
        position = { x: frame.x + offset.x, y: frame.y + offset.y };
      }
      return {
        id: node.id,
        ...(label !== undefined && { label }),
        ...position,
        ...parentField(node),
        ...omit(g6, ['x', 'y']),
      };
    });

  const ids = new Set(nodes.map((node) => node.id));
  const g6Edges = edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => {
      const { g6 = {}, shape = DEFAULT_EDGE_SHAPE, color = DEFAULT_EDGE_COLOR, lineWidth = 2, label } = edge.data ?? {};
      const sourceAnchor = handleToAnchor(edge.sourceHandle);
      const targetAnchor = handleToAnchor(edge.targetHandle);
      return {
        source: edge.source,
        // An edge saved without an anchor stays without one.
        ...(sourceAnchor !== undefined && { sourceAnchor }),
        target: edge.target,
        ...(targetAnchor !== undefined && { targetAnchor }),
        shape,
        color,
        style: { ...g6.style, lineWidth },
        ...(label !== undefined && { label }),
        id: edge.id,
        ...omit(g6, ['style']),
      };
    });

  return { nodes: g6Nodes, edges: g6Edges, groups: g6Groups };
}

/**
 * Re-fit every group frame around its children, as G6 does, keeping each item's
 * absolute position. Selection and other React Flow state on the nodes is kept, and so
 * is each group's `loaded` frame, so its saved x/y keep moving with the frame.
 */
export function fitGroups(nodes) {
  const { nodes: fitted } = fromG6(toG6({ nodes }));
  const previous = new Map(nodes.map((node) => [node.id, node]));
  return fitted.map((node) => ({
    ...previous.get(node.id),
    position: node.position,
    width: node.width,
    height: node.height,
  }));
}

// Absolute boxes {x, y, width, height} of React Flow nodes, by id.
export function absoluteBoxes(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const boxes = new Map();
  nodes.forEach((node) => {
    let { x, y } = node.position;
    const seen = new Set([node.id]);
    for (let p = byId.get(node.parentId); p && !seen.has(p.id); p = byId.get(p.parentId)) {
      seen.add(p.id);
      x += p.position.x;
      y += p.position.y;
    }
    boxes.set(node.id, {
      x,
      y,
      width: node.width ?? node.measured?.width ?? 0,
      height: node.height ?? node.measured?.height ?? 0,
    });
  });
  return boxes;
}
