-- ---------------------------------------------------------------------------
-- Sammy Bible Sharing — Supabase schema (reference implementation)
--
-- Not applied by this preview build. The frontend currently persists to
-- localStorage; swapping in Supabase means replacing `src/services/storage.ts`
-- with Supabase queries that return the same `PreviewDatabase` shapes.
--
-- Security model
--   * One household (the couple) shares weekly cycles, assignments and shared
--     takeaways.
--   * Each partner's notebook, bookmarks and reflections are private rows.
--     `personal_studies`, `bookmarks` and `reflections` are readable only by
--     their owner via auth.uid().
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Our household',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  email        text not null,
  slot         text not null check (slot in ('sam', 'sammy')),
  created_at   timestamptz not null default now(),
  unique (household_id, slot)
);

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Weekly cycle + assignments
-- ---------------------------------------------------------------------------

create table public.weekly_cycles (
  id           text primary key,                       -- '2026-W44'
  week_start   date not null unique,                   -- Monday
  selection_at timestamptz not null,                   -- Monday 10:00 UTC
  generated_at timestamptz,
  origin       text not null default 'scheduled'
               check (origin in ('scheduled', 'preview-simulation')),
  created_at   timestamptz not null default now()
);

create table public.weekly_assignments (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        text not null references public.weekly_cycles (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  reference       text not null,
  translation     text not null default 'NLT' check (translation = 'NLT'),
  passage_text    text not null,
  attribution     text not null,
  provider_id     text not null,
  content_kind    text not null check (content_kind in ('licensed', 'placeholder')),
  theme           text not null,
  email_status    text not null default 'queued'
                  check (email_status in ('queued','accepted','delivered','bounced','failed')),
  email_recipient text not null,
  email_detail    text,
  assigned_at     timestamptz not null default now(),
  -- One passage per partner per week, and never the same passage twice.
  unique (cycle_id, user_id),
  unique (cycle_id, reference)
);

-- ---------------------------------------------------------------------------
-- Daily encouragement
-- ---------------------------------------------------------------------------

create table public.daily_scriptures (
  id           uuid primary key default gen_random_uuid(),
  day          date not null unique,
  reference    text not null,
  translation  text not null default 'NLT' check (translation = 'NLT'),
  passage_text text not null,
  attribution  text not null,
  provider_id  text not null,
  content_kind text not null check (content_kind in ('licensed', 'placeholder')),
  theme        text not null,
  selected_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Private notebook (owner-only)
-- ---------------------------------------------------------------------------

create table public.personal_studies (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  weekly_assignment_id     uuid not null references public.weekly_assignments (id) on delete cascade,
  cycle_id                 text not null references public.weekly_cycles (id) on delete cascade,
  scripture_reference      text not null,
  translation              text not null default 'NLT' check (translation = 'NLT'),
  understanding            text not null default '',
  observations             text not null default '',
  lessons_learned          text not null default '',
  questions                text not null default '',
  application              text not null default '',
  sunday_discussion_points text not null default '',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- One notebook per person per week; new weeks never overwrite old ones.
  unique (user_id, weekly_assignment_id)
);

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reference   text not null,
  translation text not null default 'NLT' check (translation = 'NLT'),
  passage_text text not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  unique (user_id, reference)
);

create table public.reflections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reference  text not null,
  translation text not null default 'NLT' check (translation = 'NLT'),
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reference)
);

-- ---------------------------------------------------------------------------
-- Shared takeaways (deliberately separate from private notebooks)
-- ---------------------------------------------------------------------------

create table public.shared_takeaways (
  id                   uuid primary key default gen_random_uuid(),
  cycle_id             text not null unique references public.weekly_cycles (id) on delete cascade,
  main_lesson          text not null default '',
  practical_commitment text not null default '',
  closing_prayer       text not null default '',
  updated_by           uuid references public.profiles (id),
  updated_at           timestamptz not null default now()
);

create table public.email_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('weekly', 'daily', 'sunday-reminder')),
  recipient          text not null,
  subject            text not null,
  provider_message_id text,
  status             text not null check (status in ('queued','accepted','delivered','bounced','failed')),
  detail             text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger personal_studies_touch before update on public.personal_studies
  for each row execute function public.touch_updated_at();
create trigger reflections_touch before update on public.reflections
  for each row execute function public.touch_updated_at();
create trigger shared_takeaways_touch before update on public.shared_takeaways
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.profiles          enable row level security;
alter table public.weekly_cycles     enable row level security;
alter table public.weekly_assignments enable row level security;
alter table public.daily_scriptures  enable row level security;
alter table public.personal_studies  enable row level security;
alter table public.bookmarks         enable row level security;
alter table public.reflections       enable row level security;
alter table public.shared_takeaways  enable row level security;
alter table public.email_deliveries  enable row level security;

-- Household members can see their household and each other's basic profile.
create policy "household read" on public.households
  for select to authenticated using (id = public.current_household_id());

create policy "profile read household" on public.profiles
  for select to authenticated using (household_id = public.current_household_id());

create policy "profile update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Weekly cycles / daily passages: readable by the household, written server-side only.
create policy "cycles read" on public.weekly_cycles
  for select to authenticated using (true);

create policy "assignments read household" on public.weekly_assignments
  for select to authenticated
  using (user_id in (select id from public.profiles where household_id = public.current_household_id()));

create policy "daily read" on public.daily_scriptures
  for select to authenticated using (true);

-- Private notebook: strictly owner-only, enforced in the database.
create policy "study read own" on public.personal_studies
  for select to authenticated using (user_id = auth.uid());

create policy "study insert own" on public.personal_studies
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.weekly_assignments a
      where a.id = weekly_assignment_id and a.user_id = auth.uid()
    )
  );

create policy "study update own" on public.personal_studies
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "study delete own" on public.personal_studies
  for delete to authenticated using (user_id = auth.uid());

-- Bookmarks and reflections: owner-only.
create policy "bookmark read own" on public.bookmarks
  for select to authenticated using (user_id = auth.uid());
create policy "bookmark write own" on public.bookmarks
  for insert to authenticated with check (user_id = auth.uid());
create policy "bookmark update own" on public.bookmarks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookmark delete own" on public.bookmarks
  for delete to authenticated using (user_id = auth.uid());

create policy "reflection read own" on public.reflections
  for select to authenticated using (user_id = auth.uid());
create policy "reflection write own" on public.reflections
  for insert to authenticated with check (user_id = auth.uid());
create policy "reflection update own" on public.reflections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shared takeaways: both partners, never derived from private notes.
create policy "shared read household" on public.shared_takeaways
  for select to authenticated using (true);
create policy "shared insert household" on public.shared_takeaways
  for insert to authenticated with check (updated_by = auth.uid());
create policy "shared update household" on public.shared_takeaways
  for update to authenticated using (true) with check (updated_by = auth.uid());

-- Email deliveries are server-only. No client policy is created on purpose.

-- Service role (scheduler) bypasses RLS; authenticated clients cannot insert
-- assignments, cycles, daily passages or email deliveries.
revoke insert, update, delete on public.weekly_assignments from authenticated;
revoke insert, update, delete on public.weekly_cycles from authenticated;
revoke insert, update, delete on public.daily_scriptures from authenticated;
revoke all on public.email_deliveries from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Scheduling (run after the edge function is deployed)
-- ---------------------------------------------------------------------------
-- Monday 10:00 UTC selection:
--   select cron.schedule('weekly-selection', '0 10 * * 1',
--     $$ select net.http_post(
--          url := 'https://<project>.supabase.co/functions/v1/weekly-selection',
--          headers := jsonb_build_object('Authorization', 'Bearer ' || '<service_role_key>')
--        ) $$);
-- Daily encouragement at 06:00 UTC (08:00 SAST):
--   select cron.schedule('daily-encouragement', '0 6 * * *', … 'daily-encouragement' …);
