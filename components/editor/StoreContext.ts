'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DiagramStore } from '@/lib/diagram/store';

export const StoreContext = createContext<DiagramStore | null>(null);

export function useStore(): DiagramStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside the editor');
  return store;
}

// Re-renders on every store change.
export function useStoreState(store: DiagramStore) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
