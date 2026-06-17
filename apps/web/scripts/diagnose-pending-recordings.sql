-- Diagnose recordings stuck at status = 'pending'.
--
-- A recording flips to 'processing' the instant a worker picks up its job, and
-- to 'failed' if the job errors. So a recording that stays 'pending' means
-- *no worker ever consumed its job*. This script cross-references pending
-- recordings against the pg-boss queue to tell you which of three causes you
-- are looking at:
--
--   1. job is in the queue but nothing is consuming it  -> worker is down, or
--      the worker points at a different PG_BOSS_DATABASE_URL than the web app.
--   2. no job row exists for the recording              -> the enqueue failed
--      at upload time (orphan). After the orphan-on-enqueue fix this should no
--      longer happen for new uploads; existing rows from before the fix can.
--   3. job is 'completed'/'failed' but recording is still 'pending' -> the
--      worker ran but the status write did not land. Investigate the worker.
--
-- ASSUMPTION: pg-boss runs in the SAME Postgres database as the app (the usual
-- Supabase setup — PG_BOSS_DATABASE_URL points at the same instance, with the
-- queue living in the `pgboss` schema). If pg-boss is a SEPARATE database, the
-- cross-schema join in query (A) will error with "schema pgboss does not
-- exist" — in that case run query (B) against the app DB and query (C) against
-- the pg-boss DB separately, and match rows by recording_id by eye.
--
-- pg-boss job.state values: created -> active -> completed | failed | cancelled,
-- with `retry` between attempts. `data->>'recordingId'` is the payload field
-- enqueued by enqueueTranscriptionJob().

----------------------------------------------------------------------------
-- (A) PRIMARY: every pending recording joined to its transcription job.
----------------------------------------------------------------------------
select
  r.id                       as recording_id,
  r.created_at               as recording_created_at,
  r.error                    as recording_error,
  j.id                       as job_id,
  j.state                    as job_state,
  j.retry_count,
  j.created_on               as job_created_on,
  j.start_after,
  j.started_on,
  j.completed_on,
  case
    when j.id is null                      then 'ORPHAN: no job enqueued (cause 2)'
    when j.state in ('created', 'retry')   then 'QUEUED: worker not consuming (cause 1)'
    when j.state = 'active'                then 'ACTIVE: a worker is processing now (should flip to processing)'
    when j.state = 'completed'             then 'ANOMALY: job done but recording still pending (cause 3)'
    when j.state in ('failed', 'cancelled') then 'ANOMALY: job ' || j.state || ' but recording still pending (cause 3)'
    else 'UNKNOWN job state: ' || j.state
  end                        as diagnosis
from public.recordings r
left join pgboss.job j
  on j.name = 'transcribe-recording'
 and j.data ->> 'recordingId' = r.id::text
where r.status = 'pending'
order by r.created_at desc;

----------------------------------------------------------------------------
-- (B) FALLBACK: pending recordings only (run against the app DB).
----------------------------------------------------------------------------
-- select id as recording_id, file_id, created_at, error
-- from public.recordings
-- where status = 'pending'
-- order by created_at desc;

----------------------------------------------------------------------------
-- (C) FALLBACK: transcription jobs only (run against the pg-boss DB).
----------------------------------------------------------------------------
-- select id as job_id, state, retry_count, created_on, start_after,
--        data ->> 'recordingId' as recording_id
-- from pgboss.job
-- where name = 'transcribe-recording'
-- order by created_on desc
-- limit 100;

----------------------------------------------------------------------------
-- (D) WORKER HEALTH: queue depth by state. A growing 'created'/'retry' count
-- with zero 'active' and no recent 'completed' is the signature of a dead or
-- misconfigured worker (cause 1).
----------------------------------------------------------------------------
select name, state, count(*)
from pgboss.job
where name in (
  'transcribe-recording',
  'label-speakers',
  'sweep-stale-live-sessions'
)
group by name, state
order by name, state;
