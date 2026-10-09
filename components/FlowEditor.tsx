'use client';
// The editor at /app. Layout, classes and strings follow production (module
// 98946 of build Jp7MF3_aUxMDjVuOFifu0); the diagram lives in one store
// (lib/diagram/store.ts) that enforces the diagram rules, autosaves and keeps
// the undo history.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { DiagramFileError, FILE_NAME, MAX_FILE_BYTES, parseFile, parseLegacyStorage, serializeFile } from '@/lib/diagram/file';
import { serialize, type Dropped } from '@/lib/diagram/rules';
import ConfirmDialog from './editor/ConfirmDialog';
import { LOAD_FAILED, PanelBoundary, useAiPanel } from './ai/useAiPanel';
import EdgePanel from './editor/EdgePanel';
import FlowNode from './editor/FlowNode';
import GroupNode from './editor/GroupNode';
import Notices, { notice, type Notice } from './editor/Notices';
import Sidebar, { DRAG_TYPE } from './editor/Sidebar';
import { StoreContext, useStoreState } from './editor/StoreContext';
import ToolbarButton from './editor/ToolbarButton';

const nodeTypes = { flow: FlowNode, group: GroupNode };

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

// Where the previous editor autosaved (gg-editor's G6 format).
const LEGACY_STORAGE_KEY = 'data';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What the rules dropped from a loaded or opened diagram, in words.
function droppedNotices({ nodes, edges, parents }: Dropped): Notice[] {
  return [
    edges && notice(`Removed ${plural(edges, 'connection', 'connections')} that didn't connect two cards.`),
    nodes && notice(`Removed ${plural(nodes, 'item', 'items')} that Wireflow can't show.`),
    parents && notice(`Took ${plural(parents, 'item', 'items')} out of a group that was broken.`),
  ].filter((n): n is Notice => !!n);
}

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
    notices.push(...droppedNotices(loaded.dropped));
  } else if (loaded.status === 'empty' && local) {
    // The previous editor (gg-editor) autosaved to localStorage['data']. Bring that
    // diagram over once; the old entry is left as it is.
    const old = parseLegacyStorage(local.getItem(LEGACY_STORAGE_KEY) ?? 'null');
    if (old && writeDiagram(local, serialize(old))) {
      initial = old;
      notices.push(notice('Brought over the diagram from the previous Wireflow editor in this browser.'));
    }
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
  // Selection actions (recomputed on every store change, which includes selection).
  const canGroupNow = !!store.groupable();
  const groupSelected = !!store.selectedGroup();
  // The edge panel shows for exactly one selected edge and nothing else selected.
  const selectedEdges = edges.filter((e) => e.selected);
  const selectedEdge = selectedEdges.length === 1 && !nodes.some((n) => n.selected) ? selectedEdges[0] : null;
  // How edges are drawn (not stored): coloured edges keep their colour when
  // selected, so they get a class that marks the selection another way.
  const shownEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        ...(e.style?.stroke && { className: 'colored' }),
        ...(e.label && { labelStyle: { fill: '#6b6875', fontSize: 11, fontWeight: 600 }, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 4 }),
      })),
    [edges],
  );

  const dismiss = useCallback((id: number) => setNotices((ns) => ns.filter((n) => n.id !== id)), []);
  const ai = useAiPanel();

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
      } else if (k === 'g') {
        e.preventDefault();
        if (e.shiftKey) store.ungroup();
        else store.group();
      } else if (k === 'c') {
        // Leave text selections to the browser.
        if (window.getSelection()?.toString()) return;
        if (store.copy()) e.preventDefault();
      } else if (k === 'v') {
        e.preventDefault();
        store.paste();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // A template dragged with a finger from the sidebar (HTML drag and drop is mouse-only).
  const canvas = useRef<HTMLDivElement>(null);
  const touchDrop = useCallback(
    (g: Graphic, point: { x: number; y: number }) => {
      const r = canvas.current?.getBoundingClientRect();
      if (!r || point.x < r.left || point.x > r.right || point.y < r.top || point.y > r.bottom) return;
      const p = screenToFlowPosition(point);
      addCard(g, { x: p.x - 120, y: p.y - 100 });
    },
    [addCard, screenToFlowPosition],
  );

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
    const blob = new Blob([serializeFile(store.diagram())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    // Revoking at once can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [store]);

  // Open file: check the file, ask before replacing a diagram, then replace it as
  // one undo step. If the browser can't store it, the current diagram stays.
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingOpen, setPendingOpen] = useState<{ name: string; diagram: Diagram; dropped: Dropped } | null>(null);
  const say = useCallback((n: Notice) => setNotices((ns) => [...ns.slice(-3), n]), []);

  const replaceWith = useCallback(
    ({ name, diagram, dropped }: { name: string; diagram: Diagram; dropped: Dropped }) => {
      setPendingOpen(null);
      if (!store.replace(diagram, 'open')) {
        say(notice(`Couldn't open ${name}. It's too big to keep in this browser's storage, so your diagram is unchanged.`, 'error'));
        return;
      }
      setNotices((ns) => [...ns.slice(-2), notice(`Opened ${name}.`), ...droppedNotices(dropped)]);
      setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 60);
    },
    [store, say, fitView],
  );

  const openFile = useCallback(
    async (file: File) => {
      let parsed;
      try {
        if (file.size > MAX_FILE_BYTES) throw new DiagramFileError("It's too big to be a Wireflow diagram.");
        parsed = { name: file.name, ...parseFile(await file.text()) };
      } catch (err) {
        const reason = err instanceof DiagramFileError ? err.message : "It couldn't be read.";
        say(notice(`Couldn't open ${file.name}. ${reason}`, 'error'));
        return;
      }
      if (store.getState().nodes.length) setPendingOpen(parsed);
      else replaceWith(parsed);
    },
    [store, say, replaceWith],
  );
  const chooseFile = useCallback(() => fileInput.current?.click(), []);

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
            <span className="hidden text-xs text-ink-soft sm:inline">
              {cards} cards · {edges.length} connections
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* On a phone only a failed save is shown; the header has no room for more. */}
            <span className={`text-xs ${saveFailed ? 'font-semibold text-rose-600' : 'hidden text-ink-soft sm:inline'}`} role="status">
              {saveFailed ? 'Not saved in this browser' : 'All changes saved'}
            </span>
            <button
              onClick={() => void ai.toggle()}
              aria-expanded={ai.open}
              aria-label={ai.failed ? LOAD_FAILED : 'AI assistant'}
              title={ai.failed ? LOAD_FAILED : 'AI assistant (your own Anthropic key)'}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 transition ${ai.failed ? 'text-rose-600 ring-rose-300' : 'text-wire-blue ring-wire-blue/40 hover:bg-wire-lavender'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
              </svg>
              AI
            </button>
            <button
              onClick={chooseFile}
              title="Open a wireflow.json file"
              className="hidden rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-wire-blue ring-1 ring-wire-blue/40 transition hover:bg-wire-lavender sm:block"
            >
              Open file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Diagram file to open"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void openFile(file);
              }}
            />
            <button onClick={exportJson} title="Save the diagram as wireflow.json" className="hidden rounded-md bg-wire-blue px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark sm:block">
              Export JSON
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Sidebar onAddCard={(g) => addCard(g)} onTouchDrop={touchDrop} />
          <div
            ref={canvas}
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
              edges={shownEdges}
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
            {ai.Panel && (
              <PanelBoundary>
                <ai.Panel open={ai.open} onClose={ai.close} />
              </PanelBoundary>
            )}
            <Notices notices={notices} onDismiss={dismiss} />
            <ConfirmDialog
              open={!!pendingOpen}
              title="Replace the current diagram?"
              confirmLabel="Replace"
              onConfirm={() => pendingOpen && replaceWith(pendingOpen)}
              onCancel={() => setPendingOpen(null)}
            >
              {pendingOpen?.name} will replace what is on the canvas. You can undo this.
            </ConfirmDialog>
            {(canGroupNow || groupSelected) && (
              <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white px-2 py-1.5 text-xs font-semibold shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border">
                {canGroupNow && (
                  <button onClick={store.group} className="rounded-md px-3 py-1.5 text-ink hover:bg-wire-canvas hover:text-wire-blue">
                    Group
                  </button>
                )}
                {groupSelected && (
                  <button onClick={store.ungroup} className="rounded-md px-3 py-1.5 text-ink hover:bg-wire-canvas hover:text-wire-blue">
                    Ungroup
                  </button>
                )}
              </div>
            )}
            <div className="absolute bottom-5 left-1/2 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border">
              <ToolbarButton label="Undo" onClick={store.undo} />
              <ToolbarButton label="Redo" onClick={store.redo} />
              <span className="mx-1 h-5 w-px bg-wire-border" />
              <ToolbarButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })} />
              <ToolbarButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })} />
              <ToolbarButton label="Fit view" onClick={() => fitView({ duration: 250, padding: 0.2 })} />
              <span className="mx-1 h-5 w-px bg-wire-border" />
              <ToolbarButton label="Open file" onClick={chooseFile} />
              <ToolbarButton label="Export JSON" onClick={exportJson} />
              <ToolbarButton label="Clear canvas" onClick={clearCanvas} />
            </div>
            {selectedEdge ? (
              <EdgePanel edge={selectedEdge} edges={edges} />
            ) : (
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
                  ['Group / ungroup', 'Ctrl + G / ⇧G'],
                  ['Copy / paste', 'Ctrl + C / V'],
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
            )}
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
