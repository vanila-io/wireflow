import { removeDanglingEdges } from './removeDanglingEdges';

// Every write of the diagram goes through here, so whichever path produced it,
// an edge that doesn't connect two items is never stored.
export function saveData(data) {
  localStorage.setItem('data', JSON.stringify(removeDanglingEdges(data)));
}

// gg-editor's save() drops empty arrays; the rest of the app expects all three.
export const normalize = (data) => ({
  nodes: data?.nodes ?? [],
  edges: data?.edges ?? [],
  groups: data?.groups ?? [],
});
