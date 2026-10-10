"use client";

// The selected card's header text and whether it shows: the earlier editor's
// Node panel (its Label field and header shortcuts), where the shortcuts panel
// sits. Double-click and H still work on the card itself. The field follows
// undo and redo; while it is being edited it is only overwritten when the
// stored header itself changes. The optional estimate (#84) works the same way.
import { useState } from "react";
import { formatCost } from "@/lib/diagram/estimate";
import { DEFAULT_CURRENCY, MAX_ESTIMATE, type CardNode } from "@/lib/diagram/model";
import { PANEL_CLASS } from "./panel";
import { useStore, useStoreState } from "./store-context";

// A text field over a stored value: it takes a new value from the store when
// (and only when) that value changes there.
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

export default function CardPanel({ card }: { card: CardNode }) {
  const store = useStore();
  const { settings } = useStoreState(store);
  const header = card.data.headerText ?? card.data.label;
  const shown = card.data.showHeader !== false;
  const [draft, setDraft] = useDraft(header);

  const estimate = card.data.estimate === undefined ? "" : String(card.data.estimate);
  const [hours, setHours] = useDraft(estimate);
  const commitHours = () => {
    const n = Number(hours);
    if (hours.trim() === "") store.setEstimate(card.id, null);
    else if (Number.isFinite(n) && n >= 0 && n <= MAX_ESTIMATE) store.setEstimate(card.id, n);
    else setHours(estimate);
  };
  const rate = settings?.hourlyRate;

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
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
        Estimate (hours)
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_ESTIMATE}
          step={0.5}
          value={hours}
          placeholder="Not estimated"
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => hours !== estimate && commitHours()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setHours(estimate);
              e.currentTarget.blur();
            }
          }}
          className="mt-1 block w-full rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
        />
      </label>
      {card.data.estimate !== undefined && rate !== undefined && (
        <p className="mt-1 text-[11px] text-ink-soft">
          {formatCost(card.data.estimate * rate, settings?.currency)} at{" "}
          {formatCost(rate, settings?.currency ?? DEFAULT_CURRENCY)} an hour
        </p>
      )}
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
