export function dataMapToData(dataMap) {
  const data = { nodes: [], edges: [], groups: [] };
  if (dataMap) {
    Object.keys(dataMap).forEach((id) => {
      const item = dataMap[id];
      if (item.type === 'node') {
        data.nodes.push(item);
      } else if (!!item.source && !!item.target) data.edges.push(item);
      // just assuming that if an item is not node or edge but have x and y, it's a group
      else if (!!item.x && !!item.y) {
        data.groups.push(item);
      }
    });
  }

  return data;
}
