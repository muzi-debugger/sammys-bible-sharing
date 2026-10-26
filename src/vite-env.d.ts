/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'local' | 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PARTNER_ONE_NAME?: string;
  readonly VITE_PARTNER_ONE_EMAIL?: string;
  readonly VITE_PARTNER_TWO_NAME?: string;
  readonly VITE_PARTNER_TWO_EMAIL?: string;
  readonly VITE_BIBLE_PROVIDER?: 'preview' | 'api-bible';
  readonly VITE_BIBLE_PROVIDER_BASE_URL?: string;
  readonly VITE_API_BIBLE_BASE_URL?: string;
  readonly VITE_API_BIBLE_KEY?: string;
  readonly VITE_API_BIBLE_ID?: string;
  readonly VITE_PREVIEW_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
