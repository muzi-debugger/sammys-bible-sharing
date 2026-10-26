import { isRemoteMode } from '@/lib/supabase';

/**
 * What this build can actually do.
 *
 * Every user-facing statement about delivery, the Bible provider and storage is
 * derived from here, so the interface can never claim "preview" on a build that
 * really sends email, nor promise email on a build that cannot.
 */
export type DataMode = 'local' | 'supabase';
export type NltSource = 'licensed' | 'preview';

const providerBaseUrl = import.meta.env.VITE_BIBLE_PROVIDER_BASE_URL?.trim() ?? '';
const providerMode = (import.meta.env.VITE_BIBLE_PROVIDER ?? 'preview').toLowerCase();
const hasApiBibleKey = Boolean(import.meta.env.VITE_API_BIBLE_KEY?.trim());

/**
 * Licensed NLT is only claimed when there is a real source: the server-side
 * proxy (preferred, keeps the API key off the client) or a direct API.Bible
 * configuration. Anything else is the explicit preview provider.
 */
export const nltSource: NltSource =
  providerBaseUrl.length > 0 || providerMode === 'api-bible' || hasApiBibleKey
    ? 'licensed'
    : 'preview';

export const dataMode: DataMode = isRemoteMode ? 'supabase' : 'local';

/**
 * Delivery is a server capability. When Supabase is connected, the `send-email`
 * edge function delivers through Brevo on the configured schedule, so the UI may
 * state that email is delivered. In a browser-only build nothing can be sent.
 */
export const emailDeliveryEnabled = isRemoteMode;

/** Storage description, phrased truthfully for the active mode. */
export const storageSummary = isRemoteMode
  ? {
      title: 'Stored in Supabase Postgres',
      detail:
        'Rows are scoped by row level security, so each partner can only read their own notebook.',
    }
  : {
      title: 'Stored in this browser only',
      detail:
        'This browser-only build keeps everything in localStorage. Nothing is uploaded and no email can be sent.',
    };

export const capabilities = {
  dataMode,
  remote: isRemoteMode,
  emailDelivery: emailDeliveryEnabled,
  nltSource,
  nltLicensed: nltSource === 'licensed',
  storage: storageSummary,
};
