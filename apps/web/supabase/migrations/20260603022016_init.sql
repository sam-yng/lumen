-- M0 init migration.
--
-- Establishes the canonical multi-tenant pattern that every M1 domain table
-- copies: a user-owned row + Row-Level Security policies scoped to auth.uid().
-- RLS is THE security boundary (not app-layer filtering). See SECURITY.md.

create extension if not exists pgcrypto;

-- One profile row per auth user. Mirrors auth.users so app data can FK to a
-- public table and carry per-user profile fields later.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user may only see and mutate their own profile row.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
