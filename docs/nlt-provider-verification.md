# NLT provider verification

Goal: display and email the **New Living Translation** — the mandatory translation for this
application. The NLT is copyrighted by Tyndale House Publishers. A publicly reachable endpoint
does not imply permission to reproduce, cache, or redistribute the full text.

## What was tested (2026-10-26)

### 1. bible-api.com

```
GET https://bible-api.com/data
→ { "translations": [ { identifier: "asv", license: "Public Domain", … }, … ] }

GET https://bible-api.com/john+3:16?translation=nlt
→ 404
```

Finding: the service lists public-domain English translations only (ASV, BBE, Darby, DRA, KJV,
WEB, …). The NLT is **not** available and the request 404s. It also documents usage limits and
asks heavy users to self-host. **Not usable for NLT.**

### 2. bible.helloao.org (Free Use Bible API)

```
GET https://bible.helloao.org/api/available_translations.json
→ 1256 translations
→ names matching "New Living" / "NLT": none
```

Finding: a broad, mostly open-licensed corpus with no NLT entry. **Not usable for NLT.**

## Consequence for this build

- The application keeps **NLT as the only translation** and shows a clearly labelled
  `Preview placeholder — not Scripture text` body instead of any substitute translation.
- Nothing in the UI, the emails, or the journal is ever labelled NLT unless it came from a
  verified licensed source (`contentKind: 'licensed'`).
- The translation selector offers only NLT and is disabled until a licensed provider exists.
- Failing loudly is intentional: `TranslationUnavailableError` is thrown rather than silently
  falling back to NIV, KJV, WEB or any other text.

## Candidate route to licensed NLT access

1. Apply to Tyndale House Publishers for NLT API/redistribution rights (web display and email).
2. Evaluate a commercial Bible API platform that carries NLT under a licence, and confirm the
   licence explicitly covers (a) full-passage web display, (b) reproduction in transactional
   email, (c) storage/caching of retrieved verses, and (d) the size of the audience (two readers,
   private application).
3. Record the outcome in this document and set `settings.translation.licensedProviderVerified`.
4. Deploy a server-side proxy that holds the API key and exposes the adapter contract below.

Until step 3 completes, the app must remain in preview mode.

## Adapter contract

`src/services/bibleProvider.ts` defines:

```ts
interface BibleProvider {
  id: string;
  displayName: string;
  supportsTranslation(translation: string): Promise<boolean>;
  listTranslations(): Promise<ProviderTranslation[]>;
  getPassage({ reference, translation }): Promise<ScripturePassage>;
}
```

The licensed adapter calls:

| Endpoint | Returns |
| --- | --- |
| `GET {baseUrl}/translations` | `[{ id: "NLT", name: "New Living Translation", licensed: true, supportsNlt: true }]` |
| `GET {baseUrl}/passage?reference=Psalm%2023:1-6&translation=NLT` | `{ reference, translation: "NLT", text, attribution, book, chapter, verseStart, verseEnd, contentKind: "licensed", theme, focus }` |

Validation performed by the adapter:

- `translation` must equal `NLT` — otherwise `TranslationUnavailableError`.
- `contentKind` must be `licensed` — otherwise `TranslationUnavailableError`.
- Missing text/reference → `PassageNotFoundError`.
- `429`, timeouts (8s) and network errors → `ProviderUnavailableError`, retried by the scheduler,
  never replaced with different text.

## Storage and caching rules to confirm before launch

- May retrieved passages be stored for a weekly cycle? For how long?
- May they be reproduced in full inside an email to a private recipient?
- Is attribution wording mandated (e.g. "New Living Translation, copyright © 1994, 2004, 2015 by
  Tyndale House Publishers, Inc., Carol Stream, Illinois 60188. All rights reserved.")?
- Must the `Holy Bible, New Living Translation` title line accompany display?

---

# Round 2 — provider search (2026-10-26)

## Providers probed

| Provider | NLT available? | Notes |
| --- | --- | --- |
| `bible-api.com` | No | `translation=nlt` → 404; public-domain English only |
| `bible.helloao.org` | No | 1,256 translations, none is the NLT |
| `api.getbible.net` | No | 117 translations, no "New Living" match |
| `bolls.life` | No | translation index contains no NLT |
| `wldeh/bible-api` (jsDelivr) | No | 210 bibles; only non-English "Biblica Open … Living" texts |
| **`api.scripture.api.bible`** | **Yes — licensed** | Responds `401 {"message":"Missing API key"}`; NLT is requested per key and approved by the rights holder |

## Decision

**API.Bible (American Bible Society)** is the only route above that can legitimately serve the NLT.

1. Create a key at <https://api.bible>.
2. Request **New Living Translation** access in the dashboard (Tyndale approval).
3. Set `VITE_BIBLE_PROVIDER=api-bible` plus either `VITE_API_BIBLE_KEY` (POC, browser-exposed)
   or a proxy URL in `VITE_BIBLE_PROVIDER_BASE_URL` (recommended).

## Adapter behaviour (`ApiBibleProvider`)

- `GET /bibles?language=eng` → finds the bible whose `abbreviationLocal` is `NLT` (or whose name
  matches "New Living Translation"). Nothing is hard-coded; `VITE_API_BIBLE_ID` may pin it.
- `Psalm 23:1-6` → USFM passage id `PSA.23.1-6` for
  `GET /bibles/{bibleId}/passages/{passageId}?content-type=text&include-verse-numbers=false…`
- Content is de-tagged, entity-decoded and paragraph-normalised; `data.copyright` becomes the
  attribution shown under every passage.
- `401/403` → `TranslationUnavailableError` ("key rejected or NLT not approved"),
  `404` → `PassageNotFoundError`, `429`/timeouts → `ProviderUnavailableError`.
- Any payload that is not confirmed NLT is rejected; no fallback translation is ever used.

## Still required from API.Bible

- Confirm the licence explicitly covers full-passage display in a web app **and** reproduction in
  emails to private recipients.
- Confirm whether retrieved passages may be cached for the weekly cycle, and for how long.
- Capture the mandated attribution string from the API response (`data.copyright`).
