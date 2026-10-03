-- Pain tracking: a user marks a body part, rates pain 1–10 and picks one or more pain types.
-- Users sign in anonymously (Supabase Auth), so every report belongs to auth.uid().

-- ---------------------------------------------------------------------------
-- Dictionaries (public, read-only for clients)
-- ---------------------------------------------------------------------------

create table public.body_parts (
  id         text primary key check (id ~ '^[a-z_]+$'), -- e.g. 'knee_left'; matches the body-map region id
  name_pl    text not null,
  region     text not null check (region in ('head', 'torso', 'arm', 'leg')),
  side       text not null check (side in ('left', 'right', 'center')),
  sort_order smallint not null default 0
);

create table public.pain_types (
  id         text primary key check (id ~ '^[a-z_]+$'), -- e.g. 'throbbing'
  name_pl    text not null,
  sort_order smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Reports: one row = one body part at one moment. Several sore spots = several rows.
-- ---------------------------------------------------------------------------

create table public.pain_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body_part_id text not null references public.body_parts (id),
  intensity    smallint not null check (intensity between 1 and 10),
  note         text check (char_length(note) <= 1000),
  reported_at  timestamptz not null default now(), -- when it hurt; settable for back-filled entries
  created_at   timestamptz not null default now()
);

create table public.pain_report_types (
  report_id    uuid not null references public.pain_reports (id) on delete cascade,
  pain_type_id text not null references public.pain_types (id),
  primary key (report_id, pain_type_id)
);

-- History / trend queries filter by user and time.
create index pain_reports_user_reported_at_idx on public.pain_reports (user_id, reported_at desc);
create index pain_reports_body_part_id_idx on public.pain_reports (body_part_id);
create index pain_report_types_pain_type_id_idx on public.pain_report_types (pain_type_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.body_parts enable row level security;
alter table public.pain_types enable row level security;
alter table public.pain_reports enable row level security;
alter table public.pain_report_types enable row level security;

create policy "Dictionaries are readable by everyone"
  on public.body_parts for select to anon, authenticated using (true);

create policy "Dictionaries are readable by everyone"
  on public.pain_types for select to anon, authenticated using (true);

create policy "Users read own reports"
  on public.pain_reports for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own reports"
  on public.pain_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own reports"
  on public.pain_reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own reports"
  on public.pain_reports for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read types of own reports"
  on public.pain_report_types for select to authenticated
  using (exists (
    select 1 from public.pain_reports r
    where r.id = report_id and r.user_id = (select auth.uid())
  ));

create policy "Users add types to own reports"
  on public.pain_report_types for insert to authenticated
  with check (exists (
    select 1 from public.pain_reports r
    where r.id = report_id and r.user_id = (select auth.uid())
  ));

create policy "Users remove types from own reports"
  on public.pain_report_types for delete to authenticated
  using (exists (
    select 1 from public.pain_reports r
    where r.id = report_id and r.user_id = (select auth.uid())
  ));

grant select on public.body_parts, public.pain_types to anon, authenticated;
grant select, insert, update, delete on public.pain_reports to authenticated;
grant select, insert, delete on public.pain_report_types to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a report with its pain types in one transaction.
-- supabase.rpc('create_pain_report', { p_body_part_id, p_intensity, p_pain_type_ids, p_note?, p_reported_at? })
-- ---------------------------------------------------------------------------

create function public.create_pain_report(
  p_body_part_id  text,
  p_intensity     integer,
  p_pain_type_ids text[],
  p_note          text default null,
  p_reported_at   timestamptz default null
)
returns uuid
language plpgsql
security invoker -- runs as the caller, so RLS applies
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  if p_pain_type_ids is null or cardinality(p_pain_type_ids) = 0 then
    raise exception 'At least one pain type is required' using errcode = '22023';
  end if;

  insert into public.pain_reports (body_part_id, intensity, note, reported_at)
  values (p_body_part_id, p_intensity, p_note, coalesce(p_reported_at, now()))
  returning id into v_report_id;

  insert into public.pain_report_types (report_id, pain_type_id)
  select distinct v_report_id, t from unnest(p_pain_type_ids) as t;

  return v_report_id;
end;
$$;

revoke execute on function public.create_pain_report(text, integer, text[], text, timestamptz) from public, anon;
grant execute on function public.create_pain_report(text, integer, text[], text, timestamptz) to authenticated;
