# Sammy's Bible Sharing

A private Scripture-sharing and Bible-study companion for two people. React + TypeScript +
Tailwind, built frontend-first with a service layer that is ready for a licensed NLT provider,
a Supabase backend and a transactional email provider.

> **Preview build.** No licensed New Living Translation text is bundled. No backend,
> scheduler or email provider is connected. Every passage is an explicitly labelled
> placeholder, and no email is ever reported as sent.

See [`STATUS.md`](./STATUS.md) for a current inventory of what works and what is deliberately
flagged, plus free-hosting notes.

## Run it

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # typecheck + production bundle
```

## What is implemented

| Area | Status |
| --- | --- |
| Responsive shell, sidebar (desktop) and bottom navigation (mobile) | Done |
| Home: greeting, today's Scripture, weekly cards, countdown, daily encouragement, Sunday preparation, notebook status | Done |
| Our Weekly Scriptures: rhythm timeline, week browser, both assignments, delivery status | Done |
| Sunday Study: private notebook, autosave, reading mode, previous weeks, shared takeaways, both passages | Done |
| Scripture Journal: search, type filters, expand, edit reflections, bookmark removal | Done |
| Settings: partners, schedule (UTC), daily preferences, NLT status, notifications, privacy, preview data | Done |
| Service layer: `BibleProvider`, `ScriptureAssignmentService`, `DailyScriptureService`, `EmailDeliveryService`, `JournalService`, `PersonalStudyService` | Done |
| Persistence | `localStorage` preview store (`sbs.preview.database.v1`) |
| Licensed NLT source | **Not configured** — provider adapter exists, access unverified |
| Supabase schema + RLS | Reference SQL in `supabase/schema.sql` (not deployed) |
| Scheduled Monday 10:00 UTC job | Preview simulation on load — never claimed as a real run |
| Transactional email | Preview logger only — status is `preview`, never `sent` |

## Architecture

```
src/
  components/     presentational + composed UI (AppShell, ScripturePanel, cards, ui/*)
  context/        AppContext: db subscription, session, derived week/assignment data
  data/           curated reference catalogs + preview seed
  lib/            dates (ISO week, UTC schedule, countdown), nav config, cn
  pages/          Home, Weekly Scriptures, Sunday Study, Journal, Settings
  services/       storage, bibleProvider, scriptureAssignment, dailyScripture,
                  emailDelivery, personalStudy, journal, settings
  types/          domain model
```

Key rules encoded in the code:

- `passage.translation` is always `'NLT'`; `passage.contentKind` is `'placeholder'` until a
  licensed source returns verified NLT text. The badge renders `NLT · Preview` for placeholders,
  so no substitute translation can ever be mislabelled.
- `LicensedNltProvider` rejects any response whose translation is not NLT or whose content is not
  flagged `licensed`, throwing `TranslationUnavailableError` — never a silent fallback.
- Weekly selection is idempotent per cycle id (`YYYY-Www`), so refreshes and retries cannot
  replace assignments or duplicate emails.
- Every personal-study read/write is scoped by `userId`, mirroring the Supabase RLS policy.

## Personal notebook privacy

`PersonalStudyService` refuses to return or mutate a record that does not belong to the signed-in
user (`OwnershipError`). The UI can therefore never render the other partner's notes: it only ever
reads `getForAssignment(currentUser.id, …)`. Switch preview accounts in the sidebar to see the
boundary — Sam's writing is not visible while signed in as Sammy.

The equivalent database enforcement is in `supabase/schema.sql`
(`personal_studies` policies use `auth.uid() = user_id` for select/insert/update/delete).

## NLT licensing

Read `docs/nlt-provider-verification.md`. Five providers were probed on 2026-10-26:
`bible-api.com` (404 for NLT), `bible.helloao.org` (1,256 translations, no NLT),
`api.getbible.net` (117, no NLT), `bolls.life` (no NLT), `wldeh/bible-api` (no English NLT).

**Chosen provider: [API.Bible](https://api.bible)** — the American Bible Society platform that
licenses the NLT. Its `/v1/bibles` endpoint answers `401 Missing API key`, which is expected: you
request a free key and then request NLT access, which the rights holder (Tyndale) must approve.

1. Create a key at <https://api.bible>.
2. In the dashboard, request access to the **New Living Translation**.
3. Enable the adapter:

```bash
# .env.local
VITE_BIBLE_PROVIDER=api-bible
VITE_API_BIBLE_KEY=your-key            # POC only — ships to the browser
# or, better, point at a proxy instead of shipping a key:
VITE_BIBLE_PROVIDER_BASE_URL=https://your-proxy.example.com/bible
```

`ApiBibleProvider` resolves the NLT bible id at runtime (never hard-coded), converts
`Psalm 23:1-6` → `PSA.23.1-6`, strips markup, and rejects any response that is not confirmed NLT.
If NLT is not approved for your key, the UI shows the error and keeps the NLT preference.

## Accounts and privacy

- `/#/login` and `/#/register` are the only public routes; every other route is guarded.
- Two invited identities are hard-coded for the POC in `src/services/auth.ts`. Only those two
  addresses may register; the first registration sets the password. The sign-in page never lists
  them, so the addresses are not exposed publicly.
- There is no account switcher. Sign out and back in with the other partner's credentials to see
  their notebook — that is the only way, and the UI never offers a shortcut.
- The welcome message, sidebar and every email use the signed-in account's name and address; edits
  in Settings are written back to the account.
- Passwords are salted SHA-256 digests in `localStorage` (`sbs.accounts.v1`). This proves the flow
  but is **not** a real security boundary — replace with Supabase Auth when the backend lands.

## Deploying to GitHub Pages (free)

`.github/workflows/deploy.yml` builds with `npm ci && npm run build` and publishes `dist/`.
`vite.config.ts` uses `base: './'` so the same artifact works at `/<repo>/`, `public/.nojekyll` is
included, and `HashRouter` means no SPA rewrite rules are needed.

```bash
git init -b main && git add -A && git commit -m "Sammy's Bible Sharing"
gh repo create sammys-bible-sharing --public --source=. --remote=origin --push
gh api -X POST repos/:owner/sammys-bible-sharing/pages -f build_type=workflow
gh workflow run deploy.yml
```

Then **Settings → Pages** shows `https://<user>.github.io/sammys-bible-sharing/`. Optional repo
variable `VITE_BIBLE_PROVIDER=api-bible` and secret `VITE_API_BIBLE_KEY` feed the build.

## Next phases

1. **Provider** — licence the NLT, deploy the proxy, flip `licensedProviderVerified`.
2. **Backend** — apply `supabase/schema.sql`, replace the preview store with Supabase queries.
3. **Automation** — deploy `supabase/functions/weekly-selection` with `pg_cron` at
   `0 10 * * 1` UTC; Resend (or similar) for email with delivery webhooks.
4. **Testing** — the acceptance list in the brief (distinct passages, verified NLT, correct
   recipients, timezone handling, stable assignments, safe retries, privacy, failure handling).

## Preview data

Everything lives in this browser. Use **Settings → Reset preview data** to rebuild the seed.
Entries seeded from sample content are labelled `Sample`; anything you write is marked as yours.
