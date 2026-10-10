"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "@xyflow/react/dist/style.css";
import "./editor.css";
import { graphicById, type Graphic } from "@/lib/graphics";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { DiagramFileError, FILE_NAME, MAX_FILE_BYTES, parseFile, serializeFile, type Opened } from "@/lib/diagram/file";
import { isGroup, STORAGE_KEY, type Diagram } from "@/lib/diagram/model";
import type { Dropped } from "@/lib/diagram/rules";
import { createDiagramStore, type DiagramStore } from "@/lib/diagram/store";
import { readDiagram, readHistory, writeDiagram, writeHistory } from "@/lib/diagram/storage";
import { Group, ImageDown, Sparkles, Ungroup } from "lucide-react";
import { LOAD_FAILED, PanelBoundary, useAiPanel } from "@/components/ai/use-ai-panel";
import ConfirmDialog from "./confirm-dialog";
import EdgePanel from "./edge-panel";
import FlowNodeComp from "./flow-node";
import GraphicsPanel from "./graphics-panel";
import GroupNodeComp from "./group-node";
import GroupPanel from "./group-panel";
import { download, renderImage, type ImageFormat } from "./export-image";
import Menu from "./menu";
import Notices, { notice, type Notice } from "./notices";
import { StoreContext, useStoreState } from "./store-context";
import UpdatePrompt from "./update-prompt";

// localStorage / sessionStorage, or null where the browser blocks them.
function browserStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

// Typing in a field, or using a panel that opts out (the AI assistant), must
// not trigger canvas shortcuts.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    !!target.closest("[data-no-shortcuts]"));

// A panel control that holds no text (the width slider, the line menu, the
// colour picker): Undo and Redo still reach the diagram from it, other
// shortcuts don't (Backspace there must not delete the selected connection).
const isControl = (target: EventTarget | null) =>
  (target instanceof HTMLInputElement && ["range", "color", "checkbox", "radio"].includes(target.type)) ||
  target instanceof HTMLSelectElement;

const NEWER =
  "This diagram was saved by a newer version of Wireflow. Reload the page to get it; changes made here are not saved.";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What the rules dropped from a loaded diagram, in words.
function droppedNotices({ nodes, edges, parents }: Dropped): Notice[] {
  return [
    edges && notice(`Removed ${plural(edges, "connection", "connections")} that didn't connect two cards.`),
    nodes && notice(`Removed ${plural(nodes, "item", "items")} that Wireflow can't show.`),
    parents && notice(`Took ${plural(parents, "item", "items")} out of a group that was broken.`),
  ].filter((n): n is Notice => !!n);
}

// `lock.readOnly`: this tab must not write (a newer version saved the diagram,
// or part of it couldn't be kept); it can change while the editor is open.
type Start = { store: DiagramStore; notices: Notice[]; hadDiagram: boolean; lock: { readOnly: boolean } };

// Initial load: the saved flow from localStorage, else the ?card= deep link,
// else an empty canvas. Every write goes through the store's save boundary.
function start(): Start {
  const local = browserStorage("localStorage");
  const notices: Notice[] = [];
  const loaded = local ? readDiagram(local) : ({ status: "empty" } as const);
  let initial: Diagram = { nodes: [], edges: [] };
  const lock = { readOnly: false };

  if (loaded.status === "loaded") {
    initial = loaded.diagram;
    notices.push(...droppedNotices(loaded.dropped));
    if (loaded.backup) {
      notices.push(notice(`The diagram as it was saved is kept in this browser's storage under "${loaded.backup}".`));
    }
    if (!loaded.kept) {
      lock.readOnly = true;
      notices.push(
        notice(
          "Part of your saved diagram couldn't be shown, and this browser's storage refused a copy of it, so this tab won't save over it.",
          "error"
        )
      );
    }
  } else if (loaded.status === "newer") {
    initial = loaded.diagram;
    lock.readOnly = true;
    notices.push(notice(NEWER, "error"));
  } else if (loaded.status === "unreadable") {
    if (loaded.backup) {
      notices.push(
        notice(`Your saved diagram couldn't be read. A copy is kept in this browser's storage under "${loaded.backup}".`, "error")
      );
    } else {
      lock.readOnly = true;
      notices.push(
        notice(
          "Your saved diagram couldn't be read, and this browser's storage refused a copy of it, so this tab won't save over it.",
          "error"
        )
      );
    }
  }

  const session = browserStorage("sessionStorage");
  const store = createDiagramStore({
    initial,
    save: (json) => !lock.readOnly && !!local && writeDiagram(local, json),
    // The undo history of this tab, if it ends at the diagram just loaded.
    history: session && !lock.readOnly ? readHistory(session) : null,
  });

  const hadDiagram = initial.nodes.length > 0;
  if (!hadDiagram) {
    const cardId = new URLSearchParams(window.location.search).get("card");
    const g = cardId ? graphicById(cardId) : undefined;
    if (g) store.addCard(g, { x: 80, y: 120 });
  }
  return { store, notices, hadDiagram, lock };
}


// Production's toolbar buttons draw their own icons; the ones added since pass a
// lucide `icon`. A button whose command can't run now is disabled, as in the
// earlier editor's toolbar. `title` adds the shortcut to the tooltip.
function ToolbarButton({
  label,
  onClick,
  icon,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-wire-canvas hover:text-wire-blue disabled:pointer-events-none disabled:opacity-35"
    >
      {icon ?? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
        {label === "Open file" && (
          <path d="M12 21V9M7 14l5-5 5 5M4 5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Export JSON" && (
          <path d="M12 3v12M7 10l5 5 5-5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {label === "Clear canvas" && (
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>}
    </button>
  );
}

const nodeTypes = { flow: FlowNodeComp, group: GroupNodeComp };

function EditorInner({ loaded }: { loaded: Start }) {
  const { store, notices: initialNotices, hadDiagram, lock } = loaded;
  const [notices, setNotices] = useState(initialNotices);
  const { nodes, edges, saveFailed } = useStoreState(store);
  // The connection panel shows for exactly one selected edge and nothing else selected.
  const selectedEdges = edges.filter((e) => e.selected);
  const selectedEdge = selectedEdges.length === 1 && !nodes.some((n) => n.selected) ? selectedEdges[0] : null;
  // The group panel shows for exactly one selected group and nothing else selected.
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedGroup =
    selectedNodes.length === 1 && isGroup(selectedNodes[0]) && !selectedEdges.length ? selectedNodes[0] : null;
  const canGroup = !!store.groupable();
  const canUngroup = !!store.selectedGroup();
  // How edges are drawn (not stored): an edge with a colour of its own keeps it
  // when selected, so it gets a class that marks the selection another way.
  const shownEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        ...(e.style?.stroke && { className: "colored" }),
        ...(e.label && {
          labelStyle: { fill: "#6b6875", fontSize: 11, fontWeight: 600 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        }),
      })),
    [edges]
  );
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, getNodes, getNodesBounds } = useReactFlow();

  const dismiss = useCallback((id: number) => setNotices((ns) => ns.filter((n) => n.id !== id)), []);
  const say = useCallback((n: Notice) => setNotices((ns) => [...ns.slice(-3), n]), []);
  const ai = useAiPanel();

  const addGraphic = useCallback(
    (g: Graphic, at?: { x: number; y: number }) => {
      const pos =
        at ??
        screenToFlowPosition({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 });
      // stagger repeated adds so cards don't land on top of each other; a card
      // dropped at a point (mouse or finger) lands where it was dropped
      const step = at ? 0 : store.getState().nodes.length % 5;
      const offset = { x: step * 260, y: (step % 2) * 60 };
      store.addCard(g, { x: pos.x + offset.x, y: pos.y + offset.y });
    },
    [store, screenToFlowPosition]
  );

  useEffect(() => {
    if (!hadDiagram) setTimeout(() => fitView({ padding: 0.3 }), 80);
  }, [hadDiagram, fitView]);

  // Keep the undo history across a reload of this tab.
  useEffect(() => {
    const session = browserStorage("sessionStorage");
    if (!session) return;
    const persist = () => !lock.readOnly && writeHistory(session, store.history());
    const onVisibility = () => document.visibilityState === "hidden" && persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [store, lock]);

  // Another tab saved the diagram: show its version here, so this tab's next
  // save doesn't overwrite it with an older one. A newer version of Wireflow in
  // the other tab makes this one read-only.
  useEffect(() => {
    const local = browserStorage("localStorage");
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.storageArea !== local || !local || e.newValue === null) return;
      const loaded = readDiagram(local);
      if (loaded.status === "newer") {
        lock.readOnly = true;
        store.adopt(loaded.diagram);
        say(notice(NEWER, "error"));
      } else if (loaded.status === "loaded" && !lock.readOnly) {
        store.adopt(loaded.diagram);
        say(notice("Updated with the changes made in another tab."));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store, lock, say]);

  // Keyboard: H toggles the header of selected cards; Backspace/Delete removes
  // the selection (cards with their connections, as one undo step);
  // Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo; Ctrl/Cmd+C and V
  // copy and paste cards (a paste is one undo step).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (isTyping(e.target) && !(isControl(e.target) && mod && (k === "z" || k === "y"))) return;
      if (!mod) {
        if (e.altKey) return;
        // H toggles the header on every selected card (original wireflow behavior)
        if (k === "h") {
          const ids = store.getState().nodes.filter((n) => n.selected).map((n) => n.id);
          if (!ids.length) return;
          e.preventDefault();
          store.toggleHeaders(ids);
        } else if (e.key === "Backspace" || e.key === "Delete") {
          if (!store.selectedIds().length) return;
          e.preventDefault();
          store.removeSelected();
        }
        return;
      }
      if (k === "g") {
        // Only when there is something to (un)group; otherwise the browser keeps
        // Ctrl+G (find next).
        if (e.shiftKey ? store.ungroup() : store.group()) e.preventDefault();
        return;
      }
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        store.redo();
      } else if (k === "c") {
        // Leave text selections to the browser.
        if (window.getSelection()?.toString()) return;
        if (store.copy()) e.preventDefault();
      } else if (k === "v") {
        if (store.paste()) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  // A template dragged with a finger from the sidebar, dropped on the canvas.
  const canvas = useRef<HTMLDivElement>(null);
  const touchDrop = useCallback(
    (g: Graphic, point: { x: number; y: number }) => {
      const r = canvas.current?.getBoundingClientRect();
      if (!r || point.x < r.left || point.x > r.right || point.y < r.top || point.y > r.bottom) return;
      const pos = screenToFlowPosition(point);
      addGraphic(g, { x: pos.x - 120, y: pos.y - 100 });
    },
    [addGraphic, screenToFlowPosition]
  );

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

  // Export the whole diagram as wireflow.jpg or wireflow.png (export-image.ts).
  const [exporting, setExporting] = useState(false);
  const exportImage = useCallback(
    async (format: ImageFormat) => {
      const viewport = canvas.current?.querySelector<HTMLElement>(".react-flow__viewport");
      if (!viewport || !getNodes().length || exporting) return;
      setExporting(true);
      try {
        const image = await renderImage(viewport, getNodesBounds(getNodes()), format);
        download(image.url, `wireflow.${format}`);
        say(notice(`Exported wireflow.${format} (${image.width} × ${image.height} px).`));
      } catch {
        say(notice("Couldn't export the image. Try again, or save the diagram with Export JSON.", "error"));
      } finally {
        setExporting(false);
      }
    },
    [getNodes, getNodesBounds, say, exporting]
  );

  // Save the diagram as a versioned wireflow.json (lib/diagram/file.ts).
  const exportJson = useCallback(() => {
    const blob = new Blob([serializeFile(store.diagram())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    // Revoking at once can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, [store]);

  // Open file: check the file, ask before replacing a diagram, then replace it
  // as one undo step. If the browser can't store it, the current diagram stays.
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingOpen, setPendingOpen] = useState<({ name: string } & Opened) | null>(null);

  const replaceWith = useCallback(
    ({ name, diagram, dropped }: { name: string } & Opened) => {
      setPendingOpen(null);
      if (lock.readOnly) {
        say(notice(`Couldn't open ${name}: this tab doesn't save (see the message above). Reload the page, then open the file.`, "error"));
        return;
      }
      if (!store.replace(diagram, "open")) {
        say(notice(`Couldn't open ${name}. It's too big to keep in this browser's storage, so your diagram is unchanged.`, "error"));
        return;
      }
      setNotices((ns) => [
        ...ns.slice(-2),
        notice(`Opened ${name}.`),
        ...droppedNotices(dropped),
      ]);
      setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 60);
    },
    [store, lock, say, fitView]
  );

  const openFile = useCallback(
    async (file: File) => {
      let parsed;
      try {
        if (file.size > MAX_FILE_BYTES) throw new DiagramFileError("It's too big to be a Wireflow diagram.");
        parsed = { name: file.name, ...parseFile(await file.text()) };
      } catch (err) {
        const reason = err instanceof DiagramFileError ? err.message : "It couldn't be read.";
        say(notice(`Couldn't open ${file.name}. ${reason}`, "error"));
        return;
      }
      if (store.getState().nodes.length) setPendingOpen(parsed);
      else replaceWith(parsed);
    },
    [store, say, replaceWith]
  );
  const chooseFile = useCallback(() => fileInput.current?.click(), []);

  const clearCanvas = useCallback(() => {
    if (store.getState().nodes.length === 0) return;
    store.clear();
    setTimeout(() => fitView({ duration: 250 }), 60);
  }, [store, fitView]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-wire-border bg-white px-4">
        <div className="flex items-center gap-4">
          {/* A full page load, as before. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
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
          <span
            role="status"
            className={saveFailed ? "text-xs font-semibold text-rose-600" : "text-xs text-ink-soft"}
          >
            {saveFailed ? "Not saved in this browser" : "All changes saved"}
          </span>
          {/* On a phone the header keeps only Export JSON, as before (Open file is in the toolbar). */}
          <button
            onClick={() => void ai.toggle()}
            aria-expanded={ai.open}
            aria-label={ai.failed ? LOAD_FAILED : "AI assistant"}
            title={ai.failed ? LOAD_FAILED : "AI assistant (your own Anthropic key)"}
            className={`hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ring-1 transition sm:flex ${
              ai.failed ? "text-rose-600 ring-rose-300" : "text-wire-blue ring-wire-blue/40 hover:bg-wire-lavender"
            }`}
          >
            <Sparkles size={14} aria-hidden />
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
              e.target.value = "";
              if (file) void openFile(file);
            }}
          />
          <button
            onClick={exportJson}
            title="Save the diagram as wireflow.json"
            className="rounded-md bg-wire-blue px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark"
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <GraphicsPanel onAddCard={(g) => addGraphic(g)} onTouchDrop={touchDrop} />
        <div
          ref={canvas}
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
            edges={shownEdges}
            onNodesChange={store.onNodesChange}
            onEdgesChange={store.onEdgesChange}
            onConnect={store.onConnect}
            // Only handle-to-handle connections between two cards (no loose edges).
            isValidConnection={store.isValidConnection}
            // Deleting goes through the store: cards and their connections are one undo step.
            deleteKeyCode={null}
            defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
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
          <UpdatePrompt />
          <ConfirmDialog
            open={!!pendingOpen}
            title="Replace the current diagram?"
            confirmLabel="Replace"
            onConfirm={() => pendingOpen && replaceWith(pendingOpen)}
            onCancel={() => setPendingOpen(null)}
          >
            {pendingOpen?.name} will replace what is on the canvas. You can undo this.
          </ConfirmDialog>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white px-2 py-1.5 shadow-[0_8px_30px_rgba(29,28,40,0.15)] ring-1 ring-wire-border">
            <ToolbarButton label="Undo" onClick={store.undo} />
            <ToolbarButton label="Redo" onClick={store.redo} />
            <span className="mx-1 h-5 w-px bg-wire-border" />
            <ToolbarButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })} />
            <ToolbarButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })} />
            <ToolbarButton label="Fit view" onClick={() => fitView({ duration: 250, padding: 0.2 })} />
            <span className="mx-1 h-5 w-px bg-wire-border" />
            <ToolbarButton
              label="Group"
              title="Group the selection (Ctrl + G)"
              icon={<Group size={16} aria-hidden />}
              disabled={!canGroup}
              onClick={store.group}
            />
            <ToolbarButton
              label="Ungroup"
              title="Ungroup, keeping the cards (Ctrl + Shift + G)"
              icon={<Ungroup size={16} aria-hidden />}
              disabled={!canUngroup}
              onClick={store.ungroup}
            />
            <span className="mx-1 h-5 w-px bg-wire-border" />
            <ToolbarButton label="Open file" onClick={chooseFile} />
            <ToolbarButton label="Export JSON" onClick={exportJson} />
            <Menu
              trigger={
                <button
                  title="Export the whole diagram as an image"
                  aria-label="Export image"
                  disabled={!nodes.length || exporting}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-wire-canvas hover:text-wire-blue disabled:pointer-events-none disabled:opacity-35"
                >
                  <ImageDown size={16} aria-hidden />
                </button>
              }
              items={[
                { label: "JPG image", onSelect: () => void exportImage("jpg") },
                { label: "PNG image", onSelect: () => void exportImage("png") },
              ]}
            />
            <ToolbarButton label="Clear canvas" onClick={clearCanvas} />
          </div>

          {/* A selected connection or group shows its panel in this place instead. */}
          {selectedEdge && <EdgePanel edge={selectedEdge} edges={edges} />}
          {selectedGroup && isGroup(selectedGroup) && <GroupPanel group={selectedGroup} />}
          <aside className={`absolute right-4 top-4 hidden w-60 rounded-xl bg-white p-4 shadow-lg ring-1 ring-wire-border ${selectedEdge || selectedGroup ? "" : "lg:block"}`}>
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
                ["Copy / paste", "Ctrl + C / V"],
                ["Group / ungroup", "Ctrl + G / ⇧G"],
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
              <li>Click a connection to label or colour it</li>
              <li>Select cards and press Group; drag a card onto a group to add it</li>
              <li>Your flow autosaves in this browser</li>
              <li>Export JSON saves it as a file; Open file opens it again</li>
              <li>The image button exports the whole diagram as JPG or PNG</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
const subscribeNothing = () => () => {};

// The store is made once per page load, and shared with the cards (store-context).
function EditorRoot() {
  const [loaded] = useState(start);
  return (
    <StoreContext.Provider value={loaded.store}>
      <EditorInner loaded={loaded} />
    </StoreContext.Provider>
  );
}

export default function Editor() {
  // Client-only (the diagram is in localStorage): a placeholder until hydrated.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return <div className="h-screen w-full bg-wire-canvas" />;
  return (
    <ReactFlowProvider>
      <EditorRoot />
    </ReactFlowProvider>
  );
}