"use client";

// "3 selected · Clear" (#82): shown only while two or more items are selected,
// above the toolbar, so a multi-selection can always be seen and dropped with one
// click or tap. Esc and a click on empty canvas still clear it too. Screen
// readers hear the count politely, from a status line that is always there (a
// live region added together with its text is often not announced).
import { X } from "lucide-react";

export default function SelectionChip({ count, onClear }: { count: number; onClear: () => void }) {
  const shown = count >= 2;
  return (
    <>
      <p role="status" className="sr-only">
        {shown ? `${count} items selected` : ""}
      </p>
      {shown && (
        <div
          data-testid="selection-chip"
          className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white py-1 pl-3 pr-1 text-xs font-semibold text-ink shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border lg:left-[calc(50%-128px)] max-sm:fixed max-sm:bottom-[72px]"
        >
          <span>{count} selected</span>
          <span className="text-ink-soft" aria-hidden>
            &middot;
          </span>
          <button
            onClick={onClear}
            title="Clear the selection (Esc)"
            aria-label="Clear selection"
            className="flex items-center gap-1 rounded-full px-2 py-1 text-wire-blue transition hover:bg-wire-lavender"
          >
            <X size={12} aria-hidden />
            Clear
          </button>
        </div>
      )}
    </>
  );
}
