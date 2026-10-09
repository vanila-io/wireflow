'use client';
// The editor at /app. Layout, classes and strings follow production (module
// 98946 of build Jp7MF3_aUxMDjVuOFifu0); the diagram lives in one store
// (lib/diagram/store.ts) that enforces the diagram rules, autosaves and keeps
// the undo history.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './flow.css';
import { graphicById, type Graphic } from '@/lib/graphics';
import { isCard, type Diagram } from '@/lib/diagram/model';
import { createDiagramStore, type DiagramStore } from '@/lib/diagram/store';
import { readDiagram, readHistory, writeDiagram, writeHistory, BACKUP_KEY } from '@/lib/diagram/storage';
import FlowNode from './editor/FlowNode';
import Notices, { notice, type Notice } from './editor/Notices';
import Sidebar, { DRAG_TYPE } from './editor/Sidebar';
import { StoreContext, useStoreState } from './editor/StoreContext';
import ToolbarButton from './editor/ToolbarButton';

const nodeTypes = { flow: FlowNode };

// localStorage / sessionStorage, or null where the browser blocks them.
function browserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

// Typing in a field must not trigger canvas shortcuts.
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

type Start = { store: DiagramStore; notices: Notice[]; hadDiagram: boolean; readOnly: boolean };

// Load the autosaved diagram (production's wireflow-flow-v1), else seed the card
// from ?card=<graphicId> (the landing page's links).
function start(): Start {
  const local = browserStorage('localStorage');
  const notices: Notice[] = [];
  const loaded = local ? readDiagram(local) : ({ status: 'empty' } as const);
  let initial: Diagram = { nodes: [], edges: [] };
  let readOnly = false;

  if (loaded.status === 'loaded') {
    initial = loaded.diagram;
    const { nodes, edges, parents } = loaded.dropped;
    if (edges) notices.push(notice(`Removed ${edges} ${edges === 1 ? 'connection' : 'connections'} that didn't connect two cards.`));
    if (nodes) notices.push(notice(`Removed ${nodes} ${nodes === 1 ? 'item' : 'items'} that Wireflow can't show.`));
    if (parents) notices.push(notice(`Took ${parents} ${parents === 1 ? 'item' : 'items'} out of a group that was broken.`));
  } else if (loaded.status === 'newer') {
    initial = loaded.diagram;
    readOnly = true;
    notices.push(notice('This diagram was saved by a newer version of Wireflow. Reload the page to get it; changes made here are not saved.', 'error'));
  } else if (loaded.status === 'unreadable') {
    notices.push(notice(`Your saved diagram couldn't be read. A copy is kept in this browser's storage under "${BACKUP_KEY}".`, 'error'));
  }

  const session = browserStorage('sessionStorage');
  const store = createDiagramStore({
    initial,
    save: (json) => !readOnly && !!local && writeDiagram(local, json),
    history: session && !readOnly ? readHistory(session) : null,
  });

  const hadDiagram = initial.nodes.length > 0;
  if (!hadDiagram) {
    const card = new URLSearchParams(window.location.search).get('card');
    const g = card ? graphicById(card) : undefined;
    if (g) store.addCard(g, { x: 80, y: 120 });
  }
  return { store, notices, hadDiagram, readOnly };
}

function Editor() {
  const [{ store, notices: initialNotices, hadDiagram, readOnly }] = useState(start);
  const [notices, setNotices] = useState(initialNotices);
  const { nodes, edges, saveFailed } = useStoreState(store);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  const cards = nodes.filter(isCard).length;

  const dismiss = useCallback((id: number) => setNotices((ns) => ns.filter((n) => n.id !== id)), []);

  const addCard = useCallback(
    (g: Graphic, at?: { x: number; y: number }) => {
      const pos = at ?? screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 });
      const i = store.getState().nodes.filter(isCard).length % 5;
      store.addCard(g, { x: pos.x + 260 * i, y: pos.y + (i % 2) * 60 });
    },
    [store, screenToFlowPosition],
  );

  useEffect(() => {
    if (!hadDiagram) setTimeout(() => fitView({ padding: 0.3 }), 80);
  }, [hadDiagram, fitView]);

  // Keep the undo history across a reload of this tab.
  useEffect(() => {
    const session = browserStorage('sessionStorage');
    if (!session || readOnly) return;
    const persist = () => writeHistory(session, store.history());
    const onVisibility = () => document.visibilityState === 'hidden' && persist();
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [store, readOnly]);

  // Keyboard: H toggles the header of selected cards; Backspace/Delete removes
  // the selection; Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (!mod && !e.altKey) {
        if (k === 'h') {
          const ids = store.getState().nodes.filter((n) => n.selected && isCard(n)).map((n) => n.id);
          if (!ids.length) return;
          e.preventDefault();
          store.toggleHeaders(ids);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          if (!store.selectedIds().length) return;
          e.preventDefault();
          store.removeSelected();
        }
        return;
      }
      if (!mod) return;
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_TYPE);
      const g = id ? graphicById(id) : undefined;
      if (!g) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addCard(g, { x: p.x - 120, y: p.y - 100 });
    },
    [addCard, screenToFlowPosition],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(store.diagram(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wireflow.json';
    a.click();
    // Revoking at once can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [store]);

  const clearCanvas = useCallback(() => {
    if (store.getState().nodes.length === 0) return;
    store.clear();
    setTimeout(() => fitView({ duration: 250 }), 60);
  }, [store, fitView]);

  return (
    <StoreContext.Provider value={store}>
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
              {cards} cards · {edges.length} connections
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${saveFailed ? 'font-semibold text-rose-600' : 'text-ink-soft'}`} role="status">
              {saveFailed ? 'Not saved in this browser' : 'All changes saved'}
            </span>
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
              onNodesChange={store.onNodesChange}
              onEdgesChange={store.onEdgesChange}
              onConnect={store.onConnect}
              isValidConnection={store.isValidConnection}
              // Deleting goes through the store (one undo step for nodes and their edges).
              deleteKeyCode={null}
              defaultEdgeOptions={{ markerEnd: { type: 'arrowclosed' } }}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d7dae4" />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap pannable zoomable maskColor="rgba(240,242,245,0.8)" nodeStrokeWidth={0} />
            </ReactFlow>
            <Notices notices={notices} onDismiss={dismiss} />
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border">
              <ToolbarButton label="Undo" onClick={store.undo} />
              <ToolbarButton label="Redo" onClick={store.redo} />
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
    </StoreContext.Provider>
  );
}

const subscribeNothing = () => () => {};

export default function FlowEditor() {
  // Client-only (the diagram is in localStorage): a placeholder until hydrated, as on production.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return mounted ? (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  ) : (
    <div className="h-screen w-full bg-wire-canvas" />
  );
}
