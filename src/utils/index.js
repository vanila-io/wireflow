export const upperFirst = (str) =>
  str && typeof str === "string" ? str.toLowerCase().replace(/( |^)[a-z]/g, (l) => l.toUpperCase()) : "";
