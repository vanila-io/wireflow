import { removeDanglingEdges } from './removeDanglingEdges';

// Every write of the diagram goes through here, so whichever path produced it,
// an edge that doesn't connect two items is never stored.
export function saveData(data) {
  localStorage.setItem('data', JSON.stringify(removeDanglingEdges(data)));
}
