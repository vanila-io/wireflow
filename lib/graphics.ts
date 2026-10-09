import graphicsJson from "./graphics.json";

export type Graphic = {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
  src: string;
};

export const graphics: Graphic[] = graphicsJson as Graphic[];

export const categoryLabels: { slug: string; label: string }[] = [
  ...graphics
    .reduce((map, g) => {
      if (!map.has(g.category)) map.set(g.category, g.categoryLabel);
      return map;
    }, new Map<string, string>())
    .entries(),
].map(([slug, label]) => ({ slug, label }));

export function graphicsByCategory(category: string): Graphic[] {
  if (category === "all") return graphics;
  return graphics.filter((g) => g.category === category);
}

export function graphicById(id: string): Graphic | undefined {
  return graphics.find((g) => g.id === id);
}
