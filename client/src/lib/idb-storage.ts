/**
 * IndexedDB-backed storage adapter for Zustand's persist middleware.
 * 
 * Replaces sessionStorage/localStorage to avoid the 5MB browser storage limit.
 * IndexedDB has no practical size limit, making it suitable for storing 
 * large file contents in the editor state.
 * 
 * Uses idb-keyval for a minimal, promise-based IndexedDB wrapper.
 */
import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
