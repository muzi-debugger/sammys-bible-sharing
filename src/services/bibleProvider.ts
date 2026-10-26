import { makePlaceholderPassage } from '@/services/passageFactory';
import { parseReference, WEEKLY_REFERENCE_POOL } from '@/data/references';
import type { ScripturePassage, TranslationId } from '@/types';

export interface PassageRequest {
  reference: string;
  translation: TranslationId;
}

export interface ProviderTranslation {
  id: string;
  name: string;
  /** Only licensed + NLT-capable translations may be offered in the selector. */
  licensed: boolean;
  supportsNlt: boolean;
}

export interface BibleProvider {
  readonly id: string;
  readonly displayName: string;
  /** Must be explicit — never assume a provider supports NLT. */
  supportsTranslation(translation: string): Promise<boolean>;
  listTranslations(): Promise<ProviderTranslation[]>;
  getPassage(request: PassageRequest): Promise<ScripturePassage>;
}

/** Thrown when the configured provider cannot serve NLT. Never fall back silently. */
export class TranslationUnavailableError extends Error {
  readonly translation: string;
  readonly provider: string;

  constructor(translation: string, provider: string, message?: string) {
    super(
      message ??
        `The configured Bible provider (${provider}) cannot serve the ${translation}. No substitute translation was used.`,
    );
    this.name = 'TranslationUnavailableError';
    this.translation = translation;
    this.provider = provider;
  }
}

export class ProviderUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export class PassageNotFoundError extends Error {
  constructor(reference: string, translation: string) {
    super(`The ${translation} passage for ${reference} could not be found.`);
    this.name = 'PassageNotFoundError';
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Preview provider.
 *
 * It never returns real Scripture text. It returns an explicit placeholder that
 * the UI renders with a "Preview" badge, so nothing is ever mislabelled as NLT.
 */
export class PreviewBibleProvider implements BibleProvider {
  readonly id = 'preview';
  readonly displayName = 'Preview provider';

  async supportsTranslation(translation: string): Promise<boolean> {
    await wait(80);
    return translation.toUpperCase() === 'NLT';
  }

  async listTranslations(): Promise<ProviderTranslation[]> {
    await wait(60);
    return [
      {
        id: 'NLT',
        name: 'New Living Translation',
        licensed: false,
        supportsNlt: false,
      },
    ];
  }

  async getPassage(request: PassageRequest): Promise<ScripturePassage> {
    await wait(240);
    const definition = WEEKLY_REFERENCE_POOL.find((entry) => entry.reference === request.reference);
    const focus = definition?.focus ?? 'faithfulness in ordinary days';
    const theme = definition?.theme ?? 'Faith';
    return makePlaceholderPassage(
      request.reference,
      theme,
      focus,
      this.id,
      `${this.displayName} — no licensed NLT text available`,
    );
  }
}

interface HttpProviderResponse {
  reference?: string;
  translation?: string;
  text?: string;
  attribution?: string;
  book?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  theme?: string;
  focus?: string;
  contentKind?: 'licensed' | 'placeholder';
}

/**
 * Adapter for a licensed NLT source (server-side proxy strongly recommended).
 *
 * Contract expected from the endpoint:
 *   GET {baseUrl}/passage?reference=Psalm%2023:1-6&translation=NLT
 *   -> { reference, translation: "NLT", text, attribution, book, chapter,
 *        verseStart, verseEnd, contentKind: "licensed" }
 *
 * Any response that is not explicitly NLT licensed content is rejected.
 */
export class LicensedNltProvider implements BibleProvider {
  readonly id = 'licensed-nlt';
  readonly displayName = 'Licensed NLT provider';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 8000,
  ) {}

  async supportsTranslation(translation: string): Promise<boolean> {
    if (translation.toUpperCase() !== 'NLT') return false;
    try {
      const response = await this.fetchJson('/translations');
      const list = Array.isArray(response) ? response : [];
      return list.some(
        (item: ProviderTranslation) =>
          String(item.id).toUpperCase() === 'NLT' && item.licensed && item.supportsNlt,
      );
    } catch {
      return false;
    }
  }

  async listTranslations(): Promise<ProviderTranslation[]> {
    const response = await this.fetchJson('/translations');
    const list = Array.isArray(response) ? (response as ProviderTranslation[]) : [];
    return list.filter((item) => item.licensed && item.supportsNlt);
  }

  async getPassage(request: PassageRequest): Promise<ScripturePassage> {
    if (request.translation.toUpperCase() !== 'NLT') {
      throw new TranslationUnavailableError(request.translation, this.id);
    }
    const query = new URLSearchParams({
      reference: request.reference,
      translation: 'NLT',
    });
    const payload = (await this.fetchJson(`/passage?${query.toString()}`)) as HttpProviderResponse;

    if (String(payload.translation ?? '').toUpperCase() !== 'NLT') {
      throw new TranslationUnavailableError(payload.translation ?? 'unknown', this.id);
    }
    if (!payload.text || !payload.reference) {
      throw new PassageNotFoundError(request.reference, 'NLT');
    }
    if (payload.contentKind !== 'licensed') {
      throw new TranslationUnavailableError(
        'NLT',
        this.id,
        'The provider returned content that is not marked as licensed NLT text.',
      );
    }

    return {
      reference: payload.reference,
      book: payload.book ?? payload.reference.split(' ')[0],
      chapter: payload.chapter ?? 1,
      verseStart: payload.verseStart ?? 1,
      verseEnd: payload.verseEnd ?? 1,
      translation: 'NLT',
      text: payload.text,
      attribution: payload.attribution ?? 'New Living Translation, copyright © Tyndale House Publishers.',
      providerId: this.id,
      providerName: this.displayName,
      retrievedAt: new Date().toISOString(),
      contentKind: 'licensed',
      theme: payload.theme ?? 'Faith',
      focus: payload.focus ?? '',
    };
  }

  private async fetchJson(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404) {
        throw new PassageNotFoundError('requested passage', 'NLT');
      }
      if (response.status === 429) {
        throw new ProviderUnavailableError('The Bible provider rate limit was reached. Try again shortly.');
      }
      if (!response.ok) {
        throw new ProviderUnavailableError(`The Bible provider responded with ${response.status}.`);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof TranslationUnavailableError) throw error;
      if (error instanceof PassageNotFoundError) throw error;
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError(
        controller.signal.aborted
          ? 'The Bible provider timed out. The NLT preference has been kept.'
          : 'The Bible provider could not be reached. The NLT preference has been kept.',
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Human book name → USFM book id used by API.Bible passage ids (e.g. Psalm 23:1-6 → PSA.23.1-6). */
const USFM_BOOKS: Record<string, string> = {
  genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
  joshua: 'JOS', judges: 'JDG', ruth: 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
  '1 kings': '1KI', '2 kings': '2KI', '1 chronicles': '1CH', '2 chronicles': '2CH',
  ezra: 'EZR', nehemiah: 'NEH', esther: 'EST', job: 'JOB', psalm: 'PSA', psalms: 'PSA',
  proverbs: 'PRO', ecclesiastes: 'ECC', 'song of songs': 'SNG', 'song of solomon': 'SNG',
  isaiah: 'ISA', jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN',
  hosea: 'HOS', joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC',
  nahum: 'NAM', habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC',
  malachi: 'MAL', matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT',
  romans: 'ROM', '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL',
  ephesians: 'EPH', philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH',
  '2 thessalonians': '2TH', '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT',
  philemon: 'PHM', hebrews: 'HEB', james: 'JAS', '1 peter': '1PE', '2 peter': '2PE',
  '1 john': '1JN', '2 john': '2JN', '3 john': '3JN', jude: 'JUD', revelation: 'REV',
};

interface ApiBibleOptions {
  baseUrl: string;
  apiKey: string;
  bibleId: string;
  timeoutMs?: number;
}

interface ApiBibleRecord {
  id: string;
  abbreviationLocal?: string;
  name?: string;
  copyright?: string;
}

interface ApiBiblePassagePayload {
  id: string;
  reference: string;
  content: string;
  copyright?: string;
  verseCount?: number;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/** API.Bible returns HTML-ish content even for `content-type=text`. */
function toPlainText(content: string): string {
  return decodeEntities(
    content
      .replace(/<\/(p|div|h\d)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * API.Bible (American Bible Society) adapter.
 *
 * NLT is a licensed, approved translation on API.Bible: the key must have NLT
 * access granted by the rights holder (Tyndale) before any passage returns.
 * This adapter resolves the NLT bible id at runtime, so no id is hard-coded, and
 * it refuses to serve anything that is not confirmed NLT.
 *
 * Docs: https://docs.api.bible — endpoint: /v1/bibles/{bibleId}/passages/{passageId}
 */
export class ApiBibleProvider implements BibleProvider {
  readonly id = 'api-bible';
  readonly displayName = 'API.Bible (American Bible Society)';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly explicitBibleId: string;
  private readonly timeoutMs: number;
  private bibleIdPromise: Promise<string> | null = null;

  constructor(options: ApiBibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.explicitBibleId = options.bibleId;
    this.timeoutMs = options.timeoutMs ?? 9000;
  }

  async supportsTranslation(translation: string): Promise<boolean> {
    if (translation.toUpperCase() !== 'NLT') return false;
    try {
      await this.resolveBibleId();
      return true;
    } catch {
      return false;
    }
  }

  async listTranslations(): Promise<ProviderTranslation[]> {
    try {
      await this.resolveBibleId();
    } catch {
      return [];
    }
    return [
      {
        id: 'NLT',
        name: 'New Living Translation',
        licensed: true,
        supportsNlt: true,
      },
    ];
  }

  async getPassage(request: PassageRequest): Promise<ScripturePassage> {
    if (request.translation.toUpperCase() !== 'NLT') {
      throw new TranslationUnavailableError(request.translation, this.id);
    }

    const parsed = parseReference(request.reference);
    const bookId = USFM_BOOKS[parsed.book.toLowerCase()];
    if (!bookId) {
      throw new PassageNotFoundError(request.reference, 'NLT');
    }

    const bibleId = await this.resolveBibleId();
    // API.Bible wants fully-qualified verse ranges: PSA.23.1-PSA.23.6
    const passageId =
      parsed.verseEnd && parsed.verseEnd !== parsed.verseStart
        ? `${bookId}.${parsed.chapter}.${parsed.verseStart}-${bookId}.${parsed.chapter}.${parsed.verseEnd}`
        : `${bookId}.${parsed.chapter}.${parsed.verseStart}`;

    // Only these params are accepted for passages; extras return 400.
    const query = new URLSearchParams({
      'content-type': 'text',
      'include-verse-numbers': 'false',
      'include-chapter-numbers': 'false',
    });

    const payload = await this.request<{ data?: ApiBiblePassagePayload }>(
      `/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?${query.toString()}`,
    );

    const data = payload.data;
    if (!data?.content) {
      throw new PassageNotFoundError(request.reference, 'NLT');
    }

    const definition = WEEKLY_REFERENCE_POOL.find(
      (entry) => entry.reference === request.reference,
    );

    return {
      reference: data.reference?.trim() || request.reference,
      book: parsed.book,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      translation: 'NLT',
      text: toPlainText(data.content),
      attribution:
        data.copyright?.trim() ||
        'New Living Translation, copyright © Tyndale House Publishers. Used by permission.',
      providerId: this.id,
      providerName: this.displayName,
      retrievedAt: new Date().toISOString(),
      contentKind: 'licensed',
      theme: definition?.theme ?? 'Faith',
      focus: definition?.focus ?? '',
    };
  }

  private resolveBibleId(): Promise<string> {
    if (this.bibleIdPromise) return this.bibleIdPromise;

    this.bibleIdPromise = (async () => {
      if (this.explicitBibleId) {
        const record = await this.request<{ data?: ApiBibleRecord }>(
          `/bibles/${this.explicitBibleId}`,
        ).catch(() => null);
        if (record?.data && !isNltBible(record.data)) {
          throw new TranslationUnavailableError(
            'NLT',
            this.id,
            `The configured bible id (${this.explicitBibleId}) is not the New Living Translation.`,
          );
        }
        return this.explicitBibleId;
      }

      const list = await this.request<{ data?: ApiBibleRecord[] }>('/bibles?language=eng');
      const nlt = (list.data ?? []).find(isNltBible);
      if (!nlt) {
        throw new TranslationUnavailableError(
          'NLT',
          this.id,
          'API.Bible did not return the New Living Translation for this key. Request NLT access in the API.Bible dashboard (licence approval by Tyndale) and try again. No substitute translation was used.',
        );
      }
      return nlt.id;
    })();

    // Allow a later retry if the first attempt failed.
    this.bibleIdPromise.catch(() => {
      this.bibleIdPromise = null;
    });

    return this.bibleIdPromise;
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
        },
      });

      if (response.status === 401 || response.status === 403) {
        throw new TranslationUnavailableError(
          'NLT',
          this.id,
          'API.Bible rejected the request (401/403). Check the API key and that NLT access has been approved for it.',
        );
      }
      if (response.status === 404) {
        throw new PassageNotFoundError('requested passage', 'NLT');
      }
      if (response.status === 429) {
        throw new ProviderUnavailableError('API.Bible rate limit reached. Try again shortly.');
      }
      if (!response.ok) {
        throw new ProviderUnavailableError(`API.Bible responded with ${response.status}.`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof TranslationUnavailableError ||
        error instanceof PassageNotFoundError ||
        error instanceof ProviderUnavailableError
      ) {
        throw error;
      }
      throw new ProviderUnavailableError(
        controller.signal.aborted
          ? 'API.Bible timed out. The NLT preference has been kept.'
          : 'API.Bible could not be reached from the browser. If this is a CORS problem, call a server-side proxy and set VITE_BIBLE_PROVIDER_BASE_URL to it.',
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function isNltBible(record: ApiBibleRecord): boolean {
  const abbreviation = (record.abbreviationLocal ?? '').toUpperCase();
  const name = record.name ?? '';
  return abbreviation === 'NLT' || /new living translation/i.test(name);
}

export function createBibleProvider(): BibleProvider {
  const baseUrl = import.meta.env.VITE_BIBLE_PROVIDER_BASE_URL;
  if (baseUrl && baseUrl.trim().length > 0) {
    return new LicensedNltProvider(baseUrl.trim());
  }

  const mode = (import.meta.env.VITE_BIBLE_PROVIDER ?? 'preview').toLowerCase();
  if (mode === 'api-bible') {
    return new ApiBibleProvider({
      baseUrl: import.meta.env.VITE_API_BIBLE_BASE_URL?.trim() || 'https://api.scripture.api.bible/v1',
      apiKey: import.meta.env.VITE_API_BIBLE_KEY?.trim() || '',
      bibleId: import.meta.env.VITE_API_BIBLE_ID?.trim() || '',
    });
  }

  return new PreviewBibleProvider();
}

export const bibleProvider = createBibleProvider();
export const isPreviewProvider = bibleProvider.id === 'preview';

/** Surfaced in Settings so the licensing state is never implied. */
export const providerInfo = {
  id: bibleProvider.id,
  name: bibleProvider.displayName,
  mode: isPreviewProvider ? ('preview' as const) : ('connected' as const),
  /**
   * True when a key is embedded in the frontend build. That is only acceptable
   * for a private POC; production should call a server-side proxy instead.
   */
  keyInFrontend: Boolean(import.meta.env.VITE_API_BIBLE_KEY?.trim()),
  usingProxy: Boolean(import.meta.env.VITE_BIBLE_PROVIDER_BASE_URL?.trim())
};

