// ---------------------------------------------------------------------------
// supabase/functions/bible/index.ts
//
// Server-side proxy so the API.Bible key never reaches the browser bundle.
// The frontend uses it through LicensedNltProvider:
//   VITE_BIBLE_PROVIDER_BASE_URL=https://<ref>.supabase.co/functions/v1/bible
//
//   GET  .../bible/translations
//   GET  .../bible/passage?reference=Psalm%2023:1-6&translation=NLT
//
// Secret: API_BIBLE_KEY   (optional API_BIBLE_BASE_URL, ALLOWED_ORIGIN)
// ---------------------------------------------------------------------------

const BASE = Deno.env.get('API_BIBLE_BASE_URL') ?? 'https://rest.api.bible/v1';
const KEY = Deno.env.get('API_BIBLE_KEY') ?? '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const USFM: Record<string, string> = {
  genesis: 'GEN', exodus: 'EXO', leviticus: 'LEV', numbers: 'NUM', deuteronomy: 'DEU',
  joshua: 'JOS', judges: 'JDG', ruth: 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
  '1 kings': '1KI', '2 kings': '2KI', '1 chronicles': '1CH', '2 chronicles': '2CH',
  ezra: 'EZR', nehemiah: 'NEH', esther: 'EST', job: 'JOB', psalm: 'PSA', psalms: 'PSA',
  proverbs: 'PRO', ecclesiastes: 'ECC', 'song of songs': 'SNG', isaiah: 'ISA',
  jeremiah: 'JER', lamentations: 'LAM', ezekiel: 'EZK', daniel: 'DAN', hosea: 'HOS',
  joel: 'JOL', amos: 'AMO', obadiah: 'OBA', jonah: 'JON', micah: 'MIC', nahum: 'NAM',
  habakkuk: 'HAB', zephaniah: 'ZEP', haggai: 'HAG', zechariah: 'ZEC', malachi: 'MAL',
  matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT', romans: 'ROM',
  '1 corinthians': '1CO', '2 corinthians': '2CO', galatians: 'GAL', ephesians: 'EPH',
  philippians: 'PHP', colossians: 'COL', '1 thessalonians': '1TH', '2 thessalonians': '2TH',
  '1 timothy': '1TI', '2 timothy': '2TI', titus: 'TIT', philemon: 'PHM', hebrews: 'HEB',
  james: 'JAS', '1 peter': '1PE', '2 peter': '2PE', '1 john': '1JN', '2 john': '2JN',
  '3 john': '3JN', jude: 'JUD', revelation: 'REV',
};

const headers = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headers() });

function parseReference(reference: string) {
  const match = /^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/.exec(reference.trim());
  if (!match) return null;
  const [, book, chapter, start, end] = match;
  return {
    book,
    chapter: Number(chapter),
    verseStart: Number(start),
    verseEnd: Number(end ?? start),
  };
}

let cachedBibleId: string | null = null;

async function resolveNltId(): Promise<string | null> {
  if (cachedBibleId) return cachedBibleId;
  const response = await fetch(`${BASE}/bibles?language=eng`, { headers: { 'api-key': KEY } });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: Array<{ id: string; abbreviationLocal?: string; name?: string }>;
  };
  const nlt = (payload.data ?? []).find(
    (bible) =>
      (bible.abbreviationLocal ?? '').toUpperCase() === 'NLT' ||
      /new living translation/i.test(bible.name ?? ''),
  );
  cachedBibleId = nlt?.id ?? null;
  return cachedBibleId;
}

function plainText(content: string): string {
  return content
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers() });
  if (!KEY) return json({ error: 'API_BIBLE_KEY is not set for this function' }, 503);

  const url = new URL(request.url);

  if (url.pathname.endsWith('/translations')) {
    const bibleId = await resolveNltId();
    if (!bibleId) {
      return json(
        {
          error:
            'This API.Bible key does not have the New Living Translation approved. No substitute translation is used.',
        },
        403,
      );
    }
    return json([{ id: 'NLT', name: 'New Living Translation', licensed: true, supportsNlt: true }]);
  }

  if (url.pathname.endsWith('/passage')) {
    const reference = url.searchParams.get('reference') ?? '';
    const translation = (url.searchParams.get('translation') ?? 'NLT').toUpperCase();
    if (translation !== 'NLT') {
      return json({ error: 'Only NLT is served; no fallback translation is used.' }, 400);
    }

    const parsed = parseReference(reference);
    const bookId = parsed ? USFM[parsed.book.toLowerCase()] : undefined;
    if (!parsed || !bookId) return json({ error: `Unsupported reference: ${reference}` }, 400);

    const bibleId = await resolveNltId();
    if (!bibleId) return json({ error: 'NLT is not available for this key' }, 403);

    const passageId =
      parsed.verseEnd !== parsed.verseStart
        ? `${bookId}.${parsed.chapter}.${parsed.verseStart}-${bookId}.${parsed.chapter}.${parsed.verseEnd}`
        : `${bookId}.${parsed.chapter}.${parsed.verseStart}`;

    const query = new URLSearchParams({
      'content-type': 'text',
      'include-verse-numbers': 'false',
      'include-chapter-numbers': 'false',
    });

    const response = await fetch(
      `${BASE}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?${query.toString()}`,
      { headers: { 'api-key': KEY } },
    );
    const payload = await response.json();
    if (!response.ok) {
      return json({ error: payload?.message ?? `API.Bible responded ${response.status}` }, 502);
    }

    const data = payload.data as {
      reference: string;
      content: string;
      copyright?: string;
    };

    return json({
      reference: data.reference,
      book: parsed.book,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd,
      translation: 'NLT',
      text: plainText(data.content),
      attribution:
        data.copyright?.trim() ||
        'New Living Translation, copyright © Tyndale House Publishers. Used by permission.',
      providerId: 'api-bible',
      providerName: 'API.Bible (American Bible Society)',
      contentKind: 'licensed',
    });
  }

  return json({ error: 'Unknown route' }, 404);
});
