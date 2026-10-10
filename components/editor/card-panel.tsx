"use client";

// The selected card's header text and whether it shows: the earlier editor's
// Node panel (its Label field and header shortcuts), where the shortcuts panel
// sits. Double-click and H still work on the card itself. The field follows
// undo and redo; while it is being edited it is only overwritten when the
// stored header itself changes.
import { useState } from "react";
import type { CardNode } from "@/lib/diagram/model";
import { PANEL_CLASS } from "./panel";
import { useStore } from "./store-context";

export default function CardPanel({ card }: { card: CardNode }) {
  const store = useStore();
  const header = card.data.headerText ?? card.data.label;
  const shown = card.data.showHeader !== false;
  const [draft, setDraft] = useState(header);
  const [seen, setSeen] = useState(header);
  if (header !== seen) {
    setSeen(header);
    setDraft(header);
  }

  return (
    <aside
      aria-label="Card"
      className={PANEL_CLASS}
    >
      <h3 className="text-sm font-bold text-ink">Card</h3>
      <p className="mt-1 text-[11px] text-ink-soft">{card.data.label}</p>
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
        Header
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== header && store.setHeaderText(card.id, draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(header);
              e.currentTarget.blur();
            }
          }}
          className="mt-1 block w-full rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={shown}
          onChange={(e) => store.setHeaders([card.id], e.target.checked)}
          className="accent-wire-blue"
        />
        Show header
      </label>
      <dl className="mt-4 space-y-1.5 text-[11px]">
        {[
          ["Hide / show header", "H"],
          ["Hide header", "Ctrl + H"],
          ["Show header", "Ctrl + K"],
          ["Delete", "Backspace"],
        ].map(([action, keys]) => (
          <div key={action} className="flex items-center justify-between">
            <dt className="text-ink-soft">{action}</dt>
            <dd className="font-semibold text-rose-500">{keys}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
