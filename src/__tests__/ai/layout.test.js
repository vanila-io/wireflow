import { describe, expect, it } from 'vitest';
import { layoutIssues } from '../../ai/layout';
import { planOps } from '../../ai/diagram';
import { templateUrl } from '../../ai/catalog';

const S = [96, 88];
const screens = (list) => new Map(list.map(([id, x, y, parent = null]) => [id, { x, y, size: S, parent }]));
const groups = (list) => new Map(list.map(([id, parent = null]) => [id, { parent }]));

describe('layoutIssues', () => {
  it('finds a screen inside the box of a group it is not in', () => {
    // A flow wrapped onto a second row: the "pay" box spans x 602-898, y 96-454 and covers "signin".
    const issues = layoutIssues(
      screens([
        ['signin', 660, 180],
        ['checkout', 840, 180, 'pay'],
        ['payment', 840, 400, 'pay'],
        ['done', 660, 400, 'pay'],
      ]),
      groups([['pay']]),
    );
    expect([...issues.values()]).toEqual(['screen "signin" is not in group "pay" but lies inside its box (x 602 to 898, y 96 to 454)']);
  });

  it('finds overlapping screens', () => {
    const issues = layoutIssues(screens([['a', 100, 100], ['b', 150, 120], ['c', 300, 100]]), groups([]));
    expect([...issues.values()]).toEqual(['screens "a" and "b" overlap']);
  });

  it('accepts screens that only touch', () => {
    expect(layoutIssues(screens([['a', 100, 100], ['b', 196, 100]]), groups([])).size).toBe(0);
  });

  it('accounts for the title band above a group and its minimum width', () => {
    // One 96 px wide member: the box is widened to 164 + 2 x 10 px and starts 40 px above it.
    const members = [['m', 300, 300, 'g']];
    expect(layoutIssues(screens([...members, ['above', 300, 210]]), groups([['g']])).size).toBe(1);
    expect(layoutIssues(screens([...members, ['beside', 200, 300]]), groups([['g']])).size).toBe(1);
    expect(layoutIssues(screens([...members, ['clear', 300, 160]]), groups([['g']])).size).toBe(0);
  });

  it('does not flag members of nested groups, but flags overlapping sibling groups', () => {
    const nested = layoutIssues(
      screens([['a', 100, 100, 'inner'], ['b', 300, 100, 'inner'], ['c', 500, 100, 'outer']]),
      groups([['inner', 'outer'], ['outer']]),
    );
    expect(nested.size).toBe(0);
    const siblings = layoutIssues(
      screens([['a', 100, 100, 'g1'], ['b', 300, 100, 'g1'], ['c', 250, 230, 'g2'], ['d', 450, 230, 'g2']]),
      groups([['g1'], ['g2']]),
    );
    expect([...siblings.values()]).toEqual(['groups "g1" and "g2" overlap']);
  });
});

describe('planOps layout warnings', () => {
  const add = (id, x, y) => ({ op: 'add_screen', id, template: 'cart', label: id, x, y });
  const plan = (operations, data = {}) => planOps({ summary: 's', operations }, data);

  it('warns when a new group covers a screen that is not in it, and still applies the batch', () => {
    const r = plan([
      add('signin', 660, 180),
      add('checkout', 840, 180),
      add('payment', 840, 400),
      add('done', 660, 400),
      { op: 'group', id: 'pay', label: 'Payment', members: ['checkout', 'payment', 'done'] },
    ]);
    expect(r.errors).toBeUndefined();
    expect(r.actions).toHaveLength(5);
    expect(r.warnings).toEqual([expect.stringMatching(/^screen "signin" is not in group "pay"/)]);
  });

  it('reports only problems the batch creates', () => {
    const node = (id, x, y) => ({ id, type: 'node', img: templateUrl('cart'), label: id, x, y, shape: 'node-image-header', size: [96, 88] });
    const data = { nodes: [node('a', 100, 100), node('b', 120, 100)] }; // the user's own overlap
    expect(plan([add('c', 400, 100)], data).warnings).toEqual([]);
    expect(plan([add('d', 130, 110)], data).warnings).toEqual(['screens "a" and "d" overlap', 'screens "b" and "d" overlap']);
  });

  it('has no warnings once a follow-up moves the screen out of the box', () => {
    const node = (id, x, y, parent) => ({ id, type: 'node', img: templateUrl('cart'), label: id, x, y, shape: 'node-image-header', ...(parent ? { parent } : {}) });
    const data = {
      nodes: [node('signin', 660, 180), node('checkout', 840, 180, 'pay'), node('payment', 840, 400, 'pay'), node('done', 660, 400, 'pay')],
      groups: [{ id: 'pay', label: 'Payment' }],
    };
    expect(plan([{ op: 'update_screen', id: 'signin', x: 480 }], data).warnings).toEqual([]);
  });

  it('caps the list', () => {
    const r = plan(Array.from({ length: 13 }, (_, i) => add(`s${i}`, 100 + i, 100)));
    expect(r.warnings).toHaveLength(11);
    expect(r.warnings.at(-1)).toMatch(/^and \d+ more$/);
  });
});

describe('planOps connection anchors', () => {
  const node = (id, x, y) => ({ id, type: 'node', img: templateUrl('cart'), label: id, x, y, shape: 'node-image-header' });
  const data = { nodes: [node('a', 100, 100), node('b', 300, 100)], edges: [{ id: 'e1', source: 'a', target: 'b', sourceAnchor: 1, targetAnchor: 3 }] };

  it('re-aims the connections of a screen that moved', () => {
    const { actions } = planOps({ summary: 's', operations: [{ op: 'update_screen', id: 'b', x: 100, y: 300 }] }, data);
    expect(actions).toEqual([
      { kind: 'update', id: 'b', model: { x: 100, y: 300 } },
      { kind: 'update', id: 'e1', model: { sourceAnchor: 2, targetAnchor: 0 } },
    ]);
  });

  it('aims a new connection at where its screens end up in the batch', () => {
    const { actions } = planOps(
      {
        summary: 's',
        operations: [
          { op: 'add_screen', id: 'c', template: 'cart', label: 'c', x: 500, y: 100 },
          { op: 'connect', id: 'e2', from: 'a', to: 'c' },
          { op: 'update_screen', id: 'c', x: 100, y: 400 },
        ],
      },
      data,
    );
    expect(actions.find((a) => a.model?.id === 'e2').model).toMatchObject({ sourceAnchor: 2, targetAnchor: 0 });
    expect(actions.filter((a) => a.id === 'e1')).toEqual([]); // a and b did not move
  });
});
