export function saveData(data) {
  localStorage.setItem('data', JSON.stringify(data));
}

// gg-editor's save() drops empty arrays; the rest of the app expects all three.
export const normalize = (data) => ({
  nodes: data?.nodes ?? [],
  edges: data?.edges ?? [],
  groups: data?.groups ?? [],
});
