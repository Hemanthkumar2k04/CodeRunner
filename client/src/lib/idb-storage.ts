/**
 * IndexedDB-backed storage adapter for Zustand's persist middleware.
 * 
 * Replaces sessionStorage/localStorage to avoid the 5MB browser storage limit.
 * IndexedDB has no practical size limit, making it suitable for storing 
 * large file contents in the editor state.
 * 
 * Uses idb-keyval for a minimal, promise-based IndexedDB wrapper.
 */
import { get, set, del, clear } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

let initPromise: Promise<void> | null = null;

// Clear the IndexedDB when a new session starts (new tab or window)
if (!sessionStorage.getItem('session_initialized')) {
  sessionStorage.setItem('session_initialized', 'true');
  initPromise = clear().catch(console.error);
}

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (initPromise) await initPromise;
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (initPromise) await initPromise;
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (initPromise) await initPromise;
    await del(name);
  },
};
