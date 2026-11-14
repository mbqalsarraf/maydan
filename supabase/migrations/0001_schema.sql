-- MAYDAN schema: catalogue, atomic reservations, price reports, plans, currency snapshots.
-- All times stored in UTC (timestamptz); presentation is Asia/Kuwait.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('host','provider')),
  name_en text not null, name_ar text not null,
  about_en text not null default '', about_ar text not null default '',
  area text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Host access is provisioned by an administrator only (no client write access).
create table public.host_members (
  host_id uuid not null references public.hosts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (host_id, user_id)
);

create table public.service_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null, name_ar text not null,
  scope_en text not null, scope_ar text not null,
  unit_en text not null, unit_ar text not null
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts on delete cascade,
  type text not null check (type in ('event','course','workshop','service')),
  title_en text not null check (char_length(title_en) between 3 and 120),
  title_ar text not null check (char_length(title_ar) between 3 and 120),
  description_en text not null default '' check (char_length(description_en) <= 2000),
  description_ar text not null default '' check (char_length(description_ar) <= 2000),
  category text not null check (category in ('arts','food','sports','outdoors','learning','family','home')),
  area text not null,
  price_amount numeric(12,3) not null check (price_amount >= 0),
  price_currency text not null default 'KWD' check (price_currency in ('KWD','SAR','AED','QAR','BHD','OMR','USD')),
  min_age int not null default 0 check (min_age between 0 and 99),
  max_age int check (max_age is null or max_age >= min_age),
  level text not null default 'all' check (level in ('all','beginner','intermediate','advanced')),
  is_flexible boolean not null default false,
  duration_minutes int not null check (duration_minutes between 15 and 600),
  service_def_id uuid references public.service_definitions,
  inclusions_en text not null default '', inclusions_ar text not null default '',
  exclusions_en text not null default '', exclusions_ar text not null default '',
  includes_parts boolean not null default false,
  includes_callout boolean not null default false,
  status text not null default 'published' check (status in ('draft','published')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.listings (host_id);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity int not null check (capacity > 0),
  booked_count int not null default 0,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  unique (listing_id, starts_at),
  constraint capacity_not_exceeded check (booked_count >= 0 and booked_count <= capacity)
);
create index on public.occurrences (starts_at);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  user_id uuid not null references auth.users on delete cascade,
  occurrence_id uuid not null references public.occurrences on delete restrict,
  participant_band text not null check (participant_band in ('adult','teen_14_17','child_10_13','child_6_9','child_3_5')),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  price_amount numeric(12,3) not null,
  price_currency text not null,
  idempotency_key uuid not null,
  attended_at timestamptz,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (user_id, idempotency_key)
);
create unique index one_active_reservation on public.reservations (user_id, occurrence_id) where status = 'confirmed';
create index on public.reservations (occurrence_id);

create table public.saved_listings (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table public.follows (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  host_id uuid not null references public.hosts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, host_id)
);

create table public.price_reports (
  id uuid primary key default gen_random_uuid(),
  service_def_id uuid not null references public.service_definitions,
  amount numeric(12,3) not null check (amount > 0 and amount < 100000),
  currency text not null default 'KWD' check (currency in ('KWD','SAR','AED','QAR','BHD','OMR','USD')),
  area text not null check (char_length(area) between 2 and 60),
  includes_parts boolean not null,
  includes_callout boolean not null,
  observed_on date not null check (observed_on <= current_date + 1),
  source_type text not null default 'self_reported' check (source_type in ('demo_sample','self_reported')),
  verification text not null default 'unverified' check (verification in ('demo','unverified','verified')),
  is_demo boolean not null default false,
  reported_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.price_reports (service_def_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  mode text not null default 'manual' check (mode in ('manual','ai','surprise')),
  prefs jsonb not null default '{}'::jsonb,
  ai_notes jsonb,
  updated_at timestamptz not null default now()
);
create table public.plan_items (
  plan_id uuid not null references public.plans on delete cascade,
  position int not null,
  listing_id uuid not null references public.listings on delete cascade,
  occurrence_id uuid not null references public.occurrences on delete cascade,
  primary key (plan_id, position)
);

create table public.app_settings (key text primary key, value jsonb not null);
create table public.fx_snapshots (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('demo','xe')),
  source text not null,
  base text not null,
  rates jsonb not null,           -- units of each currency per 1 unit of base, full precision
  effective_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  refresh_policy text not null default '',
  note text not null default ''
);
-- Server-only bookkeeping (no client grants): AI rate limiting and sign-up throttling.
create table public.ai_usage (user_id uuid not null, at timestamptz not null default now());
create index on public.ai_usage (user_id, at);
create table public.signup_attempts (ip_hash text not null, at timestamptz not null default now());
create index on public.signup_attempts (ip_hash, at);

-- ---------- helper functions ----------
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.is_host_member(p_host uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.host_members m where m.host_id = p_host and m.user_id = (select auth.uid()));
$$;

create function public.band_min_age(p_band text) returns int language sql immutable set search_path = '' as $$
  select case p_band when 'adult' then 18 when 'teen_14_17' then 14 when 'child_10_13' then 10 when 'child_6_9' then 6 when 'child_3_5' then 3 end;
$$;
create function public.band_max_age(p_band text) returns int language sql immutable set search_path = '' as $$
  select case p_band when 'adult' then null when 'teen_14_17' then 17 when 'child_10_13' then 13 when 'child_6_9' then 9 when 'child_3_5' then 5 end;
$$;

-- ---------- atomic reservation ----------
-- Errors are raised with a machine-readable code as the message.
create function public.reserve(p_occurrence uuid, p_band text, p_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_res public.reservations;
  v_occ public.occurrences;
  v_l public.listings;
  v_ref text;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_key is null or p_occurrence is null then raise exception 'invalid_request'; end if;
  if public.band_min_age(p_band) is null then raise exception 'invalid_band'; end if;

  -- Serialise all booking activity of one user (duplicate clicks, overlapping sessions).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 42));

  select * into v_res from public.reservations where user_id = v_uid and idempotency_key = p_key;
  if found then return to_jsonb(v_res) || jsonb_build_object('replayed', true); end if;

  select l.* into v_l from public.listings l join public.occurrences o on o.listing_id = l.id where o.id = p_occurrence;
  if not found or v_l.status <> 'published' then raise exception 'not_found'; end if;

  -- One provider cannot be in two places: lock the provider before checking its diary.
  if v_l.type = 'service' then perform 1 from public.hosts where id = v_l.host_id for update; end if;

  select * into v_occ from public.occurrences where id = p_occurrence for update;
  if v_occ.status <> 'scheduled' then raise exception 'session_cancelled'; end if;
  if (not v_l.is_flexible and v_occ.starts_at <= now()) or v_occ.ends_at <= now() then raise exception 'session_started'; end if;

  if public.band_min_age(p_band) < v_l.min_age
     or (v_l.max_age is not null and coalesce(public.band_max_age(p_band), 999) > v_l.max_age) then
    raise exception 'not_eligible';
  end if;

  if exists (select 1 from public.reservations where user_id = v_uid and occurrence_id = p_occurrence and status = 'confirmed') then
    raise exception 'already_reserved';
  end if;

  if not v_l.is_flexible and exists (
    select 1 from public.reservations r
      join public.occurrences o on o.id = r.occurrence_id
      join public.listings l on l.id = o.listing_id
    where r.user_id = v_uid and r.status = 'confirmed' and r.participant_band = p_band and not l.is_flexible
      and o.starts_at < v_occ.ends_at and o.ends_at > v_occ.starts_at) then
    raise exception 'time_conflict';
  end if;

  if v_l.type = 'service' and exists (
    select 1 from public.reservations r
      join public.occurrences o on o.id = r.occurrence_id
      join public.listings l on l.id = o.listing_id
    where l.host_id = v_l.host_id and r.status = 'confirmed'
      and o.starts_at < v_occ.ends_at and o.ends_at > v_occ.starts_at) then
    raise exception 'slot_unavailable';
  end if;

  if v_occ.booked_count >= v_occ.capacity then raise exception 'sold_out'; end if;

  update public.occurrences set booked_count = booked_count + 1 where id = p_occurrence;

  loop
    v_ref := 'MYD-';
    for i in 1..8 loop
      v_ref := v_ref || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
      if i = 4 then v_ref := v_ref || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.reservations where reference = v_ref);
  end loop;

  insert into public.reservations (reference, user_id, occurrence_id, participant_band, price_amount, price_currency, idempotency_key)
  values (v_ref, v_uid, p_occurrence, p_band, v_l.price_amount, v_l.price_currency, p_key)
  returning * into v_res;
  return to_jsonb(v_res) || jsonb_build_object('replayed', false);
end $$;

create function public.cancel_reservation(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_res public.reservations;
  v_occ public.occurrences;
  v_flex boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 42));
  select * into v_res from public.reservations where id = p_id and user_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if v_res.status = 'cancelled' then return to_jsonb(v_res); end if;   -- idempotent: capacity restored once only
  select * into v_occ from public.occurrences where id = v_res.occurrence_id for update;
  select is_flexible into v_flex from public.listings where id = v_occ.listing_id;
  if (not v_flex and v_occ.starts_at <= now()) or v_occ.ends_at <= now() then raise exception 'too_late_to_cancel'; end if;
  update public.reservations set status = 'cancelled', cancelled_at = now() where id = p_id returning * into v_res;
  update public.occurrences set booked_count = booked_count - 1 where id = v_occ.id;
  return to_jsonb(v_res);
end $$;

-- ---------- host controls ----------
create function public.host_participants(p_listing uuid)
returns table (reservation_id uuid, reference text, occurrence_id uuid, starts_at timestamptz, participant_band text,
               status text, attended_at timestamptz, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.listings l where l.id = p_listing and public.is_host_member(l.host_id)) then
    raise exception 'forbidden';
  end if;
  return query
    select r.id, r.reference, o.id, o.starts_at, r.participant_band, r.status, r.attended_at, coalesce(p.display_name, '')
    from public.reservations r
      join public.occurrences o on o.id = r.occurrence_id
      left join public.profiles p on p.id = r.user_id
    where o.listing_id = p_listing
    order by o.starts_at, r.created_at;
end $$;

create function public.set_attendance(p_reservation uuid, p_attended boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_res public.reservations;
begin
  select r.* into v_res from public.reservations r
    join public.occurrences o on o.id = r.occurrence_id
    join public.listings l on l.id = o.listing_id
  where r.id = p_reservation and public.is_host_member(l.host_id)
  for update of r;
  if not found then raise exception 'forbidden'; end if;
  if v_res.status <> 'confirmed' then raise exception 'not_confirmed'; end if;
  update public.reservations set attended_at = case when p_attended then now() else null end
  where id = p_reservation returning * into v_res;
  return jsonb_build_object('id', v_res.id, 'attended_at', v_res.attended_at);
end $$;

-- ---------- plans (one saved plan per user; saving reserves nothing) ----------
create function public.save_plan(p_title text, p_mode text, p_prefs jsonb, p_items jsonb, p_ai_notes jsonb default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'invalid_request'; end if;
  insert into public.plans (user_id, title, mode, prefs, ai_notes, updated_at)
  values (auth.uid(), left(coalesce(p_title, ''), 120), p_mode, coalesce(p_prefs, '{}'::jsonb), p_ai_notes, now())
  on conflict (user_id) do update set title = excluded.title, mode = excluded.mode, prefs = excluded.prefs,
    ai_notes = excluded.ai_notes, updated_at = now()
  returning id into v_id;
  delete from public.plan_items where plan_id = v_id;
  insert into public.plan_items (plan_id, position, listing_id, occurrence_id)
  select v_id, t.ord::int, o.listing_id, o.id
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
    join public.occurrences o on o.id = (t.e->>'occurrence_id')::uuid;
  return v_id;
end $$;

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.hosts enable row level security;
alter table public.host_members enable row level security;
alter table public.service_definitions enable row level security;
alter table public.listings enable row level security;
alter table public.occurrences enable row level security;
alter table public.reservations enable row level security;
alter table public.saved_listings enable row level security;
alter table public.follows enable row level security;
alter table public.price_reports enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.app_settings enable row level security;
alter table public.fx_snapshots enable row level security;
alter table public.ai_usage enable row level security;
alter table public.signup_attempts enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.hosts, public.service_definitions, public.listings, public.occurrences,
  public.app_settings, public.fx_snapshots to anon, authenticated;
create policy "public read" on public.hosts for select using (true);
create policy "public read" on public.service_definitions for select using (true);
create policy "public read" on public.app_settings for select using (true);
create policy "public read" on public.fx_snapshots for select using (true);
create policy "published or own" on public.listings for select
  using (status = 'published' or public.is_host_member(host_id));
create policy "of visible listings" on public.occurrences for select
  using (exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'published' or public.is_host_member(l.host_id))));

-- hosts manage only their own listings and sessions (never booked_count)
grant insert (host_id, type, title_en, title_ar, description_en, description_ar, category, area, price_amount, price_currency,
              min_age, max_age, level, duration_minutes, status),
      update (title_en, title_ar, description_en, description_ar, category, area, price_amount, price_currency,
              min_age, max_age, level, duration_minutes, status)
  on public.listings to authenticated;
create policy "host insert" on public.listings for insert to authenticated
  with check (public.is_host_member(host_id) and type <> 'service');
create policy "host update" on public.listings for update to authenticated
  using (public.is_host_member(host_id)) with check (public.is_host_member(host_id));
grant insert (listing_id, starts_at, ends_at, capacity), update (status) on public.occurrences to authenticated;
create policy "host insert" on public.occurrences for insert to authenticated
  with check (starts_at > now() and exists (select 1 from public.listings l where l.id = listing_id and public.is_host_member(l.host_id)));
create policy "host update" on public.occurrences for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and public.is_host_member(l.host_id)));

grant select, update (display_name) on public.profiles to authenticated;
create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.host_members to authenticated;
create policy "own memberships" on public.host_members for select to authenticated using (user_id = (select auth.uid()));

-- reservations: read own only; all writes go through reserve / cancel_reservation / set_attendance
grant select on public.reservations to authenticated;
create policy "own reservations" on public.reservations for select to authenticated using (user_id = (select auth.uid()));

grant select, insert (listing_id), delete on public.saved_listings to authenticated;
create policy "own saved" on public.saved_listings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert (host_id), delete on public.follows to authenticated;
create policy "own follows" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- price reports: public can read everything except who reported; signed-in users add unverified self-reports only
grant select (id, service_def_id, amount, currency, area, includes_parts, includes_callout, observed_on, source_type,
              verification, is_demo, created_at) on public.price_reports to anon, authenticated;
grant insert (service_def_id, amount, currency, area, includes_parts, includes_callout, observed_on)
  on public.price_reports to authenticated;
create policy "public read" on public.price_reports for select using (true);
create policy "self report" on public.price_reports for insert to authenticated
  with check (reported_by = (select auth.uid()) and source_type = 'self_reported' and verification = 'unverified' and not is_demo);

grant select, insert, update, delete on public.plans, public.plan_items to authenticated;
create policy "own plan" on public.plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own plan items" on public.plan_items for all to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));

grant execute on function public.is_host_member(uuid) to anon, authenticated;
grant execute on function public.reserve(uuid, text, uuid), public.cancel_reservation(uuid),
  public.host_participants(uuid), public.set_attendance(uuid, boolean),
  public.save_plan(text, text, jsonb, jsonb, jsonb) to authenticated;
