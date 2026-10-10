"use client";

// The selected group's label (the earlier editor's Group panel), where the
// shortcuts panel sits. The field follows undo and redo; while it is being
// edited it is only overwritten when the stored label itself changes.
import { useState } from "react";
import type { GroupNode } from "@/lib/diagram/model";
import { PANEL_CLASS } from "./panel";
import { useStore } from "./store-context";

export default function GroupPanel({ group }: { group: GroupNode }) {
  const store = useStore();
  const label = group.data.label;
  const [draft, setDraft] = useState(label);
  const [seen, setSeen] = useState(label);
  if (label !== seen) {
    setSeen(label);
    setDraft(label);
  }

  return (
    <aside
      aria-label="Group"
      className={PANEL_CLASS}
    >
      <h3 className="text-sm font-bold text-ink">Group</h3>
      <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
        Label
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== label && store.setGroupLabel(group.id, draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(label);
              e.currentTarget.blur();
            }
          }}
          className="mt-1 block w-full rounded-md border border-wire-border px-2 py-1.5 text-xs font-normal text-ink outline-none focus:border-wire-blue"
        />
      </label>
      <p className="mt-3 text-[11px] leading-4 text-ink-soft">
        Drag a card onto the frame to add it, or out of it to take it out. Ungroup keeps the cards; Delete removes the
        group with everything in it.
      </p>
    </aside>
  );
}
