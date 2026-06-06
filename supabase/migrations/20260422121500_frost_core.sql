create extension if not exists pgcrypto;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'You',
  avatar text not null default '🧊',
  headline text not null default 'Deal hunter',
  main_niche text not null default 'Electronics',
  flip_style text not null default 'Quick Flips',
  favorite_categories text[] not null default array['Electronics', 'Sneakers', 'Gaming'],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  analyses_count integer not null default 0,
  saved_from_feed_count integer not null default 0,
  manual_adds_count integer not null default 0,
  sold_count integer not null default 0,
  refresh_count integer not null default 0,
  total_sessions integer not null default 0,
  streak_days integer not null default 1,
  longest_streak integer not null default 1,
  last_active_date date,
  last_feed_category text not null default 'All',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.flips (
  id text primary key default ('flip-' || replace(gen_random_uuid()::text, '-', '')),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Misc',
  condition text not null default 'Unknown',
  buy numeric(12, 2) not null default 0,
  sell numeric(12, 2) not null default 0,
  fees numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 8,
  profit numeric(12, 2) not null default 0,
  roi numeric(12, 2) not null default 0,
  confidence text not null default 'LOW',
  image text,
  source_url text,
  source_query text,
  sold boolean not null default false,
  sold_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists flips_user_created_at_idx on public.flips (user_id, created_at desc);

create table if not exists public.feed_cache (
  key text primary key,
  payload jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'fallback',
  message text,
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    name
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'You')
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.profiles.name, excluded.name);

  insert into public.user_activity (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_handle_updated_at on public.profiles;
create trigger profiles_handle_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists user_activity_handle_updated_at on public.user_activity;
create trigger user_activity_handle_updated_at
before update on public.user_activity
for each row execute procedure public.handle_updated_at();

drop trigger if exists flips_handle_updated_at on public.flips;
create trigger flips_handle_updated_at
before update on public.flips
for each row execute procedure public.handle_updated_at();

drop trigger if exists feed_cache_handle_updated_at on public.feed_cache;
create trigger feed_cache_handle_updated_at
before update on public.feed_cache
for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.user_activity enable row level security;
alter table public.flips enable row level security;
alter table public.feed_cache enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "user_activity_select_own" on public.user_activity;
create policy "user_activity_select_own"
on public.user_activity
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_activity_insert_own" on public.user_activity;
create policy "user_activity_insert_own"
on public.user_activity
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_activity_update_own" on public.user_activity;
create policy "user_activity_update_own"
on public.user_activity
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "flips_select_own" on public.flips;
create policy "flips_select_own"
on public.flips
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "flips_insert_own" on public.flips;
create policy "flips_insert_own"
on public.flips
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "flips_update_own" on public.flips;
create policy "flips_update_own"
on public.flips
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "flips_delete_own" on public.flips;
create policy "flips_delete_own"
on public.flips
for delete
to authenticated
using (auth.uid() = user_id);
