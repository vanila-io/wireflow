// Groups templates into [{ category, items }], keeping categories in the order they
// first appear. With a keyword, keeps only templates whose label or category contains
// it (case-insensitive) and drops categories left empty.
export function groupTemplates(templates, keyword = '') {
  const query = keyword.trim().toLowerCase();
  const groups = new Map();

  for (const template of templates) {
    const { label, category } = template;
    if (!groups.has(category)) groups.set(category, { category, items: [] });

    if (!query || label.toLowerCase().includes(query) || category.toLowerCase().includes(query)) {
      groups.get(category).items.push(template);
    }
  }

  return [...groups.values()].filter((group) => group.items.length > 0);
}
