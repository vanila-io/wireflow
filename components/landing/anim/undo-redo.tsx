// "Easy to use interface": a third screen joins a small flow, then the
// pointer presses the toolbar's Undo (it goes) and Redo (it comes back).
// Timing in anim.css (.wfa-undo).
import { BLUE, Card, Cursor, Edge, Icon, LAVENDER, Toolbar, bezier, handles, toolbarLayout, type IconName, type Style } from "./parts";

const Z = 120 / 220;
const a = { x: 40, y: 26 };
const b = { x: 200, y: 26 };
const c = { x: 360, y: 26 };
const ab = handles(a, b, Z);
const bc = handles(b, c, Z);
const pAB = bezier(ab.sx, ab.sy, ab.tx, ab.ty);
const pBC = bezier(bc.sx, bc.sy, bc.tx, bc.ty);

const GROUPS: IconName[][] = [["undo", "redo"], ["zoomOut", "zoomIn", "fit"], ["export", "clear"]];
const TOOLBAR_W = toolbarLayout(GROUPS, 0, 0).width;
const TX = Math.round(260 - TOOLBAR_W / 2);
const TY = 196;
const { centres } = toolbarLayout(GROUPS, TX, TY);
const at = (p: { cx: number; cy: number }) => `translate(${p.cx + 3}px, ${p.cy + 5}px)`;

function Pressed({ name, className }: { name: IconName; className: string }) {
  const p = centres[name];
  return (
    <g className={className}>
      <rect x={p.cx - 18} y={p.cy - 18} width="36" height="36" rx="6" fill={LAVENDER} />
      <Icon name={name} {...p} color={BLUE} />
    </g>
  );
}

export default function UndoRedo() {
  return (
    <svg viewBox="0 0 520 256" className="wfa-undo h-full w-full" aria-hidden>
      <g className="scene">
        <Edge d={pAB.d} tx={ab.tx} ty={ab.ty} />
        <g className="added">
          <Edge d={pBC.d} tx={bc.tx} ty={bc.ty} drawClass="e" arrowClass="a" />
        </g>
        <Card graphic="sign-in-sign-in-1" label="Sign in" {...a} z={Z} />
        <Card graphic="e-commerce-products-1" label="Product" {...b} z={Z} />
        <g className="added">
          <g className="c">
            <Card graphic="e-commerce-checkout" label="Checkout" {...c} z={Z} />
          </g>
        </g>
      </g>
      <Toolbar groups={GROUPS} x={TX} y={TY} />
      {/* A pressed button: lavender, its icon in the wire blue (the toolbar's aria-pressed look). */}
      <Pressed name="undo" className="pu" />
      <Pressed name="redo" className="pr" />
      <g className="cur" style={{ "--u": at(centres.undo), "--r": at(centres.redo) } as Style}>
        <Cursor />
      </g>
    </svg>
  );
}
