import { DEFAULT_SETTINGS, buildSeedDatabase } from '@/data/seed';
import { isRemoteMode } from '@/lib/supabase';
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
  if (typeof window === 'undefined' || inMemoryOnly || isRemoteMode) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  } catch {
    inMemoryOnly = true;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Empty shell used before the Supabase snapshot arrives (and on load failure). */
export function emptyDatabase(): PreviewDatabase {
  return {
    version: 1,
    sessionUserId: '',
    settings: DEFAULT_SETTINGS,
    profiles: [],
    cycles: [],
    assignments: [],
    dailyScriptures: [],
    personalStudies: [],
    sharedTakeaways: [],
    bookmarks: [],
    reflections: [],
    emailLog: [],
    selectionHistory: [],
    seededAt: new Date().toISOString(),
    seeded: false,
  };
}

export function getDatabase(): PreviewDatabase {
  if (cache) return cache;
  if (isRemoteMode) {
    cache = emptyDatabase();
    return cache;
  }
  const stored = readFromStorage();
  cache = stored ?? buildSeedDatabase(new Date());
  if (!stored) writeToStorage(cache);
  return cache;
}

/** Replace the whole snapshot — used after loading rows from Supabase. */
export function hydrateDatabase(database: PreviewDatabase) {
  cache = database;
  notify();
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
  if (isRemoteMode) return;
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
