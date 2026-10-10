"use client";

// The selected note's text (#83), where the shortcuts panel sits. The field
// follows undo and redo; while it is being edited it is only overwritten when
// the stored text itself changes.
import { useState } from "react";
import { MAX_NOTE_TEXT, type NoteNode } from "@/lib/diagram/model";
import { PANEL_CLASS } from "./panel";
import { useStore } from "./store-context";

export default function NotePanel({ note }: { note: NoteNode }) {
  const store = useStore();
  const text = note.data.text;
  const [draft, setDraft] = useState(text);
  const [seen, setSeen] = useState(text);
  if (text !== seen) {
    setSeen(text);
    setDraft(text);
  }

  return (
    <aside aria-label="Note" className={PANEL_CLASS}>
      <h3 className="text-sm font-bold text-ink">Note</h3>
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
        Text
        <textarea
          value={draft}
          rows={6}
          maxLength={MAX_NOTE_TEXT}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== text && store.setNoteText(note.id, draft)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(text);
              e.currentTarget.blur();
            }
          }}
          className="mt-1 block w-full resize-y rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal leading-5 text-ink outline-none focus:border-wire-blue"
        />
      </label>
      <p className="mt-3 text-[11px] leading-4 text-ink-soft">
        Double-click the note to write on the canvas. Drag its corners to resize it, and its dots to connect it like a
        card.
      </p>
    </aside>
  );
}
