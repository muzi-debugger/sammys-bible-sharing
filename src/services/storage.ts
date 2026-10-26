import { buildSeedDatabase } from '@/data/seed';
import type { PartnerId, PreviewDatabase } from '@/types';

const STORAGE_KEY = 'sbs.preview.database.v1';

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: PreviewDatabase | null = null;
let inMemoryOnly = false;

function readFromStorage(): PreviewDatabase | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreviewDatabase;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(database: PreviewDatabase) {
  if (typeof window === 'undefined' || inMemoryOnly) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  } catch {
    inMemoryOnly = true;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getDatabase(): PreviewDatabase {
  if (cache) return cache;
  const stored = readFromStorage();
  cache = stored ?? buildSeedDatabase(new Date());
  if (!stored) writeToStorage(cache);
  return cache;
}

export function subscribeToDatabase(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function mutateDatabase(mutator: (draft: PreviewDatabase) => void): PreviewDatabase {
  const current = getDatabase();
  const draft = JSON.parse(JSON.stringify(current)) as PreviewDatabase;
  mutator(draft);
  cache = draft;
  writeToStorage(draft);
  notify();
  return draft;
}

export function setSessionUser(userId: PartnerId) {
  mutateDatabase((draft) => {
    draft.sessionUserId = userId;
  });
}

export function resetDatabase() {
  cache = buildSeedDatabase(new Date());
  inMemoryOnly = false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  writeToStorage(cache);
  notify();
}
