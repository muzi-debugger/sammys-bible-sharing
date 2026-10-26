import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  '';

/**
 * Supabase is only used when explicitly enabled and both values exist.
 * The anon/publishable key is designed to be public; access is controlled by
 * Row Level Security, never by hiding this key.
 */
export const isRemoteMode =
  (import.meta.env.VITE_DATA_MODE ?? 'local').toLowerCase() === 'supabase' &&
  Boolean(url) &&
  Boolean(anonKey);

export const supabase: SupabaseClient | null = isRemoteMode
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const remoteConfig = {
  url,
  hasKey: Boolean(anonKey),
};
