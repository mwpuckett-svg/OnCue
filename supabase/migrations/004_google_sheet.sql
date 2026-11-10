-- Run this once in the Supabase SQL editor (existing projects only).
-- Lets a day be linked to a public Google Sheet that its cues are pulled from.

-- Which sheet and tab a day reads from, and how the last read went.
alter table days add column if not exists sheet_id text;
alter table days add column if not exists sheet_gid text;
alter table days add column if not exists sheet_length_format text not null default 'hm';
alter table days add column if not exists sheet_map jsonb not null default '{}'::jsonb;
alter table days add column if not exists sheet_start text;
alter table days add column if not exists sheet_hash text;
alter table days add column if not exists sheet_synced_at timestamptz;
alter table days add column if not exists sheet_error text;

-- Which sheet row a cue came from, and what the sheet said last time (so a local edit isn't overwritten until that cell changes).
alter table cues add column if not exists sheet_key text;
alter table cues add column if not exists sheet_snapshot jsonb;

-- Crew notes that came from the sheet's AUDIO / VIDEO / ... columns.
alter table cue_notes add column if not exists from_sheet boolean not null default false;

-- One cue per sheet row per day. Cues added by hand have no key and are not affected.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cues_day_sheet_key_unique') then
    alter table cues add constraint cues_day_sheet_key_unique unique (day_id, sheet_key);
  end if;
end $$;
