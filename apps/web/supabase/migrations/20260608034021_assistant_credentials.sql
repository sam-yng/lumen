-- In-app assistant: per-user Claude API key storage.
--
-- The raw key never lands in a plain column. It lives in Supabase Vault;
-- this table holds only the Vault secret id. All access goes through
-- SECURITY DEFINER functions scoped to auth.uid(), so a user can only ever
-- touch their own key. Service-role/worker paths never read this.

create extension if not exists supabase_vault with schema vault cascade;

create table public.user_ai_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_credentials enable row level security;

-- Writes go exclusively through the SECURITY DEFINER RPCs below; revoke direct
-- write grants so a client can never insert/update/delete rows itself (defence
-- in depth on top of RLS). Reads stay granted but RLS-scoped to the own row, so
-- hasApiKey() can do a direct select.
revoke insert, update, delete on public.user_ai_credentials from anon, authenticated;

create policy "own credentials"
  on public.user_ai_credentials
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Save (insert or replace) the caller's Claude API key.
create or replace function public.set_ai_api_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_existing
  from public.user_ai_credentials where user_id = v_uid;

  if v_existing is null then
    insert into public.user_ai_credentials (user_id, vault_secret_id)
    values (v_uid, vault.create_secret(p_key, 'claude_api_key_' || v_uid::text));
  else
    perform vault.update_secret(v_existing, p_key);
    update public.user_ai_credentials
      set updated_at = now() where user_id = v_uid;
  end if;
end;
$$;

-- Return the caller's decrypted Claude API key, or null if unset.
create or replace function public.get_ai_api_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
  v_key text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_secret_id
  from public.user_ai_credentials where user_id = v_uid;
  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets where id = v_secret_id;
  return v_key;
end;
$$;

-- Delete the caller's key (row + Vault secret).
create or replace function public.delete_ai_api_key()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select vault_secret_id into v_secret_id
  from public.user_ai_credentials where user_id = v_uid;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    delete from public.user_ai_credentials where user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.set_ai_api_key(text) from public, anon;
revoke all on function public.get_ai_api_key() from public, anon;
revoke all on function public.delete_ai_api_key() from public, anon;
grant execute on function public.set_ai_api_key(text) to authenticated;
grant execute on function public.get_ai_api_key() to authenticated;
grant execute on function public.delete_ai_api_key() to authenticated;
