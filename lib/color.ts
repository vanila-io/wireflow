// Edge colours: always opaque #rrggbb in lower case, so the same colour typed two
// ways counts once.

/**
 * Read a typed colour: #rgb, #rrggbb, rrggbb, #rrggbbaa or rgb()/rgba(). Alpha is
 * dropped (edges are opaque). Returns null for anything else.
 */
export function parseColor(text: string): string | null {
  const s = text.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s)?.[1];
  if (hex) return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6)}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s);
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((c) => c > 255)) return null;
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

// The palette; the first entry is the default edge colour.
export const EDGE_PALETTE = ['#a3a8c3', '#2d2b33', '#4353ff', '#13c2c2', '#52c41a', '#faad14', '#e8590c', '#f5222d', '#eb2f96', '#722ed1'];
