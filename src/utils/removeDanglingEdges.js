// Keeps only edges whose source and target are both ids of nodes or groups in
// `data`, and returns `data` itself if that's all of them. Other edges have a
// canvas point (`{x, y}`) as an end, from a drop on empty canvas before
// `noEndEdge` was turned off, or the id of a missing item, e.g. from pasting a
// copied edge after deleting one of its nodes. G6 draws the first as a loose
// arrow and can't draw the second at all.
export function removeDanglingEdges(data) {
  if (!Array.isArray(data?.edges)) return data;

  const ids = new Set([...(data.nodes ?? []), ...(data.groups ?? [])].map((item) => item.id));
  const edges = data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));

  return edges.length === data.edges.length ? data : { ...data, edges };
}
