-- Run this once in the Supabase SQL editor (existing projects only).
-- Records when each cue actually started and ended, so overruns can be shown.
alter table cues add column if not exists actual_start timestamptz;
alter table cues add column if not exists actual_end timestamptz;
