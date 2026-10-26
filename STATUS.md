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
- Authentication now exists as a flow (`src/services/auth.ts`, `AuthProvider`, route guards): two
  hard-coded invited emails, salted SHA-256 password digests in `sbs.accounts.v1`, session in
  `sbs.session.v1`. It gates the whole app and there is no account switching — but it is
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

## 3. Free hosting — GitHub Pages (chosen)

The build output is a static bundle (`dist/`), so it can be hosted free. This project is now wired
for **GitHub Pages** via `.github/workflows/deploy.yml`:

```bash
cd ~/code/app/sammys-bible-sharing
git init -b main && git add -A && git commit -m "Sammy's Bible Sharing"
gh repo create sammys-bible-sharing --public --source=. --remote=origin --push
gh api -X POST repos/:owner/sammys-bible-sharing/pages -f build_type=workflow
gh workflow run deploy.yml
```

The workflow runs `npm ci && npm run build` and publishes `dist/`. `vite.config.ts` uses
`base: './'` (works at `/<repo>/`), `public/.nojekyll` is included, and `HashRouter` means no SPA
rewrite rules are required.

Optional repo **variable** `VITE_BIBLE_PROVIDER=api-bible` and **secret** `VITE_API_BIBLE_KEY`
feed the build so the deployed site uses the real provider.

Alternatives that also work freely: Vercel Hobby (personal/non-commercial), Cloudflare Pages,
Netlify Starter.

### What free hosting does **not** solve
- **Data stays in one browser.** A hosted static site still stores everything in that visitor's
  `localStorage`. For Sam and Sammy to share a weekly cycle and each keep a private notebook
  across devices, you need a backend — Supabase's free tier covers auth + Postgres + RLS + cron +
  edge functions, which is why the schema and job are already sketched in `supabase/`.
- **No real emails** until an email provider is connected (Resend has a free tier; sending to
  your own verified domain/addresses is sufficient for a two-person app).
- **NLT licensing is independent of hosting.** Buying a domain or using a free host does not grant
  permission to display NLT text.

### Suggested order
1. Deploy the preview build to Vercel (free) so you can look at it on your phone.
2. Resolve NLT licensing → point `VITE_BIBLE_PROVIDER_BASE_URL` at a proxy.
3. Create a Supabase project (free) → apply `supabase/schema.sql` → swap the preview store for
   Supabase queries → deploy `weekly-selection` + `pg_cron` → connect Resend.
