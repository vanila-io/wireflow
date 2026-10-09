import { templateIdForImg, templateUrl } from './catalog';
import { normalize } from '../utils/saveData';

// The diagram layer the AI talks to. Pure functions over gg-editor's saved data
// ({nodes, edges, groups}) plus one apply step that runs inside a single gg-editor
// command, so each AI edit is exactly one undo step.

const NODE_SIZE = { header: [96, 88], plain: [96, 78] };
const GAP_X = 180;
const MAX_LABEL = 80;
const MAX_NODES = 300;
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LINES = ['smooth', 'polyline', 'polyline-round'];

export { normalize };

const round = (n) => Math.round(n);

// Compact view of the diagram sent to the model with every user message.
export function snapshot(data, selected = []) {
  const { nodes, edges, groups } = normalize(data);
  return {
    selected,
    screens: nodes.map((n) => ({
      id: n.id,
      template: templateIdForImg(n.img),
      label: (n.label ?? '').slice(0, MAX_LABEL),
      x: round(n.x),
      y: round(n.y),
      header: n.shape !== 'node-image-without-header',
      group: n.parent ?? null,
    })),
    connections: edges.map((e) => ({ id: e.id, from: e.source, to: e.target, label: e.label ?? '' })),
    groups: groups.map((g) => ({ id: g.id, label: g.label ?? '', parent: g.parent ?? null })),
  };
}

// --- Tool definition (provider-neutral JSON Schema) ---------------------------

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const op = (name, description, properties, required) => ({
  type: 'object',
  description,
  properties: { op: { type: 'string', const: name }, ...properties },
  required: ['op', ...required],
  additionalProperties: false,
});

export const EDIT_DIAGRAM_TOOL = {
  name: 'edit_diagram',
  description:
    'Apply a batch of changes to the wireflow diagram. The batch is validated as a whole against the ' +
    'current diagram and applied atomically as one undo step; if any operation is invalid nothing is ' +
    'applied and the errors are returned. Operations run in order, so later operations may reference ' +
    'ids created earlier in the same batch. Removing a screen also removes its connections; removing a ' +
    'group also removes the screens inside it (use ungroup to keep them).',
  parameters: {
    type: 'object',
    properties: {
      summary: str('One short sentence describing the change, shown to the user.'),
      operations: {
        type: 'array',
        items: {
          anyOf: [
            op('clear', 'Remove everything. Only as the first operation, and only when the user asked to start over.', {}, []),
            op(
              'add_screen',
              'Add a screen (a node showing a template image).',
              {
                id: str('New unique id, e.g. "login" or "cart_2". Letters, digits, _ and -; must start with a letter.'),
                template: str('Template id from the catalog.'),
                label: str('Header text, ideally at most 23 characters.'),
                x: num('Center x in canvas pixels. Omit to auto-place.'),
                y: num('Center y in canvas pixels. Omit to auto-place.'),
                header: { type: 'boolean', description: 'Show the label header. Default true.' },
              },
              ['id', 'template', 'label'],
            ),
            op(
              'update_screen',
              'Change an existing screen. Only the given fields change.',
              {
                id: str('Screen id.'),
                template: str('New template id.'),
                label: str('New label.'),
                x: num('New center x.'),
                y: num('New center y.'),
                header: { type: 'boolean', description: 'Show or hide the label header.' },
              },
              ['id'],
            ),
            op(
              'connect',
              'Draw an arrow from one screen to another.',
              {
                id: str('New unique connection id.'),
                from: str('Source screen id.'),
                to: str('Target screen id.'),
                label: str('Optional arrow label, e.g. the action that triggers it.'),
              },
              ['id', 'from', 'to'],
            ),
            op(
              'update_connection',
              'Change an existing connection. Only the given fields change.',
              {
                id: str('Connection id.'),
                label: str('New label; empty string clears it.'),
                line: { type: 'string', enum: LINES, description: 'Line style.' },
                color: str('Hex color like #a4b2c0.'),
                width: { type: 'integer', description: 'Line width 1-10.' },
              },
              ['id'],
            ),
            op(
              'group',
              'Put two or more screens (or groups) into a new labelled group box.',
              {
                id: str('New unique group id.'),
                label: str('Group label.'),
                members: { type: 'array', items: { type: 'string' }, description: 'Ids of screens or groups to include.' },
              },
              ['id', 'label', 'members'],
            ),
            op('ungroup', 'Dissolve a group, keeping its screens.', { id: str('Group id.') }, ['id']),
            op('remove', 'Delete screens, connections or groups.', { ids: { type: 'array', items: { type: 'string' } } }, ['ids']),
          ],
        },
      },
    },
    required: ['summary', 'operations'],
    additionalProperties: false,
  },
};

// --- Validation + planning ---------------------------------------------------

const cleanLabel = (s) =>
  String(s)
    .replace(/\p{Cc}/gu, ' ')
    .trim()
    .slice(0, MAX_LABEL);

const has = (o, k) => o[k] !== undefined && o[k] !== null;

const ALLOWED = {
  clear: [],
  add_screen: ['id', 'template', 'label', 'x', 'y', 'header'],
  update_screen: ['id', 'template', 'label', 'x', 'y', 'header'],
  connect: ['id', 'from', 'to', 'label'],
  update_connection: ['id', 'label', 'line', 'color', 'width'],
  group: ['id', 'label', 'members'],
  ungroup: ['id'],
  remove: ['ids'],
};

// Anchors on flow nodes: 0 top, 1 right, 2 bottom, 3 left.
function anchors(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [1, 3] : [3, 1];
  return dy >= 0 ? [2, 0] : [0, 2];
}

const nodeShape = (header) => ({
  shape: header ? 'node-image-header' : 'node-image-without-header',
  size: header ? NODE_SIZE.header : NODE_SIZE.plain,
});

/**
 * Validate a tool input against the live diagram and turn it into concrete
 * gg-editor actions. Returns {errors} (non-empty means nothing may be applied)
 * or {actions, placed, summary}.
 */
export function planOps(input, data) {
  const errors = [];
  const fail = (index, opName, message) => errors.push({ index, op: opName, message });

  if (!input || typeof input !== 'object' || !Array.isArray(input.operations)) {
    return { errors: [{ index: -1, op: null, message: 'input must be {summary, operations: [...]}' }] };
  }
  if (input.operations.length === 0) return { errors: [{ index: -1, op: null, message: 'operations is empty' }] };
  if (input.operations.length > 200) return { errors: [{ index: -1, op: null, message: 'at most 200 operations per call' }] };

  // Working copy of the graph so each op sees the effect of the previous ones.
  const { nodes, edges, groups } = normalize(data);
  const N = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, parent: n.parent ?? null }]));
  const E = new Map(edges.map((e) => [e.id, { source: e.source, target: e.target }]));
  const G = new Map(groups.map((g) => [g.id, { parent: g.parent ?? null }]));
  const exists = (id) => N.has(id) || E.has(id) || G.has(id);

  const removeNode = (id) => {
    N.delete(id);
    for (const [eid, e] of E) if (e.source === id || e.target === id) E.delete(eid);
  };
  const removeGroup = (id) => {
    G.delete(id);
    for (const [nid, n] of N) if (n.parent === id) removeNode(nid);
    for (const [gid, g] of G) if (g.parent === id) removeGroup(gid);
  };

  // Auto-placement: a row to the right of everything already on the canvas.
  let cursor = null;
  const autoPlace = () => {
    if (!cursor) {
      const xs = [...N.values()].map((n) => n.x);
      const ys = [...N.values()].map((n) => n.y);
      cursor = xs.length ? { x: Math.max(...xs) + GAP_X, y: Math.min(...ys) } : { x: 150, y: 150 };
    } else cursor = { x: cursor.x + GAP_X, y: cursor.y };
    return cursor;
  };

  const actions = [];
  const placed = {};

  input.operations.forEach((o, i) => {
    const name = o?.op;
    if (!ALLOWED[name]) return fail(i, name ?? null, `unknown op ${JSON.stringify(name)}`);
    const extra = Object.keys(o).filter((k) => k !== 'op' && !ALLOWED[name].includes(k));
    if (extra.length) return fail(i, name, `unknown field(s): ${extra.join(', ')}`);

    const newId = (id) => {
      if (typeof id !== 'string' || !ID_RE.test(id)) return fail(i, name, `invalid id ${JSON.stringify(id)}`), false;
      if (exists(id)) return fail(i, name, `id "${id}" already exists`), false;
      return true;
    };
    const coord = (k) => {
      if (!has(o, k)) return true;
      if (typeof o[k] !== 'number' || !Number.isFinite(o[k]) || Math.abs(o[k]) > 10000) return fail(i, name, `${k} must be a number within ±10000`), false;
      return true;
    };
    const template = () => {
      if (templateUrl(o.template)) return true;
      return fail(i, name, `unknown template "${o.template}"`), false;
    };

    switch (name) {
      case 'clear': {
        if (i !== 0) return fail(i, name, 'clear is only allowed as the first operation');
        N.clear();
        E.clear();
        G.clear();
        actions.push({ kind: 'clear' });
        return;
      }
      case 'add_screen': {
        if (!newId(o.id) || !template() || !coord('x') || !coord('y')) return;
        if (typeof o.label !== 'string') return fail(i, name, 'label must be a string');
        if (has(o, 'header') && typeof o.header !== 'boolean') return fail(i, name, 'header must be a boolean');
        let { x, y } = o;
        if (!has(o, 'x') || !has(o, 'y')) {
          const p = autoPlace();
          x = has(o, 'x') ? x : p.x;
          y = has(o, 'y') ? y : p.y;
          placed[o.id] = [x, y];
        }
        N.set(o.id, { x, y, parent: null });
        actions.push({
          kind: 'add',
          type: 'node',
          model: { id: o.id, type: 'node', ...nodeShape(o.header !== false), img: templateUrl(o.template), label: cleanLabel(o.label), x, y },
        });
        return;
      }
      case 'update_screen': {
        if (!N.has(o.id)) return fail(i, name, `no screen "${o.id}"`);
        if (has(o, 'template') && !template()) return;
        if (!coord('x') || !coord('y')) return;
        if (has(o, 'header') && typeof o.header !== 'boolean') return fail(i, name, 'header must be a boolean');
        if (has(o, 'label') && typeof o.label !== 'string') return fail(i, name, 'label must be a string');
        const model = {};
        if (has(o, 'template')) model.img = templateUrl(o.template);
        if (has(o, 'label')) model.label = cleanLabel(o.label);
        if (has(o, 'x')) model.x = o.x;
        if (has(o, 'y')) model.y = o.y;
        if (has(o, 'header')) Object.assign(model, nodeShape(o.header));
        if (!Object.keys(model).length) return fail(i, name, 'nothing to update');
        Object.assign(N.get(o.id), 'x' in model ? { x: model.x } : {}, 'y' in model ? { y: model.y } : {});
        actions.push({ kind: 'update', id: o.id, model });
        return;
      }
      case 'connect': {
        if (!newId(o.id)) return;
        if (!N.has(o.from)) return fail(i, name, `no screen "${o.from}"`);
        if (!N.has(o.to)) return fail(i, name, `no screen "${o.to}"`);
        if (o.from === o.to) return fail(i, name, 'a screen cannot connect to itself');
        if (has(o, 'label') && typeof o.label !== 'string') return fail(i, name, 'label must be a string');
        const [sourceAnchor, targetAnchor] = anchors(N.get(o.from), N.get(o.to));
        E.set(o.id, { source: o.from, target: o.to });
        actions.push({
          kind: 'add',
          type: 'edge',
          model: {
            id: o.id,
            source: o.from,
            target: o.to,
            sourceAnchor,
            targetAnchor,
            ...(has(o, 'label') && o.label ? { label: cleanLabel(o.label) } : {}),
            shape: 'flow-polyline-round',
            color: '#a4b2c0',
            style: { lineWidth: 2 },
          },
        });
        return;
      }
      case 'update_connection': {
        if (!E.has(o.id)) return fail(i, name, `no connection "${o.id}"`);
        const model = {};
        if (has(o, 'label')) {
          if (typeof o.label !== 'string') return fail(i, name, 'label must be a string');
          model.label = cleanLabel(o.label);
        }
        if (has(o, 'line')) {
          if (!LINES.includes(o.line)) return fail(i, name, `line must be one of ${LINES.join(', ')}`);
          model.shape = `flow-${o.line}`;
        }
        if (has(o, 'color')) {
          if (!COLOR_RE.test(o.color)) return fail(i, name, 'color must look like #a4b2c0');
          model.color = o.color;
        }
        if (has(o, 'width')) {
          if (!Number.isInteger(o.width) || o.width < 1 || o.width > 10) return fail(i, name, 'width must be an integer 1-10');
          model.style = { lineWidth: o.width };
        }
        if (!Object.keys(model).length) return fail(i, name, 'nothing to update');
        actions.push({ kind: 'update', id: o.id, model });
        return;
      }
      case 'group': {
        if (!newId(o.id)) return;
        if (typeof o.label !== 'string') return fail(i, name, 'label must be a string');
        if (!Array.isArray(o.members) || new Set(o.members).size < 2) return fail(i, name, 'a group needs at least 2 distinct members');
        const members = [...new Set(o.members)];
        const missing = members.filter((m) => !N.has(m) && !G.has(m));
        if (missing.length) return fail(i, name, `unknown member(s): ${missing.join(', ')}`);
        const parents = new Set(members.map((m) => (N.get(m) ?? G.get(m)).parent));
        if (parents.size > 1) return fail(i, name, 'all members must currently be in the same group (or in none)');
        const [parent] = parents;
        G.set(o.id, { parent });
        members.forEach((m) => ((N.get(m) ?? G.get(m)).parent = o.id));
        actions.push({ kind: 'group', id: o.id, label: cleanLabel(o.label), members });
        return;
      }
      case 'ungroup': {
        if (!G.has(o.id)) return fail(i, name, `no group "${o.id}"`);
        const { parent } = G.get(o.id);
        for (const n of [...N.values(), ...G.values()]) if (n.parent === o.id) n.parent = parent;
        G.delete(o.id);
        actions.push({ kind: 'ungroup', id: o.id });
        return;
      }
      case 'remove': {
        if (!Array.isArray(o.ids) || !o.ids.length) return fail(i, name, 'ids must be a non-empty array');
        for (const id of o.ids) {
          if (N.has(id)) removeNode(id);
          else if (E.has(id)) E.delete(id);
          else if (G.has(id)) removeGroup(id);
          else return fail(i, name, `no screen, connection or group "${id}"`);
          actions.push({ kind: 'remove', id });
        }
        return;
      }
    }
  });

  if (!errors.length && N.size > MAX_NODES) errors.push({ index: -1, op: null, message: `diagram would exceed ${MAX_NODES} screens` });
  if (errors.length) return { errors };
  return { actions, placed, summary: typeof input.summary === 'string' ? input.summary : '' };
}

// --- Apply -------------------------------------------------------------------

function run(page, action) {
  const graph = page.getGraph();
  switch (action.kind) {
    case 'clear':
      page.clear();
      break;
    case 'add':
      page.add(action.type, { ...action.model });
      break;
    case 'update':
      page.update(action.id, { ...action.model });
      break;
    case 'remove':
      // A group's children may already be gone with an earlier removal.
      if (graph.find(action.id)) page.remove(action.id);
      break;
    case 'group':
      page.clearSelected();
      action.members.forEach((id) => page.setSelected(id, true));
      page.addGroup({ id: action.id, label: action.label });
      page.clearSelected();
      break;
    case 'ungroup':
      page.clearSelected();
      page.setSelected(action.id, true);
      page.unGroup();
      page.clearSelected();
      break;
  }
}

/**
 * Apply planned actions as ONE gg-editor command (one undo step). Redo re-runs
 * the closure, so it only reads the precomputed `actions`.
 * Returns the saved diagram after the change.
 */
export function applyActions(propsAPI, actions) {
  const before = propsAPI.editor.getCurrentCommand();
  try {
    propsAPI.executeCommand(() => {
      const page = propsAPI.currentPage;
      actions.forEach((a) => run(page, a));
    });
  } catch (err) {
    // The command was queued before it threw; roll back whatever it did.
    if (propsAPI.editor.getCurrentCommand() !== before) propsAPI.executeCommand('undo');
    throw err;
  }
  return normalize(propsAPI.save());
}
