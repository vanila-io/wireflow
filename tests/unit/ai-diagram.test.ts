// Ported from #105 (diagram.test.js, layout.test.js), against Wireflow's
// React Flow diagram, plus tests of the new apply layer.
import { describe, expect, it } from 'vitest';
import { applyActions, planOps, snapshot, type Action } from '@/lib/ai/diagram';
import { catalogText, templateExists } from '@/lib/ai/catalog';
import { layoutIssues, type Screen } from '@/lib/ai/layout';
import { runRequest } from '@/lib/ai/agent';
import { absoluteBoxes, GROUP_PADDING } from '@/lib/diagram/groups';
import { cardSize, isCard, isGroup, type Diagram } from '@/lib/diagram/model';
import { groupItems } from '@/lib/diagram/ops';
import { enforceRules } from '@/lib/diagram/rules';
import { createDiagramStore } from '@/lib/diagram/store';
import { stepState } from '@/lib/diagram/history';
import type { Chat, Turn } from '@/lib/ai/providers/types';
import { card, edge } from './helpers';

const H = cardSize({ graphicId: 'e-commerce-cart' }).height;
const at = (id: string, graphicId: string, cx: number, cy: number) => {
  const { width, height } = cardSize({ graphicId });
  return { ...card(id, cx - width / 2, cy - height / 2), data: { graphicId, src: '', label: graphicId, headerText: graphicId, showHeader: true } };
};
// a above-left; b and c in group g.
const base = (): Diagram =>
  groupItems(
    { nodes: [at('a', 'e-commerce-cart', 200, 200), at('b', 'e-commerce-checkout', 600, 200), at('c', 'misc-404', 900, 200)], edges: [edge('e1', 'a', 'b')] },
    ['b', 'c'],
    { id: 'g', label: 'Pay' },
  );

const ok = (ops: unknown[], data = base()) => {
  const r = planOps({ summary: 's', operations: ops }, data);
  expect(r.errors).toBeUndefined();
  if (r.errors) throw new Error('planned with errors');
  return r;
};
const bad = (ops: unknown[], data = base()) => {
  const r = planOps({ summary: 's', operations: ops }, data);
  expect(r.errors?.length).toBeGreaterThan(0);
  return r.errors!;
};

describe('catalog', () => {
  it('lists the 102 production templates by their stable ids', () => {
    expect(catalogText().split('\n')).toHaveLength(102);
    expect(catalogText()).toContain('e-commerce-cart | E-Commerce | Cart');
    expect(templateExists('e-commerce-cart')).toBe(true);
    expect(templateExists('https://evil.example/x.svg')).toBe(false);
  });
});

describe('snapshot', () => {
  it('is compact, uses template ids and canvas centres', () => {
    const view = { x: 0, y: 0, width: 900, height: 800 };
    const s = snapshot({ data: base(), selected: ['a'], view });
    expect(s.selected).toEqual(['a']);
    expect(s.view).toEqual(view);
    expect(s.screens.find((x) => x.id === 'b')).toEqual({ id: 'b', template: 'e-commerce-checkout', label: 'e-commerce-checkout', x: 600, y: 200, header: true, group: 'g' });
    expect(s.connections).toEqual([{ id: 'e1', from: 'a', to: 'b', label: '' }]);
    expect(s.groups).toEqual([{ id: 'g', label: 'Pay', parent: null }]);
  });
});

describe('planOps', () => {
  it('validates new screens and connections and plans them', () => {
    const { actions } = ok([
      { op: 'add_screen', id: 'login', template: 'sign-in-sign-in-1', label: 'Login', x: 200, y: 600 },
      { op: 'connect', id: 'to_cart', from: 'login', to: 'a', label: 'Sign in' },
    ]);
    expect(actions).toEqual([
      { kind: 'add_screen', id: 'login', template: 'sign-in-sign-in-1', label: 'Login', x: 200, y: 600, header: true },
      { kind: 'connect', id: 'to_cart', from: 'login', to: 'a', label: 'Sign in' },
    ]);
  });

  it('auto-places screens without coordinates to the right of the diagram', () => {
    const { placed } = ok([
      { op: 'add_screen', id: 'p', template: 'e-commerce-cart', label: 'P' },
      { op: 'add_screen', id: 'q', template: 'e-commerce-cart', label: 'Q', x: null, y: null },
    ]);
    expect(placed).toEqual({ p: [1200, 200], q: [1500, 200] });
  });

  it('rejects the whole batch on any error', () => {
    expect(bad([{ op: 'add_screen', id: 'ok1', template: 'e-commerce-cart', label: 'x', x: 0, y: 0 }, { op: 'connect', id: 'e2', from: 'ok1', to: 'nope' }])).toEqual([
      { index: 1, op: 'connect', message: 'no screen "nope"' },
    ]);
  });

  it('rejects bad ids, templates, urls, fields and values', () => {
    bad([{ op: 'add_screen', id: 'a', template: 'e-commerce-cart', label: 'dup' }]);
    bad([{ op: 'add_screen', id: '1x', template: 'e-commerce-cart', label: 'x' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'https://evil/x.svg', label: 'x' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'e-commerce-cart', label: 'x', img: 'https://evil/x.svg' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'e-commerce-cart', label: 'x', x: Infinity }]);
    bad([{ op: 'add_screen', id: '__proto__', template: 'e-commerce-cart', label: 'x' }]);
    bad([{ op: 'update_connection', id: 'e1', color: 'red' }]);
    bad([{ op: 'update_connection', id: 'e1', width: 3 }]);
    bad([{ op: 'connect', id: 'self', from: 'a', to: 'a' }]);
    bad([{ op: 'add_screen', id: 'x', template: 'e-commerce-cart', label: 'x' }, { op: 'clear' }]);
    bad([{ op: 'frobnicate' }]);
    bad([null]);
    bad([]);
    expect(planOps(null, base()).errors).toBeDefined();
  });

  it('tracks removals within a batch', () => {
    bad([{ op: 'remove', ids: ['a'] }, { op: 'connect', id: 'e9', from: 'a', to: 'b' }]);
    bad([{ op: 'remove', ids: ['a'] }, { op: 'update_connection', id: 'e1', label: 'x' }]);
    bad([{ op: 'remove', ids: ['g'] }, { op: 'update_screen', id: 'b', label: 'x' }]);
    ok([{ op: 'ungroup', id: 'g' }, { op: 'update_screen', id: 'b', label: 'x' }, { op: 'group', id: 'g2', label: 'All', members: ['a', 'b', 'c'] }]);
  });

  // Review finding: these batches were refused as a whole.
  it('accepts removing ids that an earlier id of the same batch already removed', () => {
    const plan = ok([{ op: 'remove', ids: ['a', 'e1'] }, { op: 'remove', ids: ['g', 'b', 'c'] }]);
    expect(applyActions(base(), plan.actions)).toEqual({ nodes: [], edges: [] });
    bad([{ op: 'remove', ids: ['a', 'never-existed'] }]);
  });

  it('only groups members that share a parent', () => {
    bad([{ op: 'group', id: 'g2', label: 'x', members: ['a', 'b'] }]);
    ok([{ op: 'group', id: 'g2', label: 'x', members: ['b', 'c'] }]);
  });

  it('cleans labels', () => {
    const { actions } = ok([{ op: 'update_screen', id: 'a', label: `  hi\u0000there${'x'.repeat(200)}` }]);
    const label = (actions[0] as Extract<Action, { kind: 'update_screen' }>).label!;
    expect(label).toMatch(/^hi there/);
    expect(label.length).toBe(80);
  });
});

describe('layout warnings (#105: a group frame hid a screen)', () => {
  const s = (x: number, y: number, parent: string | null = null): Screen => ({ x, y, size: [220, H], parent });

  it('finds overlapping screens, screens inside a frame they are not in, and overlapping groups', () => {
    expect([...layoutIssues(new Map([['a', s(0, 0)], ['b', s(100, 0)]]), new Map()).keys()]).toEqual(['screens:a|b']);
    expect(layoutIssues(new Map([['a', s(0, 0)], ['b', s(220, 0)]]), new Map()).size).toBe(0); // only touching
    // The frame includes the title band above the members.
    const inside = layoutIssues(new Map([['m1', s(0, 0, 'g')], ['m2', s(300, 0, 'g')], ['x', s(150, -H / 2 - GROUP_PADDING.top + 5)]]), new Map([['g', { parent: null }]]));
    expect([...inside.keys()]).toContain('inside:x|g');
  });

  it('warns when a new group covers a screen that is not in it, and still applies the batch', () => {
    const data: Diagram = { nodes: [at('a', 'e-commerce-cart', 0, 0), at('b', 'e-commerce-cart', 600, 0), at('x', 'e-commerce-cart', 300, 0)], edges: [] };
    const plan = ok([{ op: 'group', id: 'g', label: 'G', members: ['a', 'b'] }], data);
    expect(plan.warnings).toEqual([expect.stringMatching(/^screen "x" is not in group "g" but lies inside its frame/)]);
  });

  it('reports only problems the batch creates', () => {
    const stacked: Diagram = { nodes: [at('a', 'e-commerce-cart', 0, 0), at('b', 'e-commerce-cart', 10, 0)], edges: [] };
    expect(ok([{ op: 'update_screen', id: 'a', label: 'A' }], stacked).warnings).toEqual([]);
    expect(ok([{ op: 'add_screen', id: 'c', template: 'e-commerce-cart', label: 'C', x: 20, y: 0 }], stacked).warnings).toHaveLength(2);
  });

  it('has no warnings once a follow-up moves the screen out of the frame', () => {
    const data: Diagram = { nodes: [at('a', 'e-commerce-cart', 0, 0), at('b', 'e-commerce-cart', 600, 0), at('x', 'e-commerce-cart', 300, 0)], edges: [] };
    const grouped = applyActions(data, ok([{ op: 'group', id: 'g', label: 'G', members: ['a', 'b'] }], data).actions);
    expect(ok([{ op: 'update_screen', id: 'x', y: 600 }], grouped).warnings).toEqual([]);
  });
});

describe('applyActions (React Flow)', () => {
  it('builds cards at the planned centres, connections, groups and colours; the result follows every rule', () => {
    const plan = ok([
      { op: 'add_screen', id: 'login', template: 'sign-in-sign-in-1', label: 'Login', x: 200, y: 600 },
      { op: 'add_screen', id: 'home', template: 'header-header-1', label: 'Home', x: 600, y: 600, header: false },
      { op: 'connect', id: 'to_home', from: 'login', to: 'home', label: 'Sign in' },
      { op: 'update_connection', id: 'e1', color: '#E8590C', label: 'Pay' },
      { op: 'group', id: 'auth', label: 'Auth', members: ['login', 'home'] },
      { op: 'update_screen', id: 'a', label: 'Basket', x: 250 },
    ]);
    const d = applyActions(base(), plan.actions);
    expect(enforceRules(d).dropped).toEqual({ nodes: 0, edges: 0, parents: 0 });
    const boxes = absoluteBoxes(d.nodes);
    const centre = (id: string) => ({ x: boxes.get(id)!.x + boxes.get(id)!.width / 2, y: boxes.get(id)!.y + boxes.get(id)!.height / 2 });
    expect(centre('login')).toEqual({ x: 200, y: 600 });
    expect(centre('home').x).toBeCloseTo(600);
    expect(centre('a')).toEqual({ x: 250, y: 200 });
    const byId = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
    expect(byId.home.data).toMatchObject({ graphicId: 'header-header-1', headerText: 'Home', showHeader: false });
    expect(byId.a.data).toMatchObject({ headerText: 'Basket' });
    expect(byId.login.parentId).toBe('auth');
    expect(isGroup(byId.auth)).toBe(true);
    expect(d.edges.find((e) => e.id === 'to_home')).toMatchObject({ source: 'login', target: 'home', label: 'Sign in', markerEnd: { type: 'arrowclosed' } });
    expect(d.edges.find((e) => e.id === 'e1')).toMatchObject({ label: 'Pay', style: { stroke: '#e8590c' } });
  });

  it('a template change keeps the centre and takes the catalog image', () => {
    const d = applyActions(base(), ok([{ op: 'update_screen', id: 'a', template: 'misc-404' }]).actions);
    const a = d.nodes.find((n) => n.id === 'a')!;
    expect(isCard(a) && a.data).toMatchObject({ graphicId: 'misc-404', src: '/graphics/misc/404.svg' });
    const b = absoluteBoxes(d.nodes).get('a')!;
    expect(b.x + b.width / 2).toBeCloseTo(200);
    expect(b.y + b.height / 2).toBeCloseTo(200);
  });

  it('clear then rebuild, and removing a group removes its screens', () => {
    expect(applyActions(base(), ok([{ op: 'clear' }, { op: 'add_screen', id: 'n', template: 'misc-404', label: 'N', x: 0, y: 0 }]).actions).nodes.map((n) => n.id)).toEqual(['n']);
    const d = applyActions(base(), ok([{ op: 'remove', ids: ['g'] }]).actions);
    expect(d.nodes.map((n) => n.id)).toEqual(['a']);
    expect(d.edges).toEqual([]);
  });
});

describe('the agent loop with the store', () => {
  // A chat that answers with scripted turns.
  const scripted = (turns: Array<Partial<Turn>>): Chat => {
    let i = 0;
    return {
      async send() {
        const t = turns[i++];
        return { status: 'done', text: '', toolCalls: [], refusal: null, model: 'm', usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, usd: 0.001 }, ...t };
      },
    };
  };

  it('applies each tool call as one undo step, reports errors back, and tracks the step', async () => {
    const saves: string[] = [];
    const store = createDiagramStore({ initial: base(), save: (j) => (saves.push(j), true) });
    const steps: number[] = [];
    const chat = scripted([
      { status: 'tool_use', toolCalls: [{ id: 't1', name: 'edit_diagram', input: { summary: 'Bad', operations: [{ op: 'connect', id: 'x', from: 'a', to: 'nope' }] } }] },
      {
        status: 'tool_use',
        toolCalls: [{ id: 't2', name: 'edit_diagram', input: { summary: 'Add login', operations: [{ op: 'add_screen', id: 'login', template: 'sign-in-sign-in-1', label: 'Login', x: 200, y: 700 }, { op: 'connect', id: 'c1', from: 'login', to: 'a' }] } }],
      },
      { status: 'done', text: 'Added a login screen.' },
    ]);
    const events: string[] = [];
    const result = await runRequest({
      chat,
      text: 'add login',
      editor: {
        read: () => ({ data: store.diagram(), selected: [] }),
        apply: (actions) => {
          const id = store.apply((d) => applyActions(d, actions), { kind: 'ai' });
          if (id !== null) steps.push(id);
        },
      },
      onEvent: (e) => events.push(e.type),
    });
    expect(result.status).toBe('done');
    expect(result.usage.usd).toBeCloseTo(0.003);
    expect(events.filter((e) => e === 'tool_error')).toHaveLength(1);
    expect(saves).toHaveLength(1);
    expect(stepState(store.history(), steps[0])).toBe('latest');
    store.undo();
    expect(stepState(store.history(), steps[0])).toBe('undone');
    expect(store.diagram().nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'g']);
    store.redo();
    expect(store.diagram().nodes.map((n) => n.id)).toContain('login');
    // Opening a file over it: replaced, not undone.
    store.replace({ nodes: [card('z')], edges: [] });
    expect(stepState(store.history(), steps[0])).toBe('replaced');
    store.undo();
    expect(stepState(store.history(), steps[0])).toBe('latest');
  });
});
