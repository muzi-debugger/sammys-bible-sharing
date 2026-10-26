# Status — Sammy's Bible Sharing

_Snapshot: 2026-10-26. Preview build at `~/code/app/sammys-bible-sharing`._

---

## 1. What is here (working today)

### Pages
| Route | What it does |
| --- | --- |
| `/#/` Home | Greeting + date, cycle status chips, "Today's Scripture" hero with reflection prompt, "Our Scriptures for Sunday" cards, live UTC countdown, "A little encouragement for today", "Make space for Sunday" prompts, "Your Sunday Study" status strip |
| `/#/weekly` Our Weekly Scriptures | Monday / Tue–Sat / Sunday rhythm timeline, week browser (4 seeded weeks), both full passages, assignment date, email delivery status, own-notes preview, locked panel for the partner's private notes |
| `/#/sunday-study` Sunday Study | Tabs: **My Notebook**, **Our Shared Takeaways**, **Both Scriptures**. Long-form writing area + 5 collapsible prompts, debounced autosave, save-state indicator, "Read My Notes" reading mode, "Back to Editing", previous weeks, privacy notices |
| `/#/journal` Scripture Journal | Search by reference/keyword, filters (weekly / daily / bookmarks / reflections) with counts, expandable entries, edit reflections, remove bookmarks with confirmation, sample-vs-saved labelling |
| `/#/settings` Settings | Partner names + emails, UTC schedule and SAST equivalent, last/next selection, last delivery, daily email prefs + time/timezone, NLT licence checklist, notification switches, privacy switch, account panel, email-attempt log, reset preview data |
| `/#/login` Sign in | Email + password, clear errors, list of the two invited addresses and their state |
| `/#/register` Create account | Name, invited email, password + confirm; only the two invited addresses may register |

### Behaviour verified in the browser
- Autosave: typing updates the store after ~900 ms, flips `isSample` → false, shows "All changes saved" + timestamp.
- Reading mode renders every saved section; "Back to Editing" returns to the editor.
- Privacy boundary: switching to Sammy shows Sammy's passage and an empty notebook — Sam's writing is not rendered, fetched or present in the DOM.
- Journal search (`psalm` → 3 entries) and type filters behave correctly.
- Shared takeaways save and are stored separately from private notes.
- Responsive: 390 px wide viewport has no horizontal scroll; bottom navigation present, sidebar hidden.
- No runtime/console errors on any of the five routes after a fresh load.
- `npx tsc -b --noEmit` and `npm run build` both pass.

### Auth + deployment verified
- Visiting any app route while signed out redirects to `/#/login`; the login and register pages are
the only public routes.
- Registering the first invited address lands on the home page with “Good morning, Sam.”;
signing out returns to `/#/login`; a wrong password shows “That password does not match this
account.” The login page does not display either invited address.
- Only the two hard-coded invited addresses can register; a second registration of the same
address is refused.
- Signing in as Sammy shows Sammy's passage and an empty notebook — none of Sam's writing is
fetched or rendered. There is no account switcher anywhere in the UI.
- Sidebar shows the signed-in name + email; Settings edits write back to the account.
- `base: './'` build output is path-relative, so the same `dist/` works at a GitHub Pages project
URL.

### Architecture in place
```
src/components   AppShell, SidebarNavigation, MobileNavigation, ScripturePanel,
                 WeeklyScriptureCard, DailyEncouragementCard, CountdownCard,
                 ReflectionModal, SaveStatus, DeliveryStatus, Botanical (SVG line art),
                 ui/ (Button, Card, Badge, Field, Toggle, Modal, Toast, ConfirmDialog, states)
src/context      AppContext — db subscription, session, derived week/assignment/daily data
src/data         curated reference catalogs (weekly pool + 10 daily themes), preview seed
src/lib          dates (ISO week, UTC schedule, countdown), navigation, cn
src/pages        Home, WeeklyScriptures, SundayStudy, Journal, Settings
src/services     storage, bibleProvider, scriptureAssignment, dailyScripture, emailDelivery,
                 personalStudy, journal, settings, passageFactory
src/types        domain model
supabase/        schema.sql (tables + RLS) and functions/weekly-selection (reference job)
docs/            nlt-provider-verification.md
```

Service interfaces with preview implementations: `BibleProvider`, `ScriptureAssignmentService`,
`DailyScriptureService`, `EmailDeliveryService`, `PersonalStudyService`, `JournalService`,
`SettingsService`. Idempotent weekly cycle (`YYYY-Www`), selection history window, distinct
passages (different reference, book and theme), ownership checks on every notebook read/write.

---

## 2. What is flagged (deliberately not working)

### 🔴 NLT text — provider chosen, access still pending
- The mandatory translation is the **New Living Translation**, copyrighted by Tyndale.
- Six providers were probed on 2026-10-26. Only one can serve the NLT legitimately:
  `bible-api.com` (404 for NLT), `bible.helloao.org` (no NLT), `api.getbible.net` (no NLT),
  `bolls.life` (no NLT), `wldeh/bible-api` (no English NLT), and
  **API.Bible `api.scripture.api.bible`** → `401 Missing API key`, i.e. licensed access on request.
- `ApiBibleProvider` is implemented: resolves the NLT bible id at runtime, converts
  `Psalm 23:1-6` → `PSA.23.1-6`, strips markup, uses `data.copyright` as attribution, and rejects
  anything not confirmed NLT.
- **Still blocked on:** a free API.Bible key **with NLT access approved by Tyndale**. Until then
  every passage renders as `Preview placeholder — not Scripture text` (`NLT · Preview`), and no
  substitute translation is ever used.
- Enable by setting `VITE_BIBLE_PROVIDER=api-bible` plus `VITE_API_BIBLE_KEY` (POC) or
  `VITE_BIBLE_PROVIDER_BASE_URL` (proxy — recommended, keeps the key server-side).

### 🔴 Email — not connected
- `PreviewEmailDeliveryService` only logs attempts. Status is always `preview`; the UI never
  claims queued/sent/delivered. No credentials exist in the frontend.
- Action needed: Resend (or similar) server-side + delivery webhooks; map `queued / accepted /
  delivered / bounced / failed`.

### 🔴 Backend, scheduler, accounts — preview only
- Persistence is `localStorage` under `sbs.preview.database.v1`. Data is **per browser profile**,
  so Sam and Sammy do not share data across devices.
- Two invited identities come from env vars (`VITE_PARTNER_ONE_*`, `VITE_PARTNER_TWO_*`) —
  `.env.local` locally (gitignored), repository secrets in CI — so no addresses exist in the repo
  or on the sign-in page. Only those addresses may register; first registration sets the password.
- Authentication is a real flow (`src/services/auth.ts`, `AuthProvider`, route guards): salted
  SHA-256 password digests in `sbs.accounts.v1`, session in `sbs.session.v1`. It gates the whole
  app and there is no account switching — but it is
  **client-side only**, so it is not a security boundary against someone with browser access.
  Replace with Supabase Auth when the backend lands; the guards stay the same.
- The Monday 10:00 UTC job is simulated once on load (`origin: "preview-simulation"`), clearly
  labelled in the UI. No cron is deployed.
- `supabase/schema.sql` and `supabase/functions/weekly-selection/index.ts` are **reference
  implementations only** — not deployed, not tested against a live database.

### 🟠 Preview-data caveats
- Seeded sample notebooks are labelled `Sample`. Anything the user writes is marked as theirs.
- "Reset preview data" in Settings wipes local data and rebuilds the seed.
- Countdown, schedule and SAST conversion are computed from real UTC maths, not faked.

### 🟠 Content/design rules enforced
- No depictions of Jesus, God, angels or biblical figures; ornament is botanical/typographic only.
- NLT remains the only translation offered; the selector is disabled until a licensed provider is
  verified.

---

## 3. Live deployment — Cloudflare Workers static assets

**Live:** https://sammys-bible-sharing.mmzolodev.workers.dev

Build: Cloudflare Workers Builds → `npm ci && npm run build` → `npx wrangler deploy`
(`wrangler.jsonc`: assets from `./dist`, SPA fallback, Node 20 via `.nvmrc`).

Verified live on 2026-10-26: index + JS return 200 over HTTPS, unauthenticated visits redirect to
`/#/login`, the page shows neither address, the configuration notice is absent, and both addresses
are present in the compiled bundle — proving `VITE_PARTNER_*` reached the build.

Hardening: `preview_urls: false` so versioned preview URLs cannot bypass a future Cloudflare Access
policy. Recommended next: **Zero Trust → Access** on the workers.dev host, one-time PIN limited to
the two partner addresses.

GitHub Pages remains wired in `.github/workflows/deploy.yml` but cannot run: *“The job was not
started because your account is locked due to a billing issue.”*

## 4. Remaining gaps to close before it is a real two-person app

| # | Gap | Blocked on |
| --- | --- | --- |
| 1 | ~~Data is per-browser~~ — Supabase mode loads and writes real rows | env vars + redeploy |
| 2 | ~~Auth is client-side~~ — Supabase Auth when `VITE_DATA_MODE=supabase` (password reset still missing) | code |
| 3 | ~~Notebook privacy is service-layer only~~ — RLS `auth.uid() = user_id` | env vars + redeploy |
| 4 | Monday 10:00 UTC selection and daily verse are simulated (`ensure_current_week()` RPC on login) | `pg_cron` + edge function |
| 5 | No emails are sent | Email provider (Brevo) + edge function |
| 6 | Every passage is a placeholder | API.Bible key **with NLT approved** |
| 7 | Seed data still backs local mode only; Supabase mode starts empty | done by design |
| 8 | No automated tests (manual browser checks only) | code work |
| 9 | No PWA manifest / install icon | code work |

### Who does what

**You (account-level, cannot be automated):**
1. Cloudflare — set `VITE_PARTNER_ONE_EMAIL`, `VITE_PARTNER_TWO_EMAIL`, `VITE_PARTNER_ONE_NAME`,
   `VITE_PARTNER_TWO_NAME` as **build** variables/secrets (already present, since they reached the
   build); optionally enable Cloudflare Access.
2. Supabase — create a project, run `supabase/schema.sql`, create the two users, then share the
   **Project URL** and **anon/publishable key** (safe to share). Keep the **service-role key** out of
   the repo and out of this chat; it belongs in Supabase secrets / Cloudflare secrets only.
3. API.Bible — create a key and request translation access. NLT needs publisher approval; **NIV and
   CEV need approval too** — switching translation does not bypass licensing. Only public-domain
   translations (WEB, ASV, KJV, BBE) are instantly usable.
4. Email — create a free account (Brevo: 300/day, sender-address verification, no domain needed;
   Resend: 100/day but domain verification required) and keep the API key server-side.

**Me (code):**
- Supabase repository layer behind `VITE_DATA_MODE`, replacing the local store.
- Supabase Auth screens (sign-in, register, password reset) and route guards.
- Scheduled selection + daily verse as an edge function, idempotent per cycle id.
- Email templates + delivery status mapping.
- Enable `ApiBibleProvider` and remove the placeholder path once a key exists.

- **Data stays in one browser.** The hosted site still stores everything in that visitor's
  `localStorage`, so the two partners do not share a cycle or see each other's devices. Supabase's
  free tier covers auth + Postgres + RLS + cron + edge functions.
- **NIV and CEV are not a shortcut.** Both are copyrighted; API.Bible requires publisher approval
  for them exactly as for the NLT. Only public-domain translations (WEB, ASV, KJV, BBE) are
  available without approval.
- **Licensing is independent of hosting.** A domain or a free host grants no rights to any
  copyrighted translation.

### Suggested order
1. Supabase project (free) → run `supabase/schema.sql` → send the Project URL + anon key. I swap the
   local store for Supabase and move auth to Supabase Auth (this unblocks sharing, RLS and reset).
2. API.Bible key → request NLT (and NIV/CEV only if you accept the same approval wait). I enable
   `ApiBibleProvider` and the placeholder path disappears.
3. Email provider (Brevo free) → sender verified → key stored server-side. I add the weekly/daily
   templates and delivery states.
4. Cloudflare Access on the workers.dev host so only the two of you can load the app at all.
