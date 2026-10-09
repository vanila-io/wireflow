"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

export type FlowNodeData = {
  graphicId: string;
  src: string;
  label: string;
  headerText?: string;
  showHeader?: boolean;
};

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

  const commit = (value: string) => {
    updateNodeData(id, { headerText: value.trim() || d.label });
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
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit(e.currentTarget.value);
                if (e.key === "Escape") setEditing(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-center text-[10px] font-semibold text-[#94a4a5] outline-none"
            />
          ) : (
            <button
              onDoubleClick={() => setEditing(true)}
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
      <img src={d.src} alt={d.label} draggable={false} className="flow-node-img" />
    </div>
  );
}
