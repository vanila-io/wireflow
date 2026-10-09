'use client';
// Reconstructed by hand from production module 98946 (chunk 1vql142v-hngy.js, build Jp7MF3_aUxMDjVuOFifu0).
// Logic, class names, strings and constants are taken verbatim from the minified bundle;
// identifiers are renamed. @xyflow/react was inlined into the same module in production.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './flow.css';
import { categoryLabels, graphicById, graphicsByCategory, type Graphic } from '@/lib/graphics';

const STORAGE_KEY = 'wireflow-flow-v1';

type FlowData = { graphicId: string; src: string; label: string; headerText?: string; showHeader?: boolean };
type FlowNodeT = Node<FlowData, 'flow'>;

function makeNode(g: Graphic, x: number, y: number): FlowNodeT {
  return {
    id: `${g.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'flow',
    position: { x, y },
    data: { graphicId: g.id, src: g.src, label: g.label, headerText: g.label, showHeader: true },
  };
}

function Sidebar({ onAddCard }: { onAddCard: (g: Graphic) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const items = useMemo(() => {
    let list = graphicsByCategory(category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((g) => g.label.toLowerCase().includes(q) || g.categoryLabel.toLowerCase().includes(q));
    return list;
  }, [query, category]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-wire-border bg-white">
      <div className="border-b border-wire-border p-3">
        <div className="relative">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search graphics"
            className="w-full rounded-md border border-wire-border bg-wire-canvas/60 px-3 py-2 pl-8 text-sm outline-none placeholder:text-ink-soft focus:border-wire-blue focus:bg-white"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ slug: 'all', label: 'All' }, ...categoryLabels].map((c) => (
            <button
              key={c.slug}
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${category === c.slug ? 'bg-wire-blue text-white' : 'bg-wire-canvas text-ink-soft hover:text-wire-blue'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {items.map((g) => (
          <button
            key={g.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/wireflow-card', g.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => onAddCard(g)}
            title={`${g.label} - drag onto canvas or click to add`}
            className="cursor-grab rounded-md border border-wire-border bg-white p-2 transition hover:border-wire-blue/50 hover:shadow-md active:cursor-grabbing"
          >
            <img src={g.src} alt={g.label} className="h-auto w-full" />
          </button>
        ))}
        {items.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-ink-soft">No graphics match “{query}”</p>}
      </div>
    </aside>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  const p = { stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-wire-canvas hover:text-wire-blue">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {label === 'Zoom out' && <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {label === 'Zoom in' && <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {label === 'Fit view' && <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...p} />}
        {label === 'Undo' && <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" {...p} />}
        {label === 'Redo' && <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" {...p} />}
        {label === 'Export JSON' && <path d="M12 3v12M7 10l5 5 5-5M4 19h16" {...p} />}
        {label === 'Clear canvas' && <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" {...p} />}
      </svg>
    </button>
  );
}

function FlowNode({ id, data }: NodeProps<FlowNodeT>) {
  const { updateNodeData } = useReactFlow();
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
  const commit = (value: string) => {
    updateNodeData(id, { headerText: value.trim() || data.label });
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
              defaultValue={header}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(e.currentTarget.value);
                if (e.key === 'Escape') setEditing(false);
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
      <img src={data.src} alt={data.label} draggable={false} className="flow-node-img" />
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

type Snapshot = { nodes: Node[]; edges: Edge[] };

function Editor() {
  const [nodes, setNodes, applyNodes] = useNodesState<Node>([]);
  const [edges, setEdges, applyEdges] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const skippedFirstSave = useRef(false);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const current = useRef<Snapshot>({ nodes: [], edges: [] });
  // Production logic, kept verbatim in this file; the next commit replaces it with a store.
  // eslint-disable-next-line react-hooks/refs
  current.current = { nodes, edges };

  const commit = useCallback(
    (n: Node[], e: Edge[]) => {
      history.current.past.push({ ...current.current });
      history.current.future = [];
      setNodes(n);
      setEdges(e);
    },
    [setNodes, setEdges],
  );
  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push({ ...current.current });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push({ ...current.current });
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  const addCard = useCallback(
    (g: Graphic, at?: { x: number; y: number }) => {
      const pos = at ?? screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 });
      const i = current.current.nodes.length % 5;
      const offset = { x: 260 * i, y: (i % 2) * 60 };
      commit([...current.current.nodes, makeNode(g, pos.x + offset.x, pos.y + offset.y)], current.current.edges);
    },
    [commit, screenToFlowPosition],
  );

  // Load from localStorage, else seed from ?card=<graphicId> (links on the landing page).
  useEffect(() => {
    let saved: Snapshot | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved?.nodes?.length) {
      setNodes(saved.nodes);
      setEdges(saved.edges ?? []);
    } else {
      const card = new URLSearchParams(window.location.search).get('card');
      const g = card ? graphicById(card) : undefined;
      if (g) setNodes([makeNode(g, 80, 120)]);
      setTimeout(() => fitView({ padding: 0.3 }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!skippedFirstSave.current) {
      skippedFirstSave.current = true;
      return;
    }
    setStatus('saving');
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
      setStatus('saved');
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  // Keyboard: H toggles header of selected cards; Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (!mod) {
        if (e.key.toLowerCase() === 'h') {
          if (!current.current.nodes.filter((n) => n.selected).length) return;
          e.preventDefault();
          setNodes((ns) => ns.map((n) => (n.selected ? { ...n, data: { ...n.data, showHeader: n.data.showHeader === false } } : n)));
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, setNodes]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('application/wireflow-card');
      const g = id ? graphicById(id) : undefined;
      if (!g) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addCard(g, { x: p.x - 120, y: p.y - 100 });
    },
    [addCard, screenToFlowPosition],
  );
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) {
        history.current.past.push({ ...current.current });
        history.current.future = [];
      }
      applyNodes(changes);
    },
    // production deps array was [setNodes]
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) {
        history.current.past.push({ ...current.current });
        history.current.future = [];
      }
      applyEdges(changes);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setEdges],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      history.current.past.push({ ...current.current });
      history.current.future = [];
      setEdges((eds) => addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [setEdges],
  );
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wireflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);
  const clearCanvas = useCallback(() => {
    if (current.current.nodes.length === 0) return;
    commit([], []);
    setTimeout(() => fitView({ duration: 250 }), 60);
  }, [commit, fitView]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-wire-border bg-white px-4">
        <div className="flex items-center gap-4">
          {/* Production does a full page load here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 34 34" fill="none" aria-hidden>
              <rect x="7" y="7" width="20" height="20" rx="4" transform="rotate(45 17 17)" stroke="#4353FF" strokeWidth="2.5" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="#4353FF" />
            </svg>
            <span className="text-sm font-bold text-ink">Wireflow</span>
          </a>
          <span className="text-xs text-ink-soft">
            {nodes.length} cards · {edges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft">{status === 'saved' ? 'All changes saved' : 'Saving...'}</span>
          <button onClick={exportJson} className="rounded-md bg-wire-blue px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark">
            Export JSON
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <Sidebar onAddCard={(g) => addCard(g)} />
        <div
          className="relative min-w-0 flex-1"
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
        >
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={() => {
              history.current.past.push({ ...current.current });
              history.current.future = [];
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d7dae4" />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(240,242,245,0.8)" nodeStrokeWidth={0} />
          </ReactFlow>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border">
            <ToolbarButton label="Undo" onClick={undo} />
            <ToolbarButton label="Redo" onClick={redo} />
            <span className="mx-1 h-5 w-px bg-wire-border" />
            <ToolbarButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })} />
            <ToolbarButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })} />
            <ToolbarButton label="Fit view" onClick={() => fitView({ duration: 250, padding: 0.2 })} />
            <span className="mx-1 h-5 w-px bg-wire-border" />
            <ToolbarButton label="Export JSON" onClick={exportJson} />
            <ToolbarButton label="Clear canvas" onClick={clearCanvas} />
          </div>
          <aside className="absolute right-4 top-4 hidden w-60 rounded-xl bg-white p-4 shadow-lg ring-1 ring-wire-border lg:block">
            <h3 className="text-sm font-bold text-ink">Keyboard shortcuts</h3>
            <dl className="mt-3 space-y-2 text-xs">
              {[
                ['Zoom in', 'Ctrl + ='],
                ['Zoom out', 'Ctrl + -'],
                ['Undo', 'Ctrl + Z'],
                ['Redo', 'Ctrl + Y'],
                ['Toggle header', 'H'],
                ['Edit header', 'Double-click'],
                ['Delete selected', 'Backspace'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="font-semibold text-rose-500">{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 text-sm font-bold text-ink">How it works</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-5 text-ink-soft">
              <li>Drag a graphic from the left panel onto the canvas</li>
              <li>Hover a card, grab its bottom dot and drop it on another card to connect them</li>
              <li>Double-click a card’s header to rename it, press H to hide/show it</li>
              <li>Click a card and press Backspace to remove it</li>
              <li>Your flow autosaves in this browser</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function FlowEditor() {
  // Client-only: render a placeholder until mounted (production does the same).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted ? (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  ) : (
    <div className="h-screen w-full bg-wire-canvas" />
  );
}
