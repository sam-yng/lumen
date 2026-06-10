-- v3 m2 streaming transcription: recordings captured live in the browser hold
-- status 'live' between session start and finalization (then 'done'/'failed'
-- exactly like batch jobs). See docs/exec-plans/active/v3/streaming-transcription.md.
alter type recording_status add value if not exists 'live';
