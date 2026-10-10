// Autosave in this browser. The diagram lives in localStorage["wireflow-flow-v1"],
// the key the editor has always used, so every diagram saved before this
// change opens unchanged.
import { parseHistory, type History, type Step } from "./history";
import { DIAGRAM_VERSION, STORAGE_KEY, type Diagram } from "./model";
import { dropProto, enforceRules, serialize, type Dropped } from "./rules";

// Where stored data is copied before anything could overwrite it (unreadable
// data, or data the rules trimmed on load); later copies get a time suffix.
export const BACKUP_KEY = `${STORAGE_KEY}.backup`;

export type Loaded =
  | { status: "empty" }
  // `backup`: where the stored text was copied before the rules dropped part of
  // it (null if nothing was dropped, or if the copy failed; see `kept`).
  | { status: "loaded"; diagram: Diagram; dropped: Dropped; backup: string | null; kept: boolean }
  // Saved by a newer Wireflow: shown as far as this version can, never overwritten.
  | { status: "newer"; diagram: Diagram }
  // Not a diagram at all: copied to `backup` (null if that failed); the editor starts empty.
  | { status: "unreadable"; backup: string | null };

/**
 * Bring stored data of any version to the current one.
 * Version 1 (no "version" field): React Flow's {nodes, edges}, as the editor
 * has always saved it. Version 2 adds the field plus edge labels and colours,
 * so version 1 needs no change beyond the rules every load applies. A newer
 * version is recognised before its shape is looked at: its shape may have changed.
 */
export function migrate(raw: unknown): { version: number; data: unknown } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { version = 1 } = raw as { version?: unknown };
  if (!Number.isInteger(version) || (version as number) < 1) return null;
  if ((version as number) > DIAGRAM_VERSION) return { version: version as number, data: raw };
  if (!Array.isArray((raw as { nodes?: unknown }).nodes)) return null;
  return { version: version as number, data: raw };
}

/**
 * Copy stored text to a backup key before anything overwrites it: BACKUP_KEY,
 * or, if that already holds something else, a key of its own with the time.
 * Returns the key, or null if the browser refused.
 */
export function backup(storage: Storage, text: string, now = Date.now()): string | null {
  try {
    const first = storage.getItem(BACKUP_KEY);
    const key = first === null || first === text ? BACKUP_KEY : `${BACKUP_KEY}.${now}`;
    storage.setItem(key, text);
    return key;
  } catch {
    return null;
  }
}

export function readDiagram(storage: Storage): Loaded {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: "empty" };
  }
  if (text === null) return { status: "empty" };

  let raw: unknown;
  try {
    raw = JSON.parse(text, dropProto);
  } catch {
    raw = undefined;
  }
  const migrated = migrate(raw);
  if (!migrated) return { status: "unreadable", backup: backup(storage, text) };
  const { diagram, dropped } = enforceRules(migrated.data);
  if (migrated.version > DIAGRAM_VERSION) return { status: "newer", diagram };
  // The first save would write the diagram without what the rules dropped: keep the original.
  const lost = dropped.nodes + dropped.edges > 0;
  const key = lost ? backup(storage, text) : null;
  return { status: "loaded", diagram, dropped, backup: key, kept: !lost || key !== null };
}

// The stored form of a diagram (already through the rules, see serialize).
export const storedJson = (diagramJson: string) => `{"version":${DIAGRAM_VERSION},${diagramJson.slice(1)}`;

// Returns false if the browser refused (storage full or blocked).
export function writeDiagram(storage: Storage, diagramJson: string): boolean {
  try {
    // Never write over what a newer Wireflow saved (in another tab, say). Our
    // own saves start with the version, so the first characters are enough.
    const stored = /^\{"version":(\d+)/.exec(storage.getItem(STORAGE_KEY)?.slice(0, 24) ?? "");
    if (stored && Number(stored[1]) > DIAGRAM_VERSION) return false;
    storage.setItem(STORAGE_KEY, storedJson(diagramJson));
    return true;
  } catch {
    return false;
  }
}

// The undo history, per tab (sessionStorage), so it survives a reload.
export const HISTORY_KEY = "wireflow-history-v1";

// The tab's undo history, every step through the rules (it may come from an
// older build, and undo writes steps straight back to storage). Null if any
// step isn't a diagram.
export function readHistory(storage: Storage): History | null {
  try {
    const history = parseHistory(JSON.parse(storage.getItem(HISTORY_KEY) ?? "null"));
    if (!history) return null;
    const clean = (step: Step): Step => ({
      ...step,
      json: serialize(enforceRules(JSON.parse(step.json, dropProto)).diagram),
    });
    return { past: history.past.map(clean), present: clean(history.present), future: history.future.map(clean) };
  } catch {
    return null;
  }
}

// Keeps as much recent history as fits; history is a convenience, never an error.
export function writeHistory(storage: Storage, history: History) {
  for (let keep = history.past.length; ; keep = Math.floor(keep / 2)) {
    try {
      storage.setItem(
        HISTORY_KEY,
        JSON.stringify({ ...history, past: history.past.slice(history.past.length - keep) })
      );
      return;
    } catch {
      if (keep === 0) {
        try {
          storage.removeItem(HISTORY_KEY);
        } catch {
          // Storage blocked: the history just isn't kept.
        }
        return;
      }
    }
  }
}
