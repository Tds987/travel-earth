-- Travel Earth journal: run once in the Supabase SQL editor (free plan).
-- Safe to re-run.

create table if not exists public.entries (
  id uuid primary key,
  created_at timestamptz not null default now(),
  at timestamptz not null,                 -- when it happened
  kind text not null check (kind in ('visit', 'checkin', 'note', 'stay')),
  place_id text,                           -- content place id, for visits
  title text,
  body text,
  lat double precision,
  lon double precision,
  media jsonb not null default '[]'::jsonb -- [{ "path", "type": "image"|"video" }]
);
alter table public.entries enable row level security;

-- Only the signed-in owner can read/write directly. (Sign-ups get turned off
-- after the owner's account exists, so "authenticated" means the owner.)
drop policy if exists owner_all on public.entries;
create policy owner_all on public.entries
  for all to authenticated using (true) with check (true);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  display_name text not null default 'Traveler',
  share_token text not null default replace(gen_random_uuid()::text, '-', '')
);
alter table public.settings enable row level security;
drop policy if exists owner_read on public.settings;
create policy owner_read on public.settings for select to authenticated using (true);
drop policy if exists owner_update on public.settings;
create policy owner_update on public.settings for update to authenticated using (true);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Family view: anyone holding the share token can read the journal, nothing else.
create or replace function public.family_journal(token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when s.share_token = token then json_build_object(
    'name', s.display_name,
    'entries', coalesce((select json_agg(e order by e.at) from public.entries e), '[]'::json)
  ) end
  from public.settings s
  where s.id = 1
$$;
revoke all on function public.family_journal(text) from public;
grant execute on function public.family_journal(text) to anon, authenticated;

-- Photos and clips. Public-read bucket, but files sit under random, unlisted
-- names and only the owner can upload or delete. 50 MB per file (free plan max).
insert into storage.buckets (id, name, public, file_size_limit)
values ('journal', 'journal', true, 52428800)
on conflict (id) do nothing;

drop policy if exists journal_owner_insert on storage.objects;
create policy journal_owner_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'journal');
drop policy if exists journal_owner_delete on storage.objects;
create policy journal_owner_delete on storage.objects
  for delete to authenticated using (bucket_id = 'journal');
