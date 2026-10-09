// The templates the AI may use. It never sees or supplies image URLs: it names a
// template by production's stable graphic id, which the app maps to its image.
import graphics from '@/data/graphics.json';
import { graphicById } from '@/lib/graphics';

export const templateExists = (id: unknown): id is string => typeof id === 'string' && !!graphicById(id);

// One line per template: `id | category | label`.
export const catalogText = () => graphics.map((g) => `${g.id} | ${g.categoryLabel} | ${g.label}`).join('\n');
