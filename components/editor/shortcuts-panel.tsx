"use client";

// Production's "Keyboard shortcuts" panel, collapsible from its heading. Open by
// default where it fits above the minimap, collapsed by default where it would
// cover it; once the user opens or closes it, that choice is remembered in this
// browser. It shows from the lg breakpoint, where a selected card, group or
// connection shows its own panel in this place instead.
import { ChevronDown } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";

const KEY = "wireflow-shortcuts-panel";

// The lowest window height at which the open panel ends above the minimap.
// Measured in Chromium at 1440 px wide: the canvas starts below the 56 px
// header, the panel 16 px into it and 704 px tall (ending at y = 776), and the
// minimap's top is 165 px above the bottom of the window (its 150 px height and
// React Flow's 15 px margin), so 776 + 165 = 941. e2e/shortcuts.spec.ts checks
// both sides of this value, so a change to the panel's contents that moves it
// fails there.
export const SHORTCUTS_OPEN_MIN_HEIGHT = 941;
const QUERY = `(min-height: ${SHORTCUTS_OPEN_MIN_HEIGHT}px)`;

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const fits = () => window.matchMedia(QUERY).matches;

function readChoice(): boolean | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "open" ? true : value === "closed" ? false : null;
  } catch {
    return null;
  }
}

const SHORTCUTS = [
  ["Zoom in", "Ctrl + ="],
  ["Zoom out", "Ctrl + -"],
  ["Undo", "Ctrl + Z"],
  ["Redo", "Ctrl + Y"],
  ["Toggle header", "H"],
  ["Edit header", "Double-click"],
  ["Delete selected", "Backspace"],
  ["Copy / paste", "Ctrl + C / V"],
  ["Group / ungroup", "Ctrl + G / ⇧G"],
  ["Actual size", "Ctrl + 0"],
  ["Select all / none", "Ctrl + A / Esc"],
];

export default function ShortcutsPanel({ hidden }: { hidden: boolean }) {
  const [choice, setChoice] = useState(readChoice);
  const roomy = useSyncExternalStore(subscribe, fits, () => true);
  const open = choice ?? roomy;
  const contentId = useId();

  const toggle = () => {
    setChoice(!open);
    try {
      window.localStorage.setItem(KEY, open ? "closed" : "open");
    } catch {
      // Storage blocked: the choice lasts until the page is reloaded.
    }
  };

  return (
    <aside
      aria-label="Keyboard shortcuts"
      className={`absolute right-4 top-4 hidden w-60 rounded-xl bg-white p-4 shadow-lg ring-1 ring-wire-border ${hidden ? "" : "lg:block"}`}
    >
      <h3 className="text-sm font-bold text-ink">
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          title={open ? "Hide the shortcuts" : "Show the shortcuts"}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-center justify-between rounded-md p-1 text-left transition hover:text-wire-blue"
        >
          Keyboard shortcuts
          <ChevronDown
            size={16}
            aria-hidden
            className={`shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div id={contentId} hidden={!open}>
        <dl className="mt-3 space-y-2 text-xs">
          {SHORTCUTS.map(([action, keys]) => (
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
          <li>Your flow autosaves in this browser</li>
          <li>Export JSON saves it as a file; Open file opens it again</li>
        </ul>
      </div>
    </aside>
  );
}
