'use client';
// A group: a labelled frame that always wraps its members (see lib/diagram/groups.ts).
// Double-click the label to rename it. Like cards, it can be connected.
import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GroupNode as GroupNodeT } from '@/lib/diagram/model';
import { useStore, useStoreState } from './StoreContext';

export default function GroupNode({ id, data, selected }: NodeProps<GroupNodeT>) {
  const store = useStore();
  const { dropTarget } = useStoreState(store);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ended = useRef(false);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  const end = (value: string | null) => {
    if (ended.current) return;
    ended.current = true;
    setEditing(false);
    if (value !== null) store.setGroupLabel(id, value);
  };
  return (
    <div className={`flow-group ${selected ? 'selected' : ''} ${dropTarget === id ? 'drop-target' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      {editing ? (
        <input
          ref={inputRef}
          defaultValue={data.label}
          aria-label="Group label"
          onBlur={(e) => end(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') end(e.currentTarget.value);
            if (e.key === 'Escape') end(null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flow-group-label w-48 bg-white outline-none"
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
        </button>
      )}
    </div>
  );
}
