// Same repair FlowCanvas applies on load: diagrams saved by the Create React App build
// point at /static/media/<file>.<hash>.svg, which the Vite build no longer serves.
// (PR #109 replaces both copies with src/utils/templates.js `currentImg`.)
const templateUrls = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/images/*/*.svg', { eager: true, import: 'default' })).map(([path, url]) => [
    path.split('/').pop(),
    url,
  ]),
);

export function currentTemplateUrl(img) {
  const legacy = /\/static\/media\/(.+)\.[0-9a-f]{8}\.svg$/.exec(img);
  return legacy && templateUrls[`${legacy[1]}.svg`] ? templateUrls[`${legacy[1]}.svg`] : img;
}
