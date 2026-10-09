import nodes from '../components/FlowItemPanel/nodesData';

// The AI never sees or supplies image URLs. It names a template by a stable id
// (a slug of the file name), and this module maps ids to the bundled asset URL.

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byPath = ([a], [b]) => a.localeCompare(b, 'en', { numeric: true });

/**
 * files: { '.../<category>/<name>.svg': url }, as import.meta.glob returns them.
 * sidebar: [{ img, label }], the sidebar's templates.
 * A production build emits files with identical content once, so they share a URL;
 * such a template is listed once, under its first file and first sidebar label.
 */
export function buildCatalog(files, sidebar) {
  const labelByUrl = new Map();
  sidebar.forEach((t) => labelByUrl.has(t.img) || labelByUrl.set(t.img, t.label));

  const byUrl = new Map();
  for (const [path, url] of Object.entries(files).sort(byPath)) {
    if (byUrl.has(url)) continue;
    const [category, file] = path.split('/').slice(-2);
    const name = file.replace(/\.svg$/, '');
    byUrl.set(url, { category, name, url, label: labelByUrl.get(url) ?? name });
  }
  const entries = [...byUrl.values()];

  // File names are unique today; if one ever appears in two folders, prefix both with the folder.
  const counts = {};
  entries.forEach((e) => (counts[slug(e.name)] = (counts[slug(e.name)] || 0) + 1));
  entries.forEach((e) => {
    e.id = counts[slug(e.name)] > 1 ? `${slug(e.category)}-${slug(e.name)}` : slug(e.name);
  });
  return entries.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id, 'en', { numeric: true }));
}

export const templates = buildCatalog(import.meta.glob('../assets/images/*/*.svg', { eager: true, import: 'default' }), nodes);

const byId = new Map(templates.map((t) => [t.id, t]));
const byUrl = new Map(templates.map((t) => [t.url, t]));

export const templateUrl = (id) => byId.get(id)?.url;

// The template id of a node image, or null. Saved diagrams with older image URLs are
// re-pointed at this build's URLs when the canvas loads them (FlowCanvas).
export const templateIdForImg = (img) => byUrl.get(img)?.id ?? null;

// One line per template: `id | category | label`.
export const catalogText = () => templates.map((t) => `${t.id} | ${t.category} | ${t.label}`).join('\n');
