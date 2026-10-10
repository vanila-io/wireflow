"use client";

// The selected connection's label and colour (#106). The editor had no edge
// editing; this adds only that. Every value is read from the store on each
// render, so the panel follows undo and redo; a field being edited is only
// overwritten when its own value changed in the store.
import { useEffect, useRef, useState } from "react";
import { EDGE_PALETTE, parseColor, toRgb } from "@/lib/color";
import { DEFAULT_EDGE_COLOR, type DiagramEdge } from "@/lib/diagram/model";
import { useStore } from "./store-context";

const colorOf = (e: DiagramEdge) => (typeof e.style?.stroke === "string" ? e.style.stroke : DEFAULT_EDGE_COLOR);

// The colours of all edges, most recently added first.
export function usedColors(edges: DiagramEdge[]) {
  return [...new Set(edges.map(colorOf).reverse())];
}

// A field that edits a stored value: it shows the store's value, and takes a new
// one from the store when (and only when) that value changes there.
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

function Swatches({
  label,
  colors,
  current,
  onPick,
}: {
  label: string;
  colors: string[];
  current: string;
  onPick: (c: string) => void;
}) {
  return (
    <>
      <p className="mt-3 text-[11px] font-semibold text-ink-soft">{label}</p>
      <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            aria-label={`${c}${c === DEFAULT_EDGE_COLOR ? " (default)" : ""}`}
            aria-pressed={c === current}
            title={`${c} · ${toRgb(c)}`}
            className={`h-5 w-5 rounded-full ring-offset-2 transition ${c === current ? "ring-2 ring-wire-blue" : "ring-1 ring-black/10 hover:ring-wire-blue/60"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </>
  );
}

export default function EdgePanel({ edge, edges }: { edge: DiagramEdge; edges: DiagramEdge[] }) {
  const store = useStore();
  const color = colorOf(edge);
  const label = typeof edge.label === "string" ? edge.label : "";
  const [labelDraft, setLabelDraft] = useDraft(label);
  const [hexDraft, setHexDraft] = useDraft(color);
  const hexValid = parseColor(hexDraft) !== null;

  const setColor = (c: string) => store.updateEdge(edge.id, { color: c });
  const commitHex = () => {
    const c = parseColor(hexDraft);
    if (c) {
      setColor(c);
      setHexDraft(c);
    }
  };

  // The native picker reports every move while dragging ("input") and the final
  // pick once ("change"): only the final pick is stored, so a drag is one undo step.
  const picker = useRef<HTMLInputElement>(null);
  const setColorRef = useRef(setColor);
  useEffect(() => {
    setColorRef.current = setColor;
  });
  useEffect(() => {
    const el = picker.current;
    if (!el) return;
    const onChange = () => setColorRef.current(el.value.toLowerCase());
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
    // The input is remounted when the stored colour changes (its key).
  }, [color]);

  return (
    <aside
      aria-label="Connection"
      className="absolute right-4 top-4 z-10 w-60 max-w-[calc(100%-2rem)] rounded-xl bg-white p-4 shadow-lg ring-1 ring-wire-border"
    >
      <h3 className="text-sm font-bold text-ink">Connection</h3>
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
        Label
        <input
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => labelDraft !== label && store.updateEdge(edge.id, { label: labelDraft })}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setLabelDraft(label);
              e.currentTarget.blur();
            }
          }}
          placeholder="e.g. Sign in"
          className="mt-1 block w-full rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
        />
      </label>
      <p className="mt-3 text-[11px] font-semibold text-ink-soft">Colour</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          // Uncontrolled, so React doesn't reset it mid-drag; a new stored colour remounts it.
          key={color}
          ref={picker}
          type="color"
          defaultValue={color}
          aria-label="Pick a colour"
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-wire-border bg-white p-0.5"
        />
        <input
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex();
            if (e.key === "Escape") setHexDraft(color);
          }}
          aria-label="Colour as hex or rgb()"
          aria-invalid={!hexValid}
          spellCheck={false}
          className={`min-w-0 flex-1 rounded-md border px-2 py-1.5 font-mono text-xs text-ink outline-none ${hexValid ? "border-wire-border focus:border-wire-blue" : "border-rose-400"}`}
        />
      </div>
      {!hexValid && <p className="mt-1 text-[11px] text-rose-600">Type a colour like #e8590c or rgb(232, 89, 12).</p>}
      <Swatches label="Palette" colors={EDGE_PALETTE} current={color} onPick={setColor} />
      <Swatches label="In this diagram" colors={usedColors(edges)} current={color} onPick={setColor} />
    </aside>
  );
}
