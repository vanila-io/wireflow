"use client";

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import graphicSizes from "@/lib/graphic-sizes.json";
import { isPortrait } from "@/lib/diagram/model";
import { categoryLabels, graphicsByCategory } from "@/lib/graphics";
import { container, sectionTitle } from "./ui";

// "All" opens on the first rows (three rows of six; four rows of two on a
// phone); the rest is one click away. A category shows all of its screens.
const FIRST_ROWS = 18;
const FIRST_ROWS_PHONE = 8;
const PHONE = "(max-width: 639px)"; // Tailwind's max-sm
const ratios = graphicSizes as Record<string, number>;
const total = graphicsByCategory("all").length;

export default function Gallery() {
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const grid = useRef<HTMLUListElement>(null);
  const items = useMemo(() => graphicsByCategory(category), [category]);
  const collapsed = category === "all" && !expanded && items.length > FIRST_ROWS;
  const shown = collapsed ? items.slice(0, FIRST_ROWS) : items;
  const filters = [{ slug: "all", label: "All" }, ...categoryLabels];
  const current = filters.find((f) => f.slug === category)!;

  // "Show all" removes its own button, so focus moves to the first newly shown screen.
  const showAll = () => {
    flushSync(() => setExpanded(true));
    const first = window.matchMedia(PHONE).matches ? FIRST_ROWS_PHONE : FIRST_ROWS;
    grid.current?.querySelectorAll("a")[first]?.focus();
  };

  return (
    <section id="templates" aria-labelledby="gallery-title" className="py-16 sm:py-24">
      <div className={container}>
        <h2 id="gallery-title" className={`${sectionTitle} max-w-[18ch]`}>
          Choose from {total} screens in {categoryLabels.length} categories
        </h2>

        {/* Phones scroll the chips sideways inside the page's gutter; wider screens wrap them. */}
        <div className="-mx-5 mt-8 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
          <div role="group" aria-label="Filter screens by category" className="flex w-max gap-2 py-1 sm:w-auto sm:flex-wrap">
            {filters.map((f) => {
              const active = category === f.slug;
              return (
                <button
                  key={f.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(f.slug)}
                  className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                    active
                      ? "border-wire-blue bg-wire-blue text-white"
                      : "border-wire-border bg-white text-ink-soft hover:border-wire-blue/40 hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {category === "all" ? `Showing ${shown.length} of ${total} screens` : `${items.length} ${current.label} screens`}
        </p>

        <ul ref={grid} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {shown.map((g, i) => {
            const portrait = isPortrait({ graphicId: g.id });
            const width = portrait ? 124 : 220;
            return (
              <li key={g.id} className={collapsed && i >= FIRST_ROWS_PHONE ? "max-sm:hidden" : undefined}>
                <a
                  href={`/app?card=${encodeURIComponent(g.id)}`}
                  className="group flex h-full flex-col rounded-2xl border border-wire-border bg-white p-2 transition hover:border-wire-blue/30 hover:shadow-[0_16px_36px_-20px_rgba(27,26,31,0.4)] motion-safe:hover:-translate-y-0.5"
                >
                  <span className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-xl bg-wire-canvas p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.src}
                      // The label below names the link; repeating it as alt text would read it twice.
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={width}
                      height={Math.round(width * (ratios[g.id] ?? 0.79))}
                      // a phone screen at the scale of the others, as in the editor's panel
                      className={portrait ? "h-full w-auto" : "h-auto w-full"}
                    />
                  </span>
                  <span className="truncate px-1.5 pb-1 pt-2.5 text-[13px] font-medium text-ink group-hover:text-wire-blue">
                    {g.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        {collapsed && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={showAll}
              className="h-12 rounded-xl border border-wire-border bg-white px-6 text-[15px] font-medium text-ink transition-colors hover:border-wire-blue/40"
            >
              Show all {total} screens
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
