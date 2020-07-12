export const upperFirst = (str) =>
  str.toLowerCase().replace(/( |^)[a-z]/g, (l) => l.toUpperCase());
