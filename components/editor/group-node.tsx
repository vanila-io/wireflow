"use client";

// A group: a labelled frame that always wraps its members (lib/diagram/groups.ts),
// as in the earlier editor. Double-click the label to rename it; the Group panel
// renames it too. Dragging the frame moves everything in it.
import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { formatHours, groupTotal } from "@/lib/diagram/estimate";
import type { GroupNode as GroupNodeType } from "@/lib/diagram/model";
import { useStore, useStoreState } from "./store-context";

export default function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  const store = useStore();
  const { dropTarget, nodes } = useStoreState(store);
  // The hours of the cards inside (#84), once any of them has an estimate.
  const total = groupTotal(nodes, id);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // As with card headers: Enter or blur saves (one undo step), Escape cancels.
  const end = (value: string | null) => {
    if (ended.current) return;
    ended.current = true;
    setEditing(false);
    if (value !== null) store.setGroupLabel(id, value);
  };

  return (
    <div
      className={`flow-group ${selected ? "selected" : ""} ${dropTarget === id ? "drop-target" : ""}`}
      data-testid="group-frame"
    >
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={data.label}
          aria-label="Group label"
          onBlur={(e) => end(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") end(e.currentTarget.value);
            if (e.key === "Escape") end(null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flow-group-label w-48 rounded bg-white px-1 outline-none ring-1 ring-wire-blue"
        />
      ) : (
        <button
          className="flow-group-label"
          title="Double-click to rename the group"
          onDoubleClick={() => {
            ended.current = false;
            setEditing(true);
          }}
        >
          {data.label}
          {total.estimated > 0 && (
            <span className="font-semibold normal-case tracking-normal"> &middot; {formatHours(total.hours)}</span>
          )}
        </button>
      )}
    </div>
  );
}
