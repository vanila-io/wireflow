// Writes data/graphic-sizes.json: the height/width ratio of every template
// graphic, from its SVG viewBox. Cards draw the graphic at a fixed width, so
// layout code (groups, the AI layout check, imports) can know a card's height
// without rendering it. Run after changing public/graphics: node tools/graphic-sizes.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const graphics = JSON.parse(readFileSync(new URL('data/graphics.json', root), 'utf8'));

export function ratioOf(svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || !(viewBox[2] > 0 && viewBox[3] > 0)) throw new Error('SVG without a usable viewBox');
  return Math.round((viewBox[3] / viewBox[2]) * 1e4) / 1e4;
}

export function graphicRatios() {
  return Object.fromEntries(graphics.map((g) => [g.id, ratioOf(readFileSync(new URL(`public${g.src}`, root), 'utf8'))]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('data/graphic-sizes.json', root), `${JSON.stringify(graphicRatios(), null, 1)}\n`);
  console.log('wrote data/graphic-sizes.json');
}
