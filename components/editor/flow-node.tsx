"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { CARD_WIDTH, cardSize } from "@/lib/diagram/model";

export type FlowNodeData = {
  graphicId: string;
  src: string;
  label: string;
  headerText?: string;
  showHeader?: boolean;
};

// The graphic's drawn size inside the card's 1px border. Known before the image
// loads (width/height set its aspect ratio), so the card and its handles never
// move when it arrives.
const IMG_WIDTH = CARD_WIDTH - 2;
const imgHeight = (graphicId: string) => Math.round(cardSize({ graphicId, showHeader: false }).height - 2);

function truncateLabel(label: string): string {
  return label.length > 23 ? `${label.slice(0, 20)}...` : label;
}

export default function FlowNode({ id, data }: NodeProps) {
  const d = data as unknown as FlowNodeData;
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showHeader = d.showHeader !== false;
  const headerText = d.headerText ?? d.label;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Enter and Escape end the edit; the blur that follows when the input goes
  // away must not commit again (after Escape it would save what was cancelled).
  const ended = useRef(false);
  const startEditing = () => {
    ended.current = false;
    setEditing(true);
  };
  const end = (value: string | null) => {
    if (ended.current) return;
    ended.current = true;
    if (value !== null) updateNodeData(id, { headerText: value.trim() || d.label });
    setEditing(false);
  };

  return (
    <div className="flow-node group relative">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      {showHeader && (
        <div className="flow-node-header">
          {editing ? (
            <input
              ref={inputRef}
              defaultValue={headerText}
              aria-label="Card header"
              onBlur={(e) => end(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") end(e.currentTarget.value);
                if (e.key === "Escape") end(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-center text-[10px] font-semibold text-[#94a4a5] outline-none"
            />
          ) : (
            <button
              onDoubleClick={startEditing}
              onPointerDown={(e) => e.stopPropagation()}
              title="Double-click to edit header - select card and press H to hide"
              className="w-full truncate text-center text-[10px] font-semibold text-[#94a4a5]"
            >
              {truncateLabel(headerText)}
            </button>
          )}
          <span className="flow-node-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={d.src}
        alt={d.label}
        draggable={false}
        className="flow-node-img"
        width={IMG_WIDTH}
        height={imgHeight(d.graphicId)}
      />
    </div>
  );
}
