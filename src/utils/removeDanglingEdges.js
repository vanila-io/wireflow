// Before `noEndEdge` was turned off, an edge dropped on empty canvas was saved
// with a canvas point (`{x, y}`) as its source or target instead of an item id.
// Keep only edges whose both ends are the id of a node or group in `data`.
export function removeDanglingEdges(data) {
  if (!Array.isArray(data?.edges)) return data;

  const ids = new Set([...(data.nodes ?? []), ...(data.groups ?? [])].map((item) => item.id));
  const edges = data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));

  return edges.length === data.edges.length ? data : { ...data, edges };
}
