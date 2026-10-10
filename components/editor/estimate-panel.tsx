"use client";

// The project's estimate (#84), opened from the total in the header: hours per
// top-level group and for the cards in none, the total, and the hourly rate
// that turns hours into cost (stored with the diagram, so it travels in the
// file). Where the shortcuts panel sits, like the other panels.
import { X } from "lucide-react";
import { useState } from "react";
import { formatCost, formatHours, projectTotal, totalsByGroup } from "@/lib/diagram/estimate";
import { CURRENCIES, DEFAULT_CURRENCY, MAX_RATE, type Diagram } from "@/lib/diagram/model";
import { PANEL_CLASS } from "./panel";
import { useStore } from "./store-context";

export default function EstimatePanel({ diagram, onClose }: { diagram: Diagram; onClose: () => void }) {
  const store = useStore();
  const rate = diagram.settings?.hourlyRate;
  const currency = diagram.settings?.currency ?? DEFAULT_CURRENCY;
  const total = projectTotal(diagram);
  const rows = totalsByGroup(diagram);

  // The rate field follows undo and redo, as the other panels' fields do.
  const stored = rate === undefined ? "" : String(rate);
  const [draft, setDraft] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    setSeen(stored);
    setDraft(stored);
  }
  const commitRate = () => {
    const n = Number(draft);
    if (draft.trim() === "") store.setSettings({ hourlyRate: undefined });
    else if (Number.isFinite(n) && n >= 0 && n <= MAX_RATE) store.setSettings({ hourlyRate: n });
    else setDraft(stored);
  };

  const cost = (hours: number) => (rate === undefined ? null : formatCost(hours * rate, currency));

  return (
    <aside aria-label="Estimate" className={PANEL_CLASS}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Estimate</h3>
        <button onClick={onClose} aria-label="Close the estimate" className="rounded p-0.5 text-ink-soft hover:text-ink">
          <X size={14} aria-hidden />
        </button>
      </div>
      <table className="mt-3 w-full text-xs">
        <caption className="sr-only">Estimated hours{rate !== undefined && " and cost"} per group</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id ?? "none"}>
              <th scope="row" className="py-1 text-left font-normal break-words text-ink-soft">
                {r.label}
              </th>
              <td className="whitespace-nowrap py-1 pl-2 text-right font-semibold text-ink">{formatHours(r.total.hours)}</td>
              {rate !== undefined && <td className="whitespace-nowrap py-1 pl-2 text-right text-ink-soft">{cost(r.total.hours)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-wire-border">
            <th scope="row" className="pt-2 text-left font-bold text-ink">
              Total
            </th>
            <td className="whitespace-nowrap pt-2 pl-2 text-right font-bold text-ink">{formatHours(total.hours)}</td>
            {rate !== undefined && <td className="whitespace-nowrap pt-2 pl-2 text-right font-bold text-wire-blue">{cost(total.hours)}</td>}
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 text-[11px] text-ink-soft">
        {total.estimated} of {total.cards} {total.cards === 1 ? "card" : "cards"} estimated
      </p>
      <div className="mt-3 flex items-end gap-2">
        <label className="block min-w-0 flex-1 text-[11px] font-semibold text-ink-soft">
          Hourly rate
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_RATE}
            step="any"
            value={draft}
            placeholder="None"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== stored && commitRate()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(stored);
                e.currentTarget.blur();
              }
            }}
            className="mt-1 block w-full rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
          />
        </label>
        <label className="block text-[11px] font-semibold text-ink-soft">
          <span className="sr-only">Currency</span>
          <select
            value={currency}
            onChange={(e) => store.setSettings({ currency: e.target.value })}
            className="block rounded-md border border-wire-border bg-white px-1.5 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-4 text-ink-soft">
        Set a card&rsquo;s hours in its panel. The rate is saved with the diagram, so it is in the file too.
      </p>
    </aside>
  );
}
