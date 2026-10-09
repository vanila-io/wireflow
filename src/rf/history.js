// Undo/redo for the React Flow editor. React Flow has no built-in history (its
// undo/redo example is part of the paid Pro plan), so the editor keeps snapshots of
// the saved diagram: the same G6-format JSON it writes to localStorage. One snapshot
// is one undo step, so anything applied as a batch (paste, an AI edit) undoes at once.

export const HISTORY_LIMIT = 100;

export const createHistory = (present) => ({ past: [], present, future: [] });

// Record a new state. Saving the same JSON twice (e.g. a selection change) is a no-op.
export function record(history, next, limit = HISTORY_LIMIT) {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-limit), present: next, future: [] };
}

export const canUndo = (history) => history.past.length > 0;
export const canRedo = (history) => history.future.length > 0;

export function undo(history) {
  if (!canUndo(history)) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redo(history) {
  if (!canRedo(history)) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
