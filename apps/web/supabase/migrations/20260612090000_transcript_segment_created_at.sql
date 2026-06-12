-- Stale live-session sweep (v4 m5): activity heartbeat for live recordings.
-- Live segments are inserted incrementally by appendLiveSegments, so a
-- created_at default is enough to derive "last activity" without an
-- app-level heartbeat write. Pre-existing rows backfill to migration time,
-- which can only delay a sweep by one threshold, never falsely expire
-- fresh work.
alter table public.transcript_segments
  add column created_at timestamptz not null default now();
