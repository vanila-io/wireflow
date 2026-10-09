'use client';
// A template card, as on production: an editable header (double-click; H hides
// it) above the graphic, a target handle on top and a source handle below.
import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cardSize, CARD_WIDTH, type CardNode } from '@/lib/diagram/model';
import { useStore } from './StoreContext';

// The graphic's drawn size inside the card's 1px border.
const IMG_WIDTH = CARD_WIDTH - 2;
const imgHeight = (graphicId: string) => Math.round(cardSize({ graphicId, showHeader: false }).height - 2);

export default function FlowNode({ id, data }: NodeProps<CardNode>) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showHeader = data.showHeader !== false;
  const header = data.headerText ?? data.label;
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  // Enter and Escape end the edit; the blur that follows must not commit again
  // (after Escape it would save what was just cancelled).
  const ended = useRef(false);
  const end = (value: string | null) => {
    if (ended.current) return;
    ended.current = true;
    setEditing(false);
    if (value !== null) store.setHeaderText(id, value);
  };
  const start = () => {
    ended.current = false;
    setEditing(true);
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
              defaultValue={header}
              aria-label="Card header"
              onBlur={(e) => end(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') end(e.currentTarget.value);
                if (e.key === 'Escape') end(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-center text-[10px] font-semibold text-[#94a4a5] outline-none"
            />
          ) : (
            <button
              onDoubleClick={start}
              onPointerDown={(e) => e.stopPropagation()}
              title="Double-click to edit header - select card and press H to hide"
              className="w-full truncate text-center text-[10px] font-semibold text-[#94a4a5]"
            >
              {header.length > 23 ? `${header.slice(0, 20)}...` : header}
            </button>
          )}
          <span className="flow-node-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      {/* Its size is known before it loads (width/height set the aspect ratio), so the card
          and its handles never move when the image arrives. */}
      <img src={data.src} alt={data.label} draggable={false} className="flow-node-img" width={IMG_WIDTH} height={imgHeight(data.graphicId)} />
    </div>
  );
}
