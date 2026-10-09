// Autosave in this browser. The diagram lives in localStorage['wireflow-flow-v1'],
// the key production uses, so diagrams made on wireflow.co open here unchanged.
import { DIAGRAM_VERSION, STORAGE_KEY, type Diagram } from './model';
import { dropProto, enforceRulesOnLoad, serialize, type Dropped } from './rules';
import { parseHistory, type History, type Step } from './history';

// Where unreadable data is copied before anything else is written to STORAGE_KEY.
export const BACKUP_KEY = `${STORAGE_KEY}.unreadable`;
// The undo history, per tab, so it survives a reload.
export const HISTORY_KEY = 'wireflow-history-v1';

export type Loaded =
  | { status: 'empty' }
  | { status: 'loaded'; diagram: Diagram; dropped: Dropped }
  // Saved by a newer Wireflow: shown, but never overwritten by this version.
  | { status: 'newer'; diagram: Diagram }
  // Not a diagram at all: copied to BACKUP_KEY, and the editor starts empty.
  | { status: 'unreadable' };

/**
 * Bring stored data of any version to the current one.
 * Version 1 (production, no "version" field): React Flow's {nodes, edges}.
 * Version 2 adds the field plus groups, edge labels and colours, so version 1
 * needs no change beyond the rules every load applies.
 */
export function migrate(raw: unknown): { version: number; data: unknown } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { version = 1 } = raw as { version?: unknown };
  if (!Number.isInteger(version) || (version as number) < 1) return null;
  if (!Array.isArray((raw as { nodes?: unknown }).nodes)) return null;
  return { version: version as number, data: raw };
}

export function readDiagram(storage: Storage): Loaded {
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (text === null) return { status: 'empty' };

  let raw: unknown;
  try {
    raw = JSON.parse(text, dropProto);
  } catch {
    raw = undefined;
  }
  const migrated = migrate(raw);
  if (!migrated) {
    try {
      if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, text);
    } catch {
      // Storage blocked: nothing can be written over it either.
    }
    return { status: 'unreadable' };
  }
  const { diagram, dropped } = enforceRulesOnLoad(migrated.data);
  return migrated.version > DIAGRAM_VERSION ? { status: 'newer', diagram } : { status: 'loaded', diagram, dropped };
}

// The stored form of a diagram (already through the rules, see serialize).
export const storedJson = (diagramJson: string) => `{"version":${DIAGRAM_VERSION},${diagramJson.slice(1)}`;

// Returns false if the browser refused (storage full or blocked).
export function writeDiagram(storage: Storage, diagramJson: string): boolean {
  try {
    storage.setItem(STORAGE_KEY, storedJson(diagramJson));
    return true;
  } catch {
    return false;
  }
}

// The tab's undo history, every step through the rules (it may come from an
// older build, and undo writes steps straight back to storage). Null if any step
// isn't a diagram.
export function readHistory(storage: Storage): History | null {
  try {
    const history = parseHistory(JSON.parse(storage.getItem(HISTORY_KEY) ?? 'null'));
    if (!history) return null;
    const clean = (step: Step): Step => ({ ...step, json: serialize(enforceRulesOnLoad(JSON.parse(step.json, dropProto)).diagram) });
    return { past: history.past.map(clean), present: clean(history.present), future: history.future.map(clean) };
  } catch {
    return null;
  }
}

// Keeps as much recent history as fits; history is a convenience, never an error.
export function writeHistory(storage: Storage, history: History) {
  for (let keep = history.past.length; ; keep = Math.floor(keep / 2)) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify({ ...history, past: history.past.slice(history.past.length - keep) }));
      return;
    } catch {
      if (keep === 0) {
        try {
          storage.removeItem(HISTORY_KEY);
        } catch {
          // ignore
        }
        return;
      }
    }
  }
}
