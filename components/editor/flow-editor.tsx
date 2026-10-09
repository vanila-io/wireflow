"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import "./editor.css";
import { graphicById } from "@/lib/graphics";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import FlowNodeComp, { type FlowNodeData } from "./flow-node";
import GraphicsPanel from "./graphics-panel";

type FlowNode = Node<FlowNodeData, "flow">;
type FlowEdge = Edge;

const STORAGE_KEY = "wireflow-flow-v1";

function makeNode(g: { id: string; src: string; label: string }, x: number, y: number): FlowNode {
  return {
    id: `${g.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "flow",
    position: { x, y },
    data: { graphicId: g.id, src: g.src, label: g.label, headerText: g.label, showHeader: true },
  };
}

type Snapshot = { nodes: FlowNode[]; edges: Edge[] };


function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-wire-canvas hover:text-wire-blue"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {label === "Zoom out" && <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {label === "Zoom in" && <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {label === "Fit view" && (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Undo" && (
          <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Redo" && (
          <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Export JSON" && (
          <path d="M12 3v12M7 10l5 5 5-5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Clear canvas" && (
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

const nodeTypes = { flow: FlowNodeComp };

function EditorInner() {
  const [nodes, setNodes, onNodesStateChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesStateChange] = useEdgesState<Edge>([]);
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const didLoadRef = useRef(false);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const stateRef = useRef<Snapshot>({ nodes: [], edges: [] });
  stateRef.current = { nodes, edges };

  const commit = useCallback(
    (nextNodes: FlowNode[], nextEdges: Edge[]) => {
      history.current.past.push({ ...stateRef.current });
      history.current.future = [];
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [setNodes, setEdges]
  );

  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push({ ...stateRef.current });
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push({ ...stateRef.current });
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  const addGraphic = useCallback(
    (g: { id: string; src: string; label: string }, at?: { x: number; y: number }) => {
      const pos =
        at ??
        screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 });
      // stagger repeated adds so cards don't land on top of each other
      const step = stateRef.current.nodes.length % 5;
      const offset = { x: step * 260, y: (step % 2) * 60 };
      const node = makeNode(g, pos.x + offset.x, pos.y + offset.y);
      commit([...stateRef.current.nodes, node], stateRef.current.edges);
    },
    [commit, screenToFlowPosition]
  );

  // Initial load: saved flow from localStorage, else ?card= deep link, else empty canvas
  useEffect(() => {
    let initial: { nodes?: FlowNode[]; edges?: Edge[] } | null = null;
    try {
      initial = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      initial = null;
    }
    if (initial?.nodes?.length) {
      setNodes(initial.nodes);
      setEdges(initial.edges ?? []);
  } else {
      const cardId = new URLSearchParams(window.location.search).get("card");
      const g = cardId ? graphicById(cardId) : undefined;
      if (g) {
        const node = makeNode(g, 80, 120);
        setNodes([node]);
      }
      setTimeout(() => fitView({ padding: 0.3 }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave
  useEffect(() => {
    if (!didLoadRef.current) {
      didLoadRef.current = true;
      return;
    }
    setSaved("saving");
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
      setSaved("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  // Undo/redo keyboard shortcuts (react-flow handles Delete/Backspace natively)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (!mod) {
        // H toggles the header on every selected card (original wireflow behavior)
        if (e.key.toLowerCase() === "h") {
          const selected = stateRef.current.nodes.filter((n) => n.selected);
          if (!selected.length) return;
          e.preventDefault();
          setNodes((ns) =>
            ns.map((n) =>
              n.selected
                ? { ...n, data: { ...n.data, showHeader: (n.data as FlowNodeData).showHeader === false } }
                : n
            )
          );
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("application/wireflow-card");
      const g = id ? graphicById(id) : undefined;
      if (!g) return;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addGraphic(g, { x: pos.x - 120, y: pos.y - 100 });
    },
    [addGraphic, screenToFlowPosition]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      if (changes.some((c) => c.type === "remove")) {
        history.current.past.push({ ...stateRef.current });
        history.current.future = [];
      }
      onNodesStateChange(changes);
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === "remove")) {
        history.current.past.push({ ...stateRef.current });
        history.current.future = [];
      }
      onEdgesStateChange(changes);
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      history.current.past.push({ ...stateRef.current });
      history.current.future = [];
      setEdges((eds) =>
        addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      );
    },
    [setEdges]
  );

  const exportJson = useCallback(() => {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wireflow.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const clearCanvas = useCallback(() => {
    if (stateRef.current.nodes.length === 0) return;
    commit([], []);
    setTimeout(() => fitView({ duration: 250 }), 60);
  }, [commit, fitView]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-wire-border bg-white px-4">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 34 34" fill="none" aria-hidden>
              <rect x="7" y="7" width="20" height="20" rx="4" transform="rotate(45 17 17)" stroke="#4353FF" strokeWidth="2.5" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="#4353FF" />
            </svg>
            <span className="text-sm font-bold text-ink">Wireflow</span>
          </a>
          <span className="text-xs text-ink-soft">
            {nodes.length} cards &middot; {edges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft">
            {saved === "saved" ? "All changes saved" : "Saving..."}
          </span>
          <button
            onClick={exportJson}
            className="rounded-md bg-wire-blue px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark"
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <GraphicsPanel onAddCard={(g) => addGraphic(g)} />
        <div
          className="relative min-w-0 flex-1"
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
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
              history.current.past.push({ ...stateRef.current });
              history.current.future = [];
            }}
            deleteKeyCode={["Backspace", "Delete"]}
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
                ["Zoom in", "Ctrl + ="],
                ["Zoom out", "Ctrl + -"],
                ["Undo", "Ctrl + Z"],
                ["Redo", "Ctrl + Y"],
                ["Toggle header", "H"],
                ["Edit header", "Double-click"],
                ["Delete selected", "Backspace"],
              ].map(([action, keys]) => (
                <div key={action} className="flex items-center justify-between">
                  <dt className="text-ink-soft">{action}</dt>
                  <dd className="font-semibold text-rose-500">{keys}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 text-sm font-bold text-ink">How it works</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-5 text-ink-soft">
              <li>Drag a graphic from the left panel onto the canvas</li>
              <li>Hover a card, grab its bottom dot and drop it on another card to connect them</li>
              <li>Double-click a card&rsquo;s header to rename it, press H to hide/show it</li>
              <li>Click a card and press Backspace to remove it</li>
              <li>Your flow autosaves in this browser</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}




export default function Editor() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-screen w-full bg-wire-canvas" />;
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
