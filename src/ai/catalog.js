import nodes from '../components/FlowItemPanel/nodesData';

// The AI never sees or supplies image URLs. It names a template by a stable id
// (a slug of the file name), and this module maps ids to the bundled asset URL.
const files = import.meta.glob('../assets/images/*/*.svg', { eager: true, import: 'default' });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const labelByUrl = Object.fromEntries(nodes.map((n) => [n.img, n.label]));

const entries = Object.entries(files).map(([path, url]) => {
  const [category, file] = path.split('/').slice(-2);
  const name = file.replace(/\.svg$/, '');
  return { category, name, url, label: labelByUrl[url] ?? name };
});

// A few file names (Error, Steps) exist in two folders; prefix those with the folder.
const counts = {};
entries.forEach((e) => (counts[slug(e.name)] = (counts[slug(e.name)] || 0) + 1));
entries.forEach((e) => {
  e.id = counts[slug(e.name)] > 1 ? `${slug(e.category)}-${slug(e.name)}` : slug(e.name);
});
entries.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id, 'en', { numeric: true }));

export const templates = entries;

const byId = new Map(entries.map((e) => [e.id, e]));
const byUrl = new Map(entries.map((e) => [e.url, e]));

export const templateUrl = (id) => byId.get(id)?.url;

// Reverse map a node's `img` to a template id. Also understands diagrams saved by the
// old CRA build (/static/media/<file>.<hash>.svg), where the folder is unknown.
export function templateIdForImg(img) {
  if (!img) return null;
  if (byUrl.has(img)) return byUrl.get(img).id;
  const legacy = /\/static\/media\/(.+)\.[0-9a-f]{8}\.svg$/.exec(decodeURIComponent(img));
  if (legacy) return entries.find((e) => e.name === legacy[1])?.id ?? null;
  return null;
}

// One line per template: `id | category | label`.
export const catalogText = () => entries.map((e) => `${e.id} | ${e.category} | ${e.label}`).join('\n');
