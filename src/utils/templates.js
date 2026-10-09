// Template screens are bundled by Vite, so their URLs carry a content hash
// (/assets/Cart-BfX1a2b3.svg). A URL changes whenever its SVG or the bundler's file
// naming changes; the Create React App build served /static/media/Cart.2ae03932.svg.
// Anything that must outlive a build, such as a saved file, refers to a template by a
// stable key instead: "<folder>/<file name without .svg>", e.g. "E-Commerce/Cart".
const files = import.meta.glob('../assets/images/*/*.svg', { eager: true, import: 'default' });

const urlByKey = new Map();
const keyByUrl = new Map();
const keyByFileName = new Map();

Object.entries(files).forEach(([path, url]) => {
  const key = path.split('/').slice(-2).join('/').replace(/\.svg$/, '');
  urlByKey.set(key, url);
  // Files with identical content are emitted once and share a URL; either key shows the same image.
  if (!keyByUrl.has(url)) keyByUrl.set(url, key);
  // File names are unique across folders (a unit test checks this), so URLs from older
  // builds, which only keep the file name, still point at exactly one template.
  keyByFileName.set(key.split('/')[1], key);
});

export const templateKeys = () => [...urlByKey.keys()];

export const templateUrl = (key) => urlByKey.get(key);

function decode(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

// The template key of a node image, or undefined if it isn't a template. Understands URLs
// of this build and of older ones: Create React App (/static/media/<file>.<hash>.svg)
// and Vite (/assets/<file>-<hash>.svg).
export function templateKey(img) {
  if (typeof img !== 'string') return undefined;
  if (keyByUrl.has(img)) return keyByUrl.get(img);

  const old = /\/(?:static\/media\/(.+)\.[0-9a-f]{8}|assets\/(.+)-[\w-]{8})\.svg$/.exec(decode(img));
  return old ? keyByFileName.get(old[1] ?? old[2]) : undefined;
}

// Re-point a node image at this build's URL of the same template. Other values are kept.
export const currentImg = (img) => templateUrl(templateKey(img)) ?? img;
