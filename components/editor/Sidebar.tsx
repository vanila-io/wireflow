'use client';
// The template sidebar, as on production (module 98946).
import { useMemo, useState } from 'react';
import { categoryLabels, graphicsByCategory, type Graphic } from '@/lib/graphics';

export const DRAG_TYPE = 'application/wireflow-card';

export default function Sidebar({ onAddCard }: { onAddCard: (g: Graphic) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const items = useMemo(() => {
    let list = graphicsByCategory(category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((g) => g.label.toLowerCase().includes(q) || g.categoryLabel.toLowerCase().includes(q));
    return list;
  }, [query, category]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-wire-border bg-white">
      <div className="border-b border-wire-border p-3">
        <div className="relative">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search graphics"
            className="w-full rounded-md border border-wire-border bg-wire-canvas/60 px-3 py-2 pl-8 text-sm outline-none placeholder:text-ink-soft focus:border-wire-blue focus:bg-white"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ slug: 'all', label: 'All' }, ...categoryLabels].map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${category === c.slug ? 'bg-wire-blue text-white' : 'bg-wire-canvas text-ink-soft hover:text-wire-blue'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {items.map((g) => (
          <button
            key={g.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, g.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => onAddCard(g)}
            title={`${g.label} - drag onto canvas or click to add`}
            className="cursor-grab rounded-md border border-wire-border bg-white p-2 transition hover:border-wire-blue/50 hover:shadow-md active:cursor-grabbing"
          >
            <img src={g.src} alt={g.label} className="h-auto w-full" />
          </button>
        ))}
        {items.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-ink-soft">No graphics match “{query}”</p>}
      </div>
    </aside>
  );
}
