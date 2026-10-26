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

## Email (Brevo)

**Brevo SMTP keys do not work here** — edge functions cannot open SMTP sockets. Use a Brevo
**API v3 key** (Brevo → SMTP & API → API Keys), and verify a sender under Senders & Domains.

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy send-email --no-verify-jwt
supabase secrets set BREVO_API_KEY=xkeysib-... EMAIL_FROM="Sammy <you@example.com>" \
  APP_URL="https://sammys-bible-sharing.mmzolodev.workers.dev" CRON_SECRET="<random>"
```

Then run `supabase/003-email-and-cron.sql` with `<PROJECT_REF>` and `<EDGE_CRON_SECRET>` replaced.
That creates `ensure_today_daily()` and the two `pg_cron` jobs (Monday 10:00 UTC, daily 06:00 UTC).

`POST /functions/v1/send-email` accepts `{"mode":"weekly"|"daily"|"test"}`. Scheduled calls
authenticate with `x-cron-secret`; a signed-in user can only trigger `test`, which mails their own
address. Delivery rows are written to `email_deliveries`, and `weekly_assignments.email_status`
only moves to `accepted` when Brevo returns 2xx. Accepted rows are never re-sent.

Settings has a **“Send a test email to myself”** button in Supabase mode.

## Accounts and privacy

Two modes, selected by `VITE_DATA_MODE`:

**`local`** (default) — everything in `localStorage`, no server. Useful for design work.

**`supabase`** — real Supabase Auth + Postgres. Run `supabase/schema.sql` then
`supabase/002-bootstrap.sql`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and the app:

- signs in through `supabase.auth` (session persisted, refreshed automatically),
- loads one snapshot of the household's cycles, assignments, daily passages and your own notes,
- writes notebooks, bookmarks, reflections and shared takeaways straight to Postgres,
- is protected by RLS: `personal_studies`, `bookmarks` and `reflections` are `auth.uid() = user_id`,
  so the other partner's rows cannot be selected even with the anon key.

`002-bootstrap.sql` also adds `handle_new_user()` (creates the household + profile with the free
slot) and `ensure_current_week()` — an idempotent stand-in for the cron job that creates this
week's cycle and two distinct assignments for the household.

Invitations, the welcome name and email delivery recipients all still come from
`VITE_PARTNER_*`, so the repository holds no addresses.

- `/#/login` and `/#/register` are the only public routes; every other route is guarded.
- Two invited identities come from `VITE_PARTNER_ONE_*` / `VITE_PARTNER_TWO_*`. Locally they live in
  `.env.local` (gitignored); on GitHub they come from repository secrets, so **the repo contains no
  personal addresses**. Only those two addresses may register; the first registration sets the
  password, and the sign-in page never lists them.
- There is no account switcher. Sign out and back in with the other partner's credentials to see
  their notebook — that is the only way, and the UI never offers a shortcut.
- The welcome message, sidebar and every email use the signed-in account's name and address; edits
  in Settings are written back to the account.
- Passwords are salted SHA-256 digests in `localStorage` (`sbs.accounts.v1`). This proves the flow
  but is **not** a real security boundary — replace with Supabase Auth when the backend lands.

```bash
cp .env.example .env.local   # fill in the two partner names and addresses
npm run dev
```

On GitHub, set repository **secrets** `VITE_PARTNER_ONE_EMAIL`, `VITE_PARTNER_TWO_EMAIL` and
repository **variables** `VITE_PARTNER_ONE_NAME`, `VITE_PARTNER_TWO_NAME` before the first deploy.
Without the emails the build still runs, but it shows a “no partner addresses configured” notice
and nobody can sign in.

## Deploying — Cloudflare Pages (primary, free)

GitHub Actions is currently blocked for this account (“locked due to a billing issue”), so Pages is
built by Cloudflare instead. Connect the repo once and set:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* |
| Node version | `20` (also pinned in `.nvmrc`) |

Environment variables (Production **and** Preview):

| Name | Value |
| --- | --- |
| `VITE_PARTNER_ONE_NAME` | from `.env.local` |
| `VITE_PARTNER_ONE_EMAIL` | from `.env.local` |
| `VITE_PARTNER_TWO_NAME` | from `.env.local` |
| `VITE_PARTNER_TWO_EMAIL` | from `.env.local` |
| `VITE_BIBLE_PROVIDER` | `api-bible` once NLT is approved |
| `VITE_API_BIBLE_KEY` | API.Bible key (mark as secret) |

Because Vite inlines `VITE_*` into the client bundle, the two addresses exist inside the deployed
JavaScript even though nothing displays them. Keep the site private with **Cloudflare Access**
(Zero Trust → Access → Applications → self-hosted, one-time-PIN policy limited to those two
addresses) — free for up to 50 users.

### Variant: Cloudflare Workers static assets

`wrangler.jsonc` is included, so `npm run build && npx wrangler deploy` publishes the same `dist/`
as a Worker (URL `https://<worker>.<subdomain>.workers.dev`). If the dashboard screen shows
**“Deploy command: npx wrangler deploy”**, that is the Workers flow — either keep it (the config
above covers build + assets) or switch to **Pages → Connect to Git**, which has better-known
build-time environment variable handling for Vite.

### Alternative: GitHub Pages (needs Actions)

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

> **If GitHub Actions is unavailable** (for example “The job was not started because your account
> is locked due to a billing issue”), Pages cannot be built by the workflow. Resolve the billing
> issue in GitHub → Settings → Billing, or use Cloudflare Pages above. Do **not** commit a built
> `dist/` with real addresses inside it — the VITE_ values are inlined into the bundle.

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
