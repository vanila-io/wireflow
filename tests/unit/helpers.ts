import type { CardNode, DiagramEdge, GroupNode } from '@/lib/diagram/model';

// localStorage stand-in; `quota` (characters) makes setItem throw like a full browser storage.
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  constructor(public quota = Infinity) {}
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    const used = [...this.map].reduce((n, [k, v]) => n + (k === key ? 0 : v.length), 0);
    if (used + value.length > this.quota) throw new DOMException('quota', 'QuotaExceededError');
    this.map.set(key, String(value));
  }
}

export const card = (id: string, x = 0, y = 0, extra: Partial<CardNode> = {}): CardNode => ({
  id,
  type: 'flow',
  position: { x, y },
  data: { graphicId: 'article-article-1', src: '/graphics/article/article-1.svg', label: 'Article', headerText: 'Article', showHeader: true },
  ...extra,
});

export const group = (id: string, x = 0, y = 0, extra: Partial<GroupNode> = {}): GroupNode => ({
  id,
  type: 'group',
  position: { x, y },
  data: { label: 'Group' },
  ...extra,
});

export const edge = (id: string, source: string, target: string, extra: Partial<DiagramEdge> = {}): DiagramEdge => ({
  id,
  source,
  target,
  markerEnd: { type: 'arrowclosed' },
  ...extra,
});

// Production's own example of a saved diagram (issue #112).
export const PRODUCTION_SAMPLE = {
  nodes: [
    {
      id: 'article-article-1-1791567208054-ppqgj',
      type: 'flow',
      position: { x: 180, y: 50 },
      data: { graphicId: 'article-article-1', src: '/graphics/article/article-1.svg', label: 'Article', headerText: 'Article', showHeader: true },
      measured: { width: 220, height: 198 },
    },
    {
      id: 'e-commerce-cart-popup-1791567209999-abcde',
      type: 'flow',
      position: { x: 480, y: 300 },
      data: { graphicId: 'e-commerce-cart-popup', src: '/graphics/e-commerce/cart-popup.svg', label: 'Cart pop up', headerText: 'My cart', showHeader: false },
      measured: { width: 220, height: 174 },
      selected: true,
    },
  ],
  edges: [
    {
      markerEnd: { type: 'arrowclosed' },
      source: 'article-article-1-1791567208054-ppqgj',
      target: 'e-commerce-cart-popup-1791567209999-abcde',
      id: 'xy-edge__article-article-1-1791567208054-ppqgj-e-commerce-cart-popup-1791567209999-abcde',
    },
  ],
};
