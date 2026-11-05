-- Run this once in the Supabase SQL editor (existing projects only).
-- Adds live show state so the GO button can sync to every device.
alter table days add column if not exists live_cue_id uuid references cues(id) on delete set null;
alter table days add column if not exists live_started_at timestamptz;
