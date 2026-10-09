// Undo/redo as snapshots of the stored diagram JSON (based on #111's history).
// React Flow has no history of its own. One snapshot is one undo step, so
// anything applied as a batch (paste, group, an AI edit, opening a file) undoes
// at once.

// `kind` says what made the step (e.g. "ai", "open"); `id` identifies it, so the
// AI panel can tell whether its change is still the latest one.
export type Step = { json: string; id: number; kind?: string };
export type History = { past: Step[]; present: Step; future: Step[] };

export const HISTORY_LIMIT = 100;

export const createHistory = (json: string): History => ({ past: [], present: { json, id: 0 }, future: [] });

const nextId = (h: History) => Math.max(h.present.id, ...h.past.map((s) => s.id), ...h.future.map((s) => s.id)) + 1;

// Record a new state. The same JSON as now (e.g. a selection change) records nothing.
export function record(h: History, json: string, kind?: string, limit = HISTORY_LIMIT): History {
  if (json === h.present.json) return h;
  return { past: [...h.past, h.present].slice(-limit), present: { json, id: nextId(h), ...(kind && { kind }) }, future: [] };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(h: History): History {
  if (!canUndo(h)) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!canRedo(h)) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/**
 * Where step `id` stands: "latest" (it is the current state), "applied" (later
 * steps came after it), "replaced" (a later, still applied step opened a file
 * over it), "undone", or "unknown" (no longer in the history).
 */
export function stepState(h: History, id: number): 'latest' | 'applied' | 'replaced' | 'undone' | 'unknown' {
  if (h.present.id === id) return 'latest';
  if (h.future.some((s) => s.id === id)) return 'undone';
  const index = h.past.findIndex((s) => s.id === id);
  if (index < 0) return 'unknown';
  const later = [...h.past.slice(index + 1), h.present];
  return later.some((s) => s.kind === 'open') ? 'replaced' : 'applied';
}

// A history read back from session storage, if it is well-formed.
export function parseHistory(value: unknown): History | null {
  const isStep = (s: unknown): s is Step =>
    typeof s === 'object' && s !== null && typeof (s as Step).json === 'string' && Number.isInteger((s as Step).id);
  if (typeof value !== 'object' || value === null) return null;
  const h = value as History;
  if (!isStep(h.present) || !Array.isArray(h.past) || !Array.isArray(h.future)) return null;
  if (!h.past.every(isStep) || !h.future.every(isStep)) return null;
  return { past: h.past.slice(-HISTORY_LIMIT), present: h.present, future: h.future.slice(0, HISTORY_LIMIT) };
}
