/// <reference types="vite/client" />

interface ImportMetaEnv {
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
