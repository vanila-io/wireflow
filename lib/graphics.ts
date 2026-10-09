// Reconstructed from production module 85238 (+ JSON module 79927 = data/graphics.json).
import graphics from '@/data/graphics.json';

export type Graphic = { id: string; label: string; category: string; categoryLabel: string; src: string };

const all = graphics as Graphic[];

export const categoryLabels: { slug: string; label: string }[] = [
  ...all.reduce((m, g) => (m.has(g.category) || m.set(g.category, g.categoryLabel), m), new Map<string, string>()).entries(),
].map(([slug, label]) => ({ slug, label }));

export function graphicById(id: string): Graphic | undefined {
  return all.find((g) => g.id === id);
}

export function graphicsByCategory(slug: string): Graphic[] {
  return slug === 'all' ? all : all.filter((g) => g.category === slug);
}

export function graphicBySrc(src: string): Graphic | undefined {
  return all.find((g) => g.src === src);
}
