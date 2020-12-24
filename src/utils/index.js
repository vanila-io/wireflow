export const upperFirst = (str) =>
  str && typeof str === "string"
    ? str.toLowerCase().replace(/( |^)[a-z]/g, (l) => l.toUpperCase())
    : "";

export const categoriesList = [
  "All",
  "Article",
  "Blog",
  "E-Commerce",
  "Features",
  "Gallery",
  "Header",
  "Misc",
  "Multimedia",
  "Sign In",
  "Socials",
];
