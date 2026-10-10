// The editor's pieces, drawn in SVG for the landing page's animated
// illustrations. Sizes and colours are the editor's own (components/editor):
// a card is 220 wide with a 24 px header and the template below it
// (editor.css .flow-node), connections are #a3a8c3 at 2 px with a closed
// arrowhead, labels sit on white (flow-editor.tsx), a selection is the wire
// blue, and the toolbar's icons are the ones flow-editor.tsx draws.
// The keyframes are in anim.css; every animated element is a <g> without a
// transform attribute of its own (a CSS transform would replace it).
import type { CSSProperties } from "react";
import { graphicById } from "@/lib/graphics";

export const INK = "#2d2b33";
export const INK_SOFT = "#6b6875";
export const BLUE = "#4353ff";
export const LAVENDER = "#eef0ff";
export const CANVAS = "#f0f2f5";
export const BORDER = "#e6e6ec";
export const EDGE = "#a3a8c3";

// A template's picture. Unknown ids fail the build instead of drawing nothing.
export function graphicSrc(id: string): string {
  const g = graphicById(id);
  if (!g) throw new Error(`No graphic "${id}" in lib/graphics.json`);
  return g.src;
}

// A card at its editor size; place and zoom it with `transform`.
export const CARD_W = 220;
export const CARD_H = 198;
const IMG = { x: 1, y: 25, w: 218, h: 172 };

/** Where a card's picture is once the card is at (x, y) with zoom z. */
export function cardImage(x: number, y: number, z: number) {
  return { x: x + IMG.x * z, y: y + IMG.y * z, w: IMG.w * z, h: IMG.h * z };
}

export function Card({
  graphic,
  label,
  x,
  y,
  z,
  selectClass,
}: {
  graphic: string;
  label: string;
  x: number;
  y: number;
  z: number;
  /** The animation class of its selection outline, if it gets selected. */
  selectClass?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${z})`}>
      {selectClass && (
        <g className={selectClass}>
          <rect x="-1" y="-1" width={CARD_W + 2} height={CARD_H + 2} rx="7" fill="none" stroke={BLUE} strokeWidth="2" />
        </g>
      )}
      <rect x=".5" y=".5" width={CARD_W - 1} height={CARD_H - 1} rx="6" fill="#fff" stroke="#bcc2c6" />
      <path d="M1 6.5A5.5 5.5 0 0 1 6.5 1h207a5.5 5.5 0 0 1 5.5 5.5V25H1z" fill="#ebeff0" />
      <text x={CARD_W / 2} y="16.5" textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a4a5">
        {label}
      </text>
      <g fill="#c4cbd1">
        <circle cx="196" cy="13" r="2" />
        <circle cx="203" cy="13" r="2" />
        <circle cx="210" cy="13" r="2" />
      </g>
      <image href={graphicSrc(graphic)} x={IMG.x} y={IMG.y} width={IMG.w} height={IMG.h} preserveAspectRatio="xMidYMid meet" />
      <g fill="#7a869a" stroke="#fff">
        <circle cx={CARD_W / 2} cy="0" r="4.5" />
        <circle cx={CARD_W / 2} cy={CARD_H} r="4.5" />
      </g>
    </g>
  );
}

/** The ends of a connection from card a (bottom handle) to card b (top handle), as React Flow places them. */
export function handles(a: { x: number; y: number }, b: { x: number; y: number }, z: number) {
  return {
    sx: a.x + (CARD_W / 2) * z,
    sy: a.y + (CARD_H + 4.5) * z,
    tx: b.x + (CARD_W / 2) * z,
    ty: b.y - 4.5 * z,
  };
}

// React Flow's default ("smooth") edge: a bezier from a bottom handle to a top
// one, with its control offset (getBezierPath, curvature 0.25).
export function bezier(sx: number, sy: number, tx: number, ty: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const dist = ty - sy;
  const c = dist >= 0 ? 0.5 * dist : 0.25 * 25 * Math.sqrt(-dist);
  const d = `M${r(sx)} ${r(sy)}C${r(sx)} ${r(sy + c)} ${r(tx)} ${r(ty - c)} ${r(tx)} ${r(ty)}`;
  // The point halfway along t, where React Flow puts the label.
  const mid = { x: r((sx + tx) / 2), y: r((sy + 3 * (sy + c) + 3 * (ty - c) + ty) / 8) };
  return { d, mid };
}

/**
 * A connection. `drawClass` draws it (stroke-dashoffset 1 to 0 on a path of
 * length 1), `arrowClass` shows its arrowhead; without them it is simply there.
 */
export function Edge({
  d,
  tx,
  ty,
  drawClass,
  arrowClass,
}: {
  d: string;
  tx: number;
  ty: number;
  drawClass?: string;
  arrowClass?: string;
}) {
  return (
    <>
      <path className={drawClass} d={d} pathLength={1} strokeDasharray="1 1" fill="none" stroke={EDGE} strokeWidth="2" />
      <g className={arrowClass}>
        <path
          d={`M${tx} ${ty}l-5 -6.25h10z`}
          fill={EDGE}
          stroke={EDGE}
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}

/** A connection's label: 11 px semibold ink-soft on white (flow-editor.tsx). */
export function EdgeLabel({ x, y, text, size = 11, className }: { x: number; y: number; text: string; size?: number; className?: string }) {
  // Geist's semibold averages about 0.56 em a character.
  const w = Math.round(text.length * size * 0.56 + 12);
  const h = Math.round(size + 7);
  return (
    <g className={className}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="4" fill="#fff" />
      <text x={x} y={y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="600" fill={INK_SOFT}>
        {text}
      </text>
    </g>
  );
}

/** The pointer that drags and clicks; its tip is at (0, 0). */
export function Cursor({ className, scale = 1 }: { className?: string; scale?: number }) {
  return (
    <g className={className}>
      <path
        transform={scale === 1 ? undefined : `scale(${scale})`}
        d="M0 0v16.5l4.4-4.1 2.9 6.6 2.6-1.1-2.9-6.5H13z"
        fill={INK}
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </g>
  );
}

// The toolbar's icons (flow-editor.tsx ToolbarButton), on a 24 grid.
const ICONS: Record<string, string> = {
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3",
  zoomOut: "M5 12h14",
  zoomIn: "M12 5v14M5 12h14",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  open: "M12 21V9M7 14l5-5 5 5M4 5h16",
  export: "M12 3v12M7 10l5 5 5-5M4 19h16",
  clear: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
};
export type IconName = keyof typeof ICONS;

/** A 16 px icon centred on (cx, cy). */
export function Icon({ name, cx, cy, color = INK }: { name: IconName; cx: number; cy: number; color?: string }) {
  return (
    <path
      transform={`translate(${cx - 8} ${cy - 8}) scale(${16 / 24})`}
      d={ICONS[name]}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * The floating toolbar: 36 px buttons 4 px apart, a divider between groups,
 * on white with the editor's border and a soft shadow. Returns each button's
 * centre, so a scene can press one.
 */
export function toolbarLayout(groups: IconName[][], x: number, y: number) {
  const centres: Record<string, { cx: number; cy: number }> = {};
  const dividers: number[] = [];
  let at = x + 8;
  groups.forEach((group, i) => {
    if (i > 0) {
      dividers.push(at + 4.5);
      at += 13;
    }
    group.forEach((name, j) => {
      if (j > 0) at += 4;
      centres[name] = { cx: at + 18, cy: y + 24 };
      at += 36;
    });
    at += 4;
  });
  return { centres, dividers, width: at - 4 + 8 - x };
}

export function Toolbar({ groups, x, y }: { groups: IconName[][]; x: number; y: number }) {
  const { centres, dividers, width } = toolbarLayout(groups, x, y);
  return (
    <g>
      <rect x={x - 2} y={y + 4} width={width + 4} height="50" rx="14" fill={INK} opacity=".05" />
      <rect x={x + 0.5} y={y + 0.5} width={width - 1} height="47" rx="12" fill="#fff" stroke={BORDER} />
      {dividers.map((dx) => (
        <rect key={dx} x={dx} y={y + 14} width="1" height="20" fill={BORDER} />
      ))}
      {Object.entries(centres).map(([name, c]) => (
        <Icon key={name} name={name as IconName} {...c} />
      ))}
    </g>
  );
}

/** The canvas: wire-canvas grey with the editor's dot grid (gap 20, #d7dae4). */
export function CanvasBackground({ id, x, y, w, h }: { id: string; x: number; y: number; w: number; h: number }) {
  return (
    <>
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse" x={x} y={y}>
          <circle cx="10" cy="10" r="1" fill="#d7dae4" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={CANVAS} />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

/** A template tile of the graphics panel (white, wire border, 8 px padding at its size). */
export function Tile({
  graphic,
  x,
  y,
  w,
  pad = 8,
  highlightClass,
}: {
  graphic: string;
  x: number;
  y: number;
  w: number;
  pad?: number;
  highlightClass?: string;
}) {
  const iw = w - 2 * pad;
  const ih = Math.round(iw / 1.27);
  return (
    <>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={ih + 2 * pad - 1} rx="6" fill="#fff" stroke={BORDER} />
      {highlightClass && (
        <g className={highlightClass}>
          <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={ih + 2 * pad - 1} rx="6" fill="none" stroke={BLUE} strokeWidth="1.5" />
        </g>
      )}
      <image href={graphicSrc(graphic)} x={x + pad} y={y + pad} width={iw} height={ih} preserveAspectRatio="xMidYMid meet" />
    </>
  );
}

/** A category chip, as in the graphics panel: 10 px bold uppercase, a pill. */
export function chipWidth(label: string) {
  return Math.round(label.length * 6.8 + 20);
}

export function Chip({ x, y, label, selected = false }: { x: number; y: number; label: string; selected?: boolean }) {
  const w = chipWidth(label);
  return (
    <>
      <rect x={x} y={y} width={w} height="22" rx="11" fill={selected ? BLUE : CANVAS} />
      <text
        x={x + w / 2}
        y={y + 14.5}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        letterSpacing=".25"
        fill={selected ? "#fff" : INK_SOFT}
      >
        {label}
      </text>
    </>
  );
}

export type Style = CSSProperties & Record<`--${string}`, string>;
