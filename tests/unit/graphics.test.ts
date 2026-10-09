import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import graphics from '@/data/graphics.json';
import { categoryLabels, graphicById, graphicsByCategory } from '@/lib/graphics';

describe('template catalog', () => {
  it('has the 102 production graphics in 10 categories, each with a unique id', () => {
    expect(graphics).toHaveLength(102);
    expect(new Set(graphics.map((g) => g.id)).size).toBe(102);
    expect(categoryLabels.map((c) => c.label)).toEqual([
      'Article',
      'Blog',
      'E-Commerce',
      'Features',
      'Gallery',
      'Header',
      'Misc',
      'Multimedia',
      'Sign in',
      'Socials',
    ]);
  });

  it('serves every graphic from public/ as an SVG at /graphics/<category>/<slug>.svg', () => {
    for (const g of graphics) {
      expect(g.src).toMatch(new RegExp(`^/graphics/${g.category}/[a-z0-9-]+\\.svg$`));
      const file = new URL(`../../public${g.src}`, import.meta.url);
      expect(existsSync(file), g.src).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain('<svg');
    }
  });

  it('has an up-to-date size for every graphic (run node tools/graphic-sizes.mjs)', async () => {
    const { graphicRatios } = await import('@/tools/graphic-sizes.mjs');
    const sizes = (await import('@/data/graphic-sizes.json')).default;
    expect(sizes).toEqual(graphicRatios());
  });

  it('finds graphics by id and by category', () => {
    expect(graphicById('article-article-1')?.label).toBe('Article');
    expect(graphicById('nope')).toBeUndefined();
    expect(graphicsByCategory('all')).toHaveLength(102);
    expect(graphicsByCategory('blog').every((g) => g.category === 'blog')).toBe(true);
  });
});
