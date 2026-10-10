"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoryLabels, graphicsByCategory } from "@/lib/graphics";
import type { Graphic } from "@/lib/graphics";

type Props = {
  onAddCard: (g: Graphic) => void;
  /** A touch drag ended at this screen point (the canvas decides if it is on it). */
  onTouchDrop: (g: Graphic, point: { x: number; y: number }) => void;
};

// How far a finger moves before the gesture is a drag (sideways) or a scroll.
const SLOP = 8;

// #108's learnings: a search looks in every category, the controls are named for
// screen readers, and a new search or category starts at the top of the list.
// On a touch screen a tap adds the template, and a sideways swipe drags it onto
// the canvas (HTML drag and drop is mouse-only; a vertical swipe scrolls).
export default function GraphicsPanel({ onAddCard, onTouchDrop }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const searching = query.trim() !== "";
  // A search looks in every category; the chips filter when there is none.
  const shown = searching ? "all" : category;

  const items = useMemo(() => {
    let list = graphicsByCategory(shown);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.categoryLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [query, shown]);

  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [query, category]);

  // Touch drag: a ghost image follows the finger. It lives outside React state,
  // so moving it doesn't re-render the list.
  const touch = useRef<{ g: Graphic; id: number; x: number; y: number; ghost?: HTMLElement } | null>(null);
  const droppedAt = useRef(-Infinity);
  const endTouch = () => {
    touch.current?.ghost?.remove();
    touch.current = null;
  };
  useEffect(() => endTouch, []);

  return (
    <aside aria-label="Screen templates" className="flex h-full w-64 shrink-0 flex-col border-r border-wire-border bg-white">
      <div className="border-b border-wire-border p-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search graphics"
            aria-label="Search graphics in all categories"
            className="w-full rounded-md border border-wire-border bg-wire-canvas/60 px-3 py-2 pl-8 text-sm outline-none placeholder:text-ink-soft focus:border-wire-blue focus:bg-white"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Categories">
          {[{ slug: "all", label: "All" }, ...categoryLabels].map((c) => (
            <button
              key={c.slug}
              aria-pressed={shown === c.slug}
              onClick={() => {
                setQuery("");
                setCategory(c.slug);
              }}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                shown === c.slug
                  ? "bg-wire-blue text-white"
                  : "bg-wire-canvas text-ink-soft hover:text-wire-blue"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        {searching ? `${items.length} ${items.length === 1 ? "graphic matches" : "graphics match"}` : ""}
      </p>
      <div ref={list} className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {items.map((g) => (
          <button
            key={g.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/wireflow-card", g.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={(e) => {
              // A touch drag that just ended is not also a tap.
              if (e.timeStamp - droppedAt.current > 500) onAddCard(g);
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== "touch") return;
              touch.current = { g, id: e.pointerId, x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              const t = touch.current;
              if (!t || t.id !== e.pointerId) return;
              if (!t.ghost) {
                const dx = Math.abs(e.clientX - t.x);
                const dy = Math.abs(e.clientY - t.y);
                if (dx < SLOP && dy < SLOP) return;
                // Mostly vertical: the browser scrolls the list (touch-action: pan-y).
                if (dy >= dx) return endTouch();
                const ghost = e.currentTarget.querySelector("img")!.cloneNode() as HTMLElement;
                ghost.className = "touch-drag-ghost";
                ghost.removeAttribute("alt");
                document.body.append(ghost);
                t.ghost = ghost;
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              t.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
            }}
            onPointerUp={(e) => {
              const t = touch.current;
              if (t?.ghost && t.id === e.pointerId) {
                droppedAt.current = e.timeStamp;
                onTouchDrop(t.g, { x: e.clientX, y: e.clientY });
              }
              endTouch();
            }}
            onPointerCancel={endTouch}
            title={`${g.label} - drag onto canvas or click to add`}
            className="touch-pan-y cursor-grab rounded-md border border-wire-border bg-white p-2 transition hover:border-wire-blue/50 hover:shadow-md active:cursor-grabbing"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={g.label} className="h-auto w-full" />
          </button>
        ))}
        {items.length === 0 && (
          <p className="col-span-2 py-8 text-center text-sm text-ink-soft">
            No graphics match &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
    </aside>
  );
}
