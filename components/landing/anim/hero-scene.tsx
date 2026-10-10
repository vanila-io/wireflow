// The hero's animated editor (in place of the screenshot): three screens are
// dragged from the graphics panel onto the canvas, connections draw between
// them with their labels, and the last two are grouped as "Checkout"; then
// the canvas clears and it starts again. Phones get the same story on a
// smaller stage: two screens and one connection, at a size that stays legible.
// The geometry is here, the timing in anim.css (.wfa-hero, .wfa-hero-sm).
import {
  BLUE,
  BORDER,
  CANVAS,
  CanvasBackground,
  Card,
  Chip,
  chipWidth,
  Cursor,
  Edge,
  EdgeLabel,
  INK,
  INK_SOFT,
  Tile,
  Toolbar,
  bezier,
  cardImage,
  handles,
  type Style,
} from "./parts";

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/**
 * A card dragged from a tile: the CSS transform that puts the card's picture
 * over the tile's picture (where the drag starts), and the point the pointer
 * holds it by, at the start and at the drop.
 */
function dragFrom(card: { x: number; y: number }, z: number, tile: { x: number; y: number; w: number }) {
  const to = cardImage(card.x, card.y, z);
  const s = tile.w / to.w;
  const grabEnd = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const grabStart = { x: tile.x + tile.w / 2, y: tile.y + (to.h * s) / 2 };
  return {
    from: `translate(${px(tile.x - s * to.x)}, ${px(tile.y - s * to.y)}) scale(${Math.round(s * 10000) / 10000})`,
    grabStart: `translate(${px(grabStart.x)}, ${px(grabStart.y)})`,
    grabEnd: `translate(${px(grabEnd.x)}, ${px(grabEnd.y)})`,
  };
}

const CHIPS = [
  "ALL",
  "ARTICLE",
  "BLOG",
  "E-COMMERCE",
  "FEATURES",
  "GALLERY",
  "HEADER",
  "MISC",
  "MULTIMEDIA",
  "SIGN IN",
  "SOCIALS",
  "FLOW",
  "MOBILE",
];

// The chips wrap like the panel's flex-wrap row (196 wide, 6 apart).
function chipRows(x: number, y: number, width: number) {
  const placed: { label: string; x: number; y: number }[] = [];
  let cx = x;
  let cy = y;
  for (const label of CHIPS) {
    const w = chipWidth(label);
    if (cx > x && cx + w > x + width) {
      cx = x;
      cy += 28;
    }
    placed.push({ label, x: cx, y: cy });
    cx += w + 6;
  }
  return { placed, bottom: cy + 22 };
}

// ---- Desktop: the whole editor window, 1200 x 750 ----

const Z = 0.9;
const home = { x: 600, y: 96 };
const product = { x: 390, y: 372 };
const cart = { x: 810, y: 372 };

const PANEL_W = 220;
const TILE_W = 94;
const chips = chipRows(12, 114, 196);
const tilesTop = chips.bottom + 24;
const tileRow = (i: number) => tilesTop + i * 86;
const tileCol = (i: number) => 12 + i * 102;
// The panel's templates, two to a row; the first, third and fourth get dragged.
const TILES = [
  "header-header-1",
  "header-header-3",
  "e-commerce-products-1",
  "e-commerce-cart",
  "sign-in-sign-in-1",
  "article-article-1",
  "e-commerce-checkout",
  "e-commerce-complete",
  "features-features-1",
  "gallery-gallery-1",
  "blog-articles-1",
  "e-commerce-item",
];
const tileAt = (i: number) => ({ x: tileCol(i % 2), y: tileRow(Math.floor(i / 2)) });
const tileImage = (i: number) => ({ x: tileAt(i).x + 8, y: tileAt(i).y + 8, w: TILE_W - 16 });

const drags = [dragFrom(home, Z, tileImage(0)), dragFrom(product, Z, tileImage(2)), dragFrom(cart, Z, tileImage(3))];
const e1 = handles(home, product, Z);
const e2 = handles(product, cart, Z);
const b1 = bezier(e1.sx, e1.sy, e1.tx, e1.ty);
const b2 = bezier(e2.sx, e2.sy, e2.tx, e2.ty);
const group = { x: 360, y: 330, w: 678, h: 266 };

function Desktop({ className }: { className: string }) {
  const header = (
    <g>
      <rect width="1200" height="56" fill="#fff" />
      <rect y="55" width="1200" height="1" fill={BORDER} />
      <g transform="translate(16 15) scale(.7647)">
        <rect x="7" y="7" width="20" height="20" rx="4" transform="rotate(45 17 17)" fill="none" stroke={BLUE} strokeWidth="2.5" />
        <rect x="13" y="13" width="8" height="8" rx="2" fill={BLUE} />
      </g>
      <text x="50" y="33" fontSize="14" fontWeight="700" fill={INK}>
        Wireflow
      </text>
      <text x="870" y="32" textAnchor="end" fontSize="12" fill={INK_SOFT}>
        All changes saved
      </text>
      <g fontSize="12" fontWeight="700" letterSpacing=".3" textAnchor="middle">
        <rect x="882.5" y="13.5" width="57" height="29" rx="6" fill="#fff" stroke={BLUE} strokeOpacity=".4" />
        <path
          transform="translate(895 21) scale(.5833)"
          d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4M22 4h-4"
          fill="none"
          stroke={BLUE}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="922" y="32.5" fill={BLUE}>
          AI
        </text>
        <rect x="952.5" y="13.5" width="97" height="29" rx="6" fill="#fff" stroke={BLUE} strokeOpacity=".4" />
        <text x="1001" y="32.5" fill={BLUE}>
          OPEN FILE
        </text>
        <rect x="1062" y="13" width="122" height="30" rx="6" fill={BLUE} />
        <text x="1123" y="32.5" fill="#fff">
          EXPORT JSON
        </text>
      </g>
    </g>
  );

  const panel = (
    <g>
      <rect y="56" width={PANEL_W} height="694" fill="#fff" />
      <rect x={PANEL_W} y="56" width="1" height="694" fill={BORDER} />
      <rect x="12.5" y="68.5" width="195" height="33" rx="6" fill={CANVAS} fillOpacity=".6" stroke={BORDER} />
      <g transform="translate(22 78) scale(.5833)" fill="none" stroke={INK_SOFT} strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" strokeLinecap="round" />
      </g>
      <text x="40" y="89.5" fontSize="13" fill={INK_SOFT}>
        Search graphics
      </text>
      {chips.placed.map((c) => (
        <Chip key={c.label} {...c} selected={c.label === "ALL"} />
      ))}
      <rect y={chips.bottom + 11.5} width={PANEL_W} height="1" fill={BORDER} />
      {TILES.map((g, i) => (
        <Tile
          key={g}
          graphic={g}
          {...tileAt(i)}
          w={TILE_W}
          highlightClass={i === 0 ? "t1" : i === 2 ? "t2" : i === 3 ? "t3" : undefined}
        />
      ))}
    </g>
  );

  return (
    <svg
      viewBox="0 0 1200 750"
      width="1200"
      height="750"
      role="img"
      aria-label="The Wireflow editor: three screens are dragged from the graphics panel onto the canvas, joined by labelled connections and grouped as Checkout"
      className={`wfa-hero ${className}`}
    >
      <CanvasBackground id="wfa-hero-dots" x={PANEL_W + 1} y={56} w={1200 - PANEL_W - 1} h={694} />
      {header}
      {panel}
      {/* The canvas's content goes over the panel: a card being dragged starts on its tile. */}
      <g className="scene">
        {/* The group frame goes under the cards, as in React Flow. */}
        <g className="grp">
          <rect x={group.x} y={group.y} width={group.w} height={group.h} rx="10" fill="#eef0ff" fillOpacity=".45" stroke="#b8bfd6" strokeWidth="1.5" strokeDasharray="6 4" />
          <g className="grp-sel">
            <rect x={group.x} y={group.y} width={group.w} height={group.h} rx="10" fill="none" stroke={BLUE} strokeWidth="1.5" />
          </g>
          <text x={group.x + 12} y={group.y + 19} fontSize="11" fontWeight="700" letterSpacing=".44" fill={INK_SOFT}>
            CHECKOUT
          </text>
        </g>
        <Edge d={b1.d} tx={e1.tx} ty={e1.ty} drawClass="e1" arrowClass="a1" />
        <Edge d={b2.d} tx={e2.tx} ty={e2.ty} drawClass="e2" arrowClass="a2" />
        <EdgeLabel {...b1.mid} text="Browse" className="l1" />
        <EdgeLabel {...b2.mid} text="Add to cart" className="l2" />
        <g className="c1" style={{ "--from": drags[0].from } as Style}>
          <Card graphic="header-header-1" label="Home" {...home} z={Z} selectClass="s1" />
        </g>
        <g className="c2" style={{ "--from": drags[1].from } as Style}>
          <Card graphic="e-commerce-products-1" label="Product" {...product} z={Z} selectClass="s2" />
        </g>
        <g className="c3" style={{ "--from": drags[2].from } as Style}>
          <Card graphic="e-commerce-cart" label="Cart" {...cart} z={Z} selectClass="s3" />
        </g>
      </g>
      <Toolbar
        groups={[["undo", "redo"], ["zoomOut", "zoomIn", "fit"], ["open", "export", "clear"]]}
        x={531}
        y={682}
      />
      <g
        className="cur"
        style={
          {
            "--p1": drags[0].grabStart,
            "--d1": drags[0].grabEnd,
            "--p2": drags[1].grabStart,
            "--d2": drags[1].grabEnd,
            "--p3": drags[2].grabStart,
            "--d3": drags[2].grabEnd,
          } as Style
        }
      >
        <Cursor scale={1.3} />
      </g>
    </svg>
  );
}

// ---- Phones: a closer view, 480 x 480: a column of tiles and two screens ----

const ZS = 0.72;
const homeS = { x: 152, y: 26 };
const productS = { x: 302, y: 228 };
const TILES_S = ["header-header-1", "e-commerce-products-1", "e-commerce-cart", "sign-in-sign-in-1", "e-commerce-checkout", "article-article-1"];
const tileS = (i: number) => ({ x: 12, y: 12 + i * 90 });
const dragsS = [dragFrom(homeS, ZS, { x: 20, y: 20, w: 84 }), dragFrom(productS, ZS, { x: 20, y: 110, w: 84 })];
const eS = handles(homeS, productS, ZS);
const bS = bezier(eS.sx, eS.sy, eS.tx, eS.ty);

function Phone({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 480 480"
      width="480"
      height="480"
      role="img"
      aria-label="The Wireflow editor: two screens are dragged from the graphics panel onto the canvas and joined by a labelled connection"
      className={`wfa-hero-sm ${className}`}
    >
      <CanvasBackground id="wfa-hero-sm-dots" x={125} y={0} w={355} h={480} />
      <rect width="124" height="480" fill="#fff" />
      <rect x="124" width="1" height="480" fill={BORDER} />
      {TILES_S.map((g, i) => (
        <Tile key={g} graphic={g} {...tileS(i)} w={100} highlightClass={i === 0 ? "t1" : i === 1 ? "t2" : undefined} />
      ))}
      <g className="scene">
        <Edge d={bS.d} tx={eS.tx} ty={eS.ty} drawClass="e1" arrowClass="a1" />
        <EdgeLabel {...bS.mid} text="Browse" size={14} className="l1" />
        <g className="c1" style={{ "--from": dragsS[0].from } as Style}>
          <Card graphic="header-header-1" label="Home" {...homeS} z={ZS} selectClass="s1" />
        </g>
        <g className="c2" style={{ "--from": dragsS[1].from } as Style}>
          <Card graphic="e-commerce-products-1" label="Product" {...productS} z={ZS} selectClass="s2" />
        </g>
      </g>
      <g
        className="cur"
        style={
          {
            "--p1": dragsS[0].grabStart,
            "--d1": dragsS[0].grabEnd,
            "--p2": dragsS[1].grabStart,
            "--d2": dragsS[1].grabEnd,
          } as Style
        }
      >
        <Cursor scale={1.15} />
      </g>
    </svg>
  );
}

export default function HeroScene() {
  return (
    <>
      <Desktop className="hidden h-auto w-full sm:block" />
      <Phone className="block h-auto w-full sm:hidden" />
    </>
  );
}
