"use client";

import { useMemo, useState } from "react";
import { categoryLabels, graphicsByCategory } from "@/lib/graphics";

export default function Gallery() {
  const [category, setCategory] = useState("all");
  const items = useMemo(() => graphicsByCategory(category), [category]);

  const filters = [{ slug: "all", label: "All" }, ...categoryLabels];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20">
      <h2 className="text-3xl font-extrabold tracking-tight text-ink">
        Choose from {graphicsByCategory("all").length} flows in{" "}
        {categoryLabels.length} categories
      </h2>

      <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-xs font-bold uppercase tracking-wider">
        {filters.map((f) => (
          <button
            key={f.slug}
            onClick={() => setCategory(f.slug)}
            className={`transition hover:text-wire-blue ${
              category === f.slug ? "text-wire-blue" : "text-ink-soft"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((g) => (
          <a
            key={g.id}
            href={`/app?card=${encodeURIComponent(g.id)}`}
            className="group rounded-lg border border-wire-border bg-white p-3 transition hover:-translate-y-0.5 hover:border-wire-blue/40 hover:shadow-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.src}
              alt={g.label}
              loading="lazy"
              className="h-auto w-full"
            />
            <p className="mt-2 truncate text-[11px] font-semibold text-ink-soft group-hover:text-wire-blue">
              {g.label}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
