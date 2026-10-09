import { describe, expect, it } from 'vitest';
import { buildCatalog, templates, templateUrl, templateIdForImg, catalogText } from '../../ai/catalog';
import { planOps, snapshot } from '../../ai/diagram';

const url = (id) => templateUrl(id);
const diagram = {
  nodes: [
    { id: 'a', type: 'node', img: url('cart'), label: 'Cart', x: 100, y: 100, shape: 'node-image-header' },
    { id: 'b', type: 'node', img: url('checkout'), label: 'Checkout', x: 300, y: 100, shape: 'node-image-without-header', parent: 'g' },
    { id: 'c', type: 'node', img: url('complete'), label: 'Done', x: 500, y: 100, shape: 'node-image-header', parent: 'g' },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b' }],
  groups: [{ id: 'g', label: 'Pay' }],
};

describe('catalog', () => {
  it('has a unique id and a bundled url for every template', () => {
    expect(templates).toHaveLength(102);
    expect(new Set(templates.map((t) => t.id)).size).toBe(102);
    templates.forEach((t) => expect(templateIdForImg(t.url)).toBe(t.id));
    expect(catalogText().split('\n')).toHaveLength(102);
  });

  it('does not map unknown urls to a template', () => {
    expect(templateIdForImg('https://evil.example/x.svg')).toBeNull();
  });

  // A production build emits identical files once ("Sign in 1" and "Sign Up 1" share a URL).
  it('lists a shared image once, under its first file and first sidebar label', () => {
    const files = {
      '../assets/images/Sign in/Sign Up 1.svg': '/assets/shared.svg',
      '../assets/images/Sign in/Sign in 1.svg': '/assets/shared.svg',
      '../assets/images/E-Commerce/Cart.svg': '/assets/cart.svg',
    };
    const sidebar = [
      { img: '/assets/shared.svg', label: 'Sign In' },
      { img: '/assets/shared.svg', label: 'Sign Up' },
      { img: '/assets/cart.svg', label: 'Cart' },
    ];
    expect(buildCatalog(files, sidebar).map(({ id, category, label, url }) => ({ id, category, label, url }))).toEqual([
      { id: 'cart', category: 'E-Commerce', label: 'Cart', url: '/assets/cart.svg' },
      { id: 'sign-in-1', category: 'Sign in', label: 'Sign In', url: '/assets/shared.svg' },
    ]);
  });
});

describe('snapshot', () => {
  it('is compact and uses template ids', () => {
    const view = { x: 0, y: 0, width: 900, height: 800 };
    const s = snapshot({ data: diagram, selected: ['a'], view });
    expect(s.selected).toEqual(['a']);
    expect(s.view).toEqual(view);
    expect(s.screens[1]).toEqual({ id: 'b', template: 'checkout', label: 'Checkout', x: 300, y: 100, header: false, group: 'g' });
    expect(s.connections).toEqual([{ id: 'e1', from: 'a', to: 'b', label: '' }]);
  });
});

describe('planOps', () => {
  const ok = (ops, data = diagram) => {
    const r = planOps({ summary: 's', operations: ops }, data);
    expect(r.errors).toBeUndefined();
    return r;
  };
  const bad = (ops, data = diagram) => {
    const r = planOps({ summary: 's', operations: ops }, data);
    expect(r.errors?.length).toBeGreaterThan(0);
    return r.errors;
  };

  it('builds full gg-editor models for new screens and connections', () => {
    const { actions } = ok([
      { op: 'add_screen', id: 'login', template: 'sign-in-1', label: 'Login', x: 100, y: 300 },
      { op: 'connect', id: 'to_cart', from: 'login', to: 'a', label: 'Sign in' },
    ]);
    expect(actions[0].model).toMatchObject({ id: 'login', type: 'node', shape: 'node-image-header', size: [96, 88], img: url('sign-in-1') });
    // a is straight above login: leave from the top, enter at the bottom.
    expect(actions[1].model).toMatchObject({ source: 'login', target: 'a', sourceAnchor: 0, targetAnchor: 2, shape: 'flow-polyline-round', label: 'Sign in' });
  });

  it('auto-places screens without coordinates to the right of the diagram', () => {
    const { placed } = ok([
      { op: 'add_screen', id: 'p', template: 'cart', label: 'P' },
      { op: 'add_screen', id: 'q', template: 'cart', label: 'Q', x: null, y: null },
    ]);
    expect(placed).toEqual({ p: [680, 100], q: [860, 100] });
  });

  it('rejects the whole batch on any error', () => {
    const errors = bad([
      { op: 'add_screen', id: 'ok1', template: 'cart', label: 'x', x: 0, y: 0 },
      { op: 'connect', id: 'e2', from: 'ok1', to: 'nope' },
    ]);
    expect(errors).toEqual([{ index: 1, op: 'connect', message: 'no screen "nope"' }]);
  });

  it('rejects bad ids, templates, urls, fields and values', () => {
    bad([{ op: 'add_screen', id: 'a', template: 'cart', label: 'dup' }]);
    bad([{ op: 'add_screen', id: '1x', template: 'cart', label: 'x' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'https://evil/x.svg', label: 'x' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'cart', label: 'x', img: 'https://evil/x.svg' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'cart', label: 'x', x: Infinity }]);
    bad([{ op: 'update_connection', id: 'e1', color: 'red' }]);
    bad([{ op: 'update_connection', id: 'e1', width: 11 }]);
    bad([{ op: 'connect', id: 'self', from: 'a', to: 'a' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'cart', label: 'x' }, { op: 'clear' }]);
    bad([{ op: 'frobnicate' }]);
    bad([]);
  });

  it('tracks removals within a batch', () => {
    bad([{ op: 'remove', ids: ['a'] }, { op: 'connect', id: 'e9', from: 'a', to: 'b' }]);
    // removing a screen removes its connections
    bad([{ op: 'remove', ids: ['a'] }, { op: 'update_connection', id: 'e1', label: 'x' }]);
    // removing a group removes its screens
    bad([{ op: 'remove', ids: ['g'] }, { op: 'update_screen', id: 'b', label: 'x' }]);
    ok([{ op: 'ungroup', id: 'g' }, { op: 'update_screen', id: 'b', label: 'x' }, { op: 'group', id: 'g2', label: 'All', members: ['a', 'b', 'c'] }]);
  });

  it('only groups members that share a parent', () => {
    bad([{ op: 'group', id: 'g2', label: 'x', members: ['a', 'b'] }]);
    ok([{ op: 'group', id: 'g2', label: 'x', members: ['b', 'c'] }]);
  });

  it('clear then rebuild', () => {
    const { actions } = ok([{ op: 'clear' }, { op: 'add_screen', id: 'a', template: 'cart', label: 'A', x: 0, y: 0 }]);
    expect(actions.map((a) => a.kind)).toEqual(['clear', 'add']);
  });

  it('cleans labels', () => {
    const { actions } = ok([{ op: 'update_screen', id: 'a', label: `  hi\u0000there${'x'.repeat(200)}` }]);
    expect(actions[0].model.label).toMatch(/^hi there/);
    expect(actions[0].model.label.length).toBe(80);
  });
});
