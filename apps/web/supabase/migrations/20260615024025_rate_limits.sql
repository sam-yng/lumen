-- App-level rate limiting: a fixed-window counter keyed by (user_id, action).
-- Enforced by an atomic Postgres function so increment+check is race-free.
-- RLS restricts rows to the owner; the function runs security invoker so
-- auth.uid() is the calling user.

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

create policy "own rate limits" on public.rate_limits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic increment-and-return for the current window. Returns the new count.
-- Output column is `new_count` to avoid ambiguity with the table's `count`.
create or replace function public.bump_rate_limit(
  p_action text,
  p_window_start timestamptz
) returns table (new_count integer)
language plpgsql security invoker as $$
begin
  return query
  insert into public.rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, p_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning public.rate_limits.count;
end;
$$;
