"use client";

// A note (#83): free text in a light box that connects like a card. Double-click
// it to write (Enter adds a line; Ctrl/Cmd + Enter or a click elsewhere saves,
// Escape cancels); drag its corners or edges when selected to resize it. The Note
// panel edits the text too. A new, empty note opens for typing.
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { NOTE_BOUNDS, type NoteNode as NoteNodeType } from "@/lib/diagram/model";
import { useStore } from "./store-context";

export default function NoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const store = useStore();
  const [editing, setEditing] = useState(() => data.text === "" && !!selected);
  const input = useRef<HTMLTextAreaElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const el = input.current!;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const start = () => {
    ended.current = false;
    setEditing(true);
  };
  // As with card headers: the blur that follows Escape must not save.
  const end = (value: string | null) => {
    if (ended.current) return;
    ended.current = true;
    setEditing(false);
    if (value !== null && value !== data.text) store.setNoteText(id, value);
  };

  return (
    <div className={`flow-note ${selected ? "selected" : ""}`} data-testid="note">
      <NodeResizer
        isVisible={!!selected && !editing}
        minWidth={NOTE_BOUNDS.minWidth}
        minHeight={NOTE_BOUNDS.minHeight}
        maxWidth={NOTE_BOUNDS.maxWidth}
        maxHeight={NOTE_BOUNDS.maxHeight}
        // The blue outline shows the selection; the edges stay invisible hit areas
        // for resizing, and the corners are small white squares.
        lineStyle={{ borderColor: "transparent" }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: "#fff", border: "1.5px solid #4353ff" }}
      />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      {editing ? (
        <textarea
          ref={input}
          defaultValue={data.text}
          aria-label="Note text"
          placeholder="Write a note"
          onBlur={(e) => end(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") end(null);
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) end(e.currentTarget.value);
          }}
          className="flow-note-text nodrag nowheel nopan block w-full resize-none bg-transparent outline-none placeholder:text-ink-soft"
        />
      ) : (
        <div className="flow-note-text" onDoubleClick={start} title="Double-click to edit the note">
          {data.text || <span className="text-ink-soft">Double-click to write a note</span>}
        </div>
      )}
    </div>
  );
}
