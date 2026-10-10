// "100+ graphics to use": the graphics panel steps through four categories,
// its chip turning wire blue and that category's templates filling the grid.
// Timing in anim.css (.wfa-graphics): each set has the same 10 s keyframes,
// started a quarter of the loop apart.
import { BORDER, Chip, chipWidth, INK, Tile, type Style } from "./parts";

const CATEGORIES: { label: string; graphics: string[] }[] = [
  {
    label: "E-COMMERCE",
    graphics: ["products-1", "item", "cart", "checkout", "delivery", "paypal", "rate", "complete"].map((g) => `e-commerce-${g}`),
  },
  {
    label: "MULTIMEDIA",
    graphics: ["video-player-1", "videos-1", "songs-1", "files", "upload-image", "video-player-2", "songs-2", "videos-2"].map(
      (g) => `multimedia-${g}`
    ),
  },
  {
    label: "SOCIALS",
    graphics: ["profile-1", "feeds", "chat", "comments", "users", "connection", "profile-2", "user-settings"].map((g) => `socials-${g}`),
  },
  {
    label: "MOBILE",
    graphics: ["home", "list", "detail", "cart", "profile", "chat", "sign-in", "onboarding"].map((g) => `mobile-${g}`),
  },
];

const SLOT = 2.5; // seconds per category (anim.css: 10 s loop)
const PANEL = { x: 60, y: 20, w: 400, h: 216 };
const TILE_W = 86;
const tileAt = (j: number) => ({ x: PANEL.x + 14 + (j % 4) * (TILE_W + 9), y: PANEL.y + 50 + Math.floor(j / 4) * 80 });

// The chips in a row, 8 apart.
const chips = CATEGORIES.map((c, k) => ({
  label: c.label,
  x: PANEL.x + 14 + CATEGORIES.slice(0, k).reduce((sum, p) => sum + chipWidth(p.label) + 8, 0),
  y: PANEL.y + 14,
}));

export default function GraphicsCycle() {
  return (
    <svg viewBox="0 0 520 256" className="wfa-graphics h-full w-full" aria-hidden>
      <rect x={PANEL.x - 2} y={PANEL.y + 6} width={PANEL.w + 4} height={PANEL.h} rx="16" fill={INK} opacity=".05" />
      <rect x={PANEL.x + 0.5} y={PANEL.y + 0.5} width={PANEL.w - 1} height={PANEL.h - 1} rx="14" fill="#fff" stroke={BORDER} />
      {chips.map((c) => (
        <Chip key={c.label} {...c} />
      ))}
      {chips.map((c, k) => (
        <g key={c.label} className={k === 0 ? "chip first" : "chip"} style={{ animationDelay: `${k * SLOT}s` }}>
          <Chip {...c} selected />
        </g>
      ))}
      {CATEGORIES.map((c, k) => (
        <g key={c.label} className={k === 0 ? "set first" : "set"}>
          {c.graphics.map((g, j) => (
            <g key={g} className="tile" style={{ animationDelay: `${k * SLOT + j * 0.04}s` } as Style}>
              <Tile graphic={g} {...tileAt(j)} w={TILE_W} pad={6} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}
