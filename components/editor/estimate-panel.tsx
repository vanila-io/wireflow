"use client";

// The project's estimate (#84), opened from the total in the header: hours per
// top-level group and for the cards in none, the project's stages (work that
// isn't a screen, such as design or QA: fixed hours, or a percentage of the
// cards' hours), the total, and the hourly rate that turns hours into cost.
// The rate and the stages are stored with the diagram, so they travel in the
// file. The table downloads as wireflow-estimate.csv. Where the shortcuts panel
// sits, like the other panels.
import { Download, Plus, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import {
  ESTIMATE_FILE_NAME,
  estimateCsv,
  formatCost,
  formatHours,
  projectEstimate,
  stageLabel,
  totalsByGroup,
} from "@/lib/diagram/estimate";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  MAX_ESTIMATE,
  MAX_PERCENT,
  MAX_RATE,
  MAX_STAGES,
  type Diagram,
  type Stage,
} from "@/lib/diagram/model";
import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "./panel";
import { useStore } from "./store-context";

const FIELD =
  "rounded-md border border-wire-border bg-white px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue";
// Names the stage field suggests; any other name works too.
const SUGGESTED_STAGES = ["Design", "QA", "Project management", "Deployment", "Content", "Contingency"];

// A field over a stored value: it takes a new value from the store when (and
// only when) that value changes there, so it follows undo and redo.
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

// Enter saves the field (by leaving it), Escape puts the stored value back.
const editKeys = (reset: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") e.currentTarget.blur();
  if (e.key === "Escape") {
    reset();
    e.currentTarget.blur();
  }
};

function StageRow({
  stage,
  index,
  listId,
  helpId,
  autoFocus,
  onChange,
  onRemove,
}: {
  stage: Stage;
  index: number;
  listId: string;
  helpId: string;
  autoFocus: boolean;
  onChange: (next: Stage) => void;
  onRemove: () => void;
}) {
  const unit = stage.hours !== undefined ? "hours" : "percent";
  const amount = String(stage.hours ?? stage.percent);
  const max = unit === "hours" ? MAX_ESTIMATE : MAX_PERCENT;
  const [name, setName] = useDraft(stage.label);
  const [value, setValue] = useDraft(amount);
  const withAmount = (n: number, u = unit): Stage =>
    u === "hours" ? { label: stage.label, hours: n } : { label: stage.label, percent: n };
  const commitValue = () => {
    const n = Number(value);
    if (value.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= max) onChange(withAmount(n));
    else setValue(amount);
  };

  return (
    <li role="group" aria-label={`Stage ${index + 1}`} className="flex items-center gap-1">
      <input
        aria-label="Stage name"
        value={name}
        list={listId}
        placeholder="Name"
        autoFocus={autoFocus}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== stage.label && onChange({ ...stage, label: name })}
        onKeyDown={editKeys(() => setName(stage.label))}
        className={`${FIELD} min-w-0 flex-1`}
      />
      <input
        aria-label={unit === "hours" ? "Hours" : "Percent of card hours"}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== amount && commitValue()}
        onKeyDown={editKeys(() => setValue(amount))}
        className={`${FIELD} w-12 px-1.5 text-right`}
      />
      <select
        aria-label="Unit"
        aria-describedby={helpId}
        value={unit}
        onChange={(e) => {
          const next = e.target.value as typeof unit;
          const n = Number(amount);
          onChange(withAmount(next === "percent" ? Math.min(n, MAX_PERCENT) : n, next));
        }}
        className={`${FIELD} w-14 px-1.5`}
      >
        <option value="hours">h</option>
        <option value="percent">%</option>
      </select>
      <button
        onClick={onRemove}
        aria-label={`Remove the stage ${stageLabel(stage)}`}
        title="Remove this stage"
        className="shrink-0 rounded p-0.5 text-ink-soft hover:text-rose-600"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  );
}

export default function EstimatePanel({ diagram, onClose }: { diagram: Diagram; onClose: () => void }) {
  const store = useStore();
  const rate = diagram.settings?.hourlyRate;
  const currency = diagram.settings?.currency ?? DEFAULT_CURRENCY;
  const stages = diagram.settings?.stages ?? [];
  const estimate = projectEstimate(diagram);
  const rows = totalsByGroup(diagram);
  const listId = useId();
  const helpId = useId();
  // The stage just added, whose name field takes the focus.
  const [added, setAdded] = useState<number | null>(null);

  // The rate field follows undo and redo, as the other panels' fields do.
  const stored = rate === undefined ? "" : String(rate);
  const [draft, setDraft] = useDraft(stored);
  const commitRate = () => {
    const n = Number(draft);
    if (draft.trim() === "") store.setSettings({ hourlyRate: undefined });
    else if (Number.isFinite(n) && n >= 0 && n <= MAX_RATE) store.setSettings({ hourlyRate: n });
    else setDraft(stored);
  };

  const setStages = (next: Stage[]) => store.setSettings({ stages: next.length ? next : undefined });
  const addStage = () => {
    setAdded(stages.length);
    setStages([...stages, { label: "", hours: 0 }]);
  };

  const downloadCsv = () => {
    // The byte order mark makes Excel read the file as UTF-8 (names, €, £).
    const blob = new Blob(["﻿", estimateCsv(diagram)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ESTIMATE_FILE_NAME;
    a.click();
    // Revoking at once can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const cost = (hours: number) => (rate === undefined ? null : formatCost(hours * rate, currency));
  const costCell = (hours: number) =>
    rate !== undefined && <td className="whitespace-nowrap py-1 pl-2 text-right text-ink-soft">{cost(hours)}</td>;

  return (
    // A little wider than the other panels: a stage's name, amount and unit share a line.
    <aside aria-label="Estimate" className={cn(PANEL_CLASS, "w-72")}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Estimate</h3>
        <button onClick={onClose} aria-label="Close the estimate" className="rounded p-0.5 text-ink-soft hover:text-ink">
          <X size={14} aria-hidden />
        </button>
      </div>
      <table className="mt-3 w-full text-xs">
        <caption className="sr-only">
          Estimated hours{rate !== undefined && " and cost"} per group{stages.length > 0 && " and stage"}
        </caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id ?? "none"}>
              <th scope="row" className="py-1 text-left font-normal break-words text-ink-soft">
                {r.label}
              </th>
              <td className="whitespace-nowrap py-1 pl-2 text-right font-semibold text-ink">{formatHours(r.total.hours)}</td>
              {costCell(r.total.hours)}
            </tr>
          ))}
        </tbody>
        {stages.length > 0 && (
          <tbody className="border-t border-wire-border">
            <tr>
              <th scope="row" className="pt-2 pb-1 text-left font-semibold text-ink">
                Cards
              </th>
              <td className="whitespace-nowrap pt-2 pb-1 pl-2 text-right font-semibold text-ink">
                {formatHours(estimate.cards.hours)}
              </td>
              {rate !== undefined && (
                <td className="whitespace-nowrap pt-2 pb-1 pl-2 text-right text-ink-soft">{cost(estimate.cards.hours)}</td>
              )}
            </tr>
            {estimate.stages.map(({ stage, hours }, i) => (
              <tr key={i}>
                <th scope="row" className="py-1 text-left font-normal break-words text-ink-soft">
                  {stageLabel(stage)}
                  {stage.percent !== undefined && <span className="text-ink-soft/80"> &middot; {stage.percent}%</span>}
                </th>
                <td className="whitespace-nowrap py-1 pl-2 text-right font-semibold text-ink">{formatHours(hours)}</td>
                {costCell(hours)}
              </tr>
            ))}
          </tbody>
        )}
        <tfoot>
          <tr className="border-t border-wire-border">
            <th scope="row" className="pt-2 text-left font-bold text-ink">
              Total
            </th>
            <td className="whitespace-nowrap pt-2 pl-2 text-right font-bold text-ink">{formatHours(estimate.hours)}</td>
            {rate !== undefined && (
              <td className="whitespace-nowrap pt-2 pl-2 text-right font-bold text-wire-blue">{cost(estimate.hours)}</td>
            )}
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 text-[11px] text-ink-soft">
        {estimate.cards.estimated} of {estimate.cards.cards} {estimate.cards.cards === 1 ? "card" : "cards"} estimated
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
            onKeyDown={editKeys(() => setDraft(stored))}
            className={`${FIELD} mt-1 block w-full`}
          />
        </label>
        <label className="block text-[11px] font-semibold text-ink-soft">
          <span className="sr-only">Currency</span>
          <select
            value={currency}
            onChange={(e) => store.setSettings({ currency: e.target.value })}
            className={`${FIELD} block px-1.5`}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold text-ink-soft">Stages</h4>
        {stages.length < MAX_STAGES && (
          <button
            onClick={addStage}
            className="-mr-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-wire-blue transition hover:bg-wire-lavender"
          >
            <Plus size={12} aria-hidden />
            Add stage
          </button>
        )}
      </div>
      {stages.length > 0 && (
        <ul aria-label="Stages" className="mt-1.5 space-y-1.5">
          {stages.map((stage, i) => (
            <StageRow
              key={i}
              stage={stage}
              index={i}
              listId={listId}
              helpId={helpId}
              autoFocus={i === added}
              onChange={(next) => {
                setAdded(null);
                setStages(stages.map((s, j) => (j === i ? next : s)));
              }}
              onRemove={() => {
                setAdded(null);
                setStages(stages.filter((_, j) => j !== i));
              }}
            />
          ))}
        </ul>
      )}
      <datalist id={listId}>
        {SUGGESTED_STAGES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p id={helpId} className="mt-1.5 text-[11px] leading-4 text-ink-soft">
        Work that isn&rsquo;t a screen, such as design or QA: fixed hours (h), or a percentage of the cards&rsquo;
        hours (%).
      </p>

      <button
        onClick={downloadCsv}
        title={`Download the estimate table as ${ESTIMATE_FILE_NAME}`}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-wire-blue ring-1 ring-wire-blue/40 transition hover:bg-wire-lavender"
      >
        <Download size={13} aria-hidden />
        Download CSV
      </button>
      <p className="mt-3 text-[11px] leading-4 text-ink-soft">
        Set a card&rsquo;s hours in its panel. The rate and the stages are saved with the diagram, and in its file.
      </p>
    </aside>
  );
}
