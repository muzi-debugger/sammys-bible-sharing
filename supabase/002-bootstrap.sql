-- ---------------------------------------------------------------------------
-- 002 — Bootstrap pieces the frontend needs on top of schema.sql
--
-- Run this in the Supabase SQL editor after schema.sql.
--   * creates a household + profile automatically when a user signs up
--   * lets either partner trigger this week's selection once (idempotent),
--     because the pg_cron job is not deployed yet
--   * adds the missing write policies for shared_takeaways
-- ---------------------------------------------------------------------------

-- 1. Signup -> household + profile ------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hh uuid;
  next_slot text;
begin
  select id into hh from public.households order by created_at limit 1;

  if hh is null then
    insert into public.households (name) values ('Our household') returning id into hh;
  end if;

  select case when exists (select 1 from public.profiles where slot = 'sam') then 'sammy' else 'sam' end
    into next_slot;

  insert into public.profiles (id, household_id, display_name, email, slot)
  values (
    new.id,
    hh,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    next_slot
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Missing shared_takeaways write policies ---------------------------------
drop policy if exists "shared insert household" on public.shared_takeaways;
create policy "shared insert household" on public.shared_takeaways
  for insert to authenticated
  with check (true);

drop policy if exists "shared update household" on public.shared_takeaways;
create policy "shared update household" on public.shared_takeaways
  for update to authenticated
  using (true) with check (true);

-- 3. Weekly selection stub ---------------------------------------------------
-- Until pg_cron + the edge function exist, either partner can call this once per
-- week. It is idempotent, picks two distinct references, and stores the same
-- clearly-labelled placeholder passage the preview build uses (no NLT text).
create or replace function public.ensure_current_week()
returns text
language plpgsql
security definer
set search_path = public
as $$
-- SUPERSEDED BY 005-distinct-weekly-passages.sql.
-- This version initialised `i` and `used` on every call, so a partner who
-- registered in a later call got the SAME passage as their partner. Run 005
-- after this file; it replaces this function with a version that seeds the
-- duplicate check from assignments already present for the cycle.
declare
  monday        date := date_trunc('week', (now() at time zone 'utc'))::date;
  cid           text := to_char(date_trunc('week', (now() at time zone 'utc')), 'IYYY-"W"IW');
  partner       record;
  refs          text[] := array['Psalm 23:1-6', 'Philippians 4:6-7', 'Proverbs 3:5-6',
                                'Isaiah 40:28-31', '1 Corinthians 13:4-7', 'Hebrews 11:1-3',
                                'Joshua 1:7-9', 'Psalm 100:1-5', 'James 1:2-4',
                                'Colossians 3:12-14', 'Romans 15:4-6', 'Psalm 27:1-5'];
  themes        text[] := array['Faith', 'Peace', 'Wisdom', 'Patience', 'Love', 'Faith',
                                'Courage', 'Gratitude', 'Perseverance', 'Forgiveness', 'Hope', 'Courage'];
  i             int := 0;
  pick          int;
  used          int[] := '{}';
  focus         text;
  body          text;
  rec           record;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'No profile for the signed-in user';
  end if;

  insert into public.weekly_cycles (id, week_start, selection_at, generated_at, origin)
  values (cid, monday, monday + interval '10 hours', now(), 'preview-simulation')
  on conflict (id) do nothing;

  for partner in
    select p.id, p.email from public.profiles p
    where p.household_id = public.current_household_id()
    order by p.slot
  loop
    if exists (select 1 from public.weekly_assignments a
               where a.cycle_id = cid and a.user_id = partner.id) then
      continue;
    end if;

    i := i + 1;
    pick := ((abs(hashtext(cid)) + i * 5) % array_length(refs, 1)) + 1;
    while pick = any(used) loop
      pick := (pick % array_length(refs, 1)) + 1;
    end loop;
    used := array_append(used, pick);

    focus := themes[pick];
    body := format(E'Preview placeholder — not Scripture text.\n\nThe New Living Translation text of %s is not included in this build. No licensed NLT provider is connected yet, and the app deliberately shows no substitute translation.\n\nOnce a verified NLT provider is configured, the full passage will appear here and the translation badge will change from “Preview” to “NLT”.', refs[pick]);

    insert into public.weekly_assignments
      (cycle_id, user_id, reference, translation, passage_text, attribution,
       provider_id, content_kind, theme, email_status, email_recipient, email_detail)
    values
      (cid, partner.id, refs[pick], 'NLT', body,
       'No NLT text reproduced. New Living Translation copyright © Tyndale House Publishers. Display and redistribution require a licence.',
       'preview', 'placeholder', focus, 'queued', partner.email,
       'Email service not configured yet — queued, not sent.')
    on conflict do nothing;
  end loop;

  return cid;
end;
$$;

revoke all on function public.ensure_current_week() from anon;
grant execute on function public.ensure_current_week() to authenticated;

-- 4. Handy for debugging: show who is in the household ------------------------
create or replace view public.household_overview as
  select id, slot, display_name, email, created_at from public.profiles;
