-- ============================================================================
-- Run of Show — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROJECTS (the "Your Shows" list)
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Event',
  venue text not null default '',
  date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- POSITIONS (customizable crew positions, per project)
-- ---------------------------------------------------------------------------
create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  color text not null default '#FFB23E',
  is_admin boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PROJECT MEMBERS (which authenticated user holds which position on which
-- project — this replaces the old "personal storage per project" concept
-- with a real, auth-backed relationship)
-- ---------------------------------------------------------------------------
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid references positions(id) on delete set null,
  is_guest boolean not null default false,
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ---------------------------------------------------------------------------
-- INVITES (email -> position, per project)
-- ---------------------------------------------------------------------------
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  position_id uuid references positions(id) on delete set null,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

-- ---------------------------------------------------------------------------
-- DAYS
-- ---------------------------------------------------------------------------
create table if not exists days (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null default 'Day 1',
  date date,
  start_time text not null default '18:00',
  target_end text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CUES
-- ---------------------------------------------------------------------------
create table if not exists cues (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references days(id) on delete cascade,
  sort_order int not null default 0,
  name text not null default 'New Cue',
  category text not null default 'segment',
  duration_sec int not null default 300,
  owner text not null default '',
  notes text not null default '',
  locked boolean not null default false,
  locked_time text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CUE NOTES (per-position note threads — replaces the old roleNotes blob)
-- ---------------------------------------------------------------------------
create table if not exists cue_notes (
  id uuid primary key default gen_random_uuid(),
  cue_id uuid not null references cues(id) on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  text text not null,
  author_name text not null default '',
  author_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_positions_project on positions(project_id);
create index if not exists idx_members_project on project_members(project_id);
create index if not exists idx_invites_project_email on invites(project_id, email);
create index if not exists idx_days_project on days(project_id);
create index if not exists idx_cues_day on cues(day_id);
create index if not exists idx_cue_notes_cue on cue_notes(cue_id);

-- ---------------------------------------------------------------------------
-- Helper: is the current user a member (any role) of a project?
-- ---------------------------------------------------------------------------
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from project_members
    where project_id = pid and user_id = auth.uid()
  );
$$;

-- Helper: is the current user an admin member of a project?
create or replace function is_project_admin(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from project_members pm
    join positions p on p.id = pm.position_id
    where pm.project_id = pid and pm.user_id = auth.uid() and p.is_admin = true
  );
$$;

-- Helper: has the current user's email been invited to a project?
create or replace function is_project_invited(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from invites
    where project_id = pid and email = auth.jwt() ->> 'email'
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap a new project atomically: creates the project row, a default
-- position roster, the creator's own admin membership, and a first day.
-- Runs as security definer specifically to sidestep the RLS chicken-and-egg
-- problem of "you need to be an admin member to create positions, but you
-- can't become an admin member until an admin position exists."
-- ---------------------------------------------------------------------------
create or replace function create_project_bootstrap(
  p_name text,
  p_venue text default '',
  p_date date default null
) returns uuid
language plpgsql security definer as $$
declare
  v_project_id uuid;
  v_admin_position_id uuid;
  v_labels text[] := array['Stage Manager','Production Manager','Producer','Audio','Lighting','Video / AV','Stage Crew','Talent / Green Room','House Manager'];
  v_admin_flags boolean[] := array[true,true,true,false,false,false,false,false,false];
  v_colors text[] := array['#FFB23E','#38BDF8','#FBBF24','#A78BFA','#34D399','#FB7185','#94A3B8','#A3E635','#F2495C'];
  i int;
  v_pos_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create a project';
  end if;

  insert into projects (name, venue, date, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled Show'), coalesce(p_venue, ''), p_date, auth.uid())
  returning id into v_project_id;

  for i in 1..array_length(v_labels, 1) loop
    insert into positions (project_id, label, color, is_admin, sort_order)
    values (v_project_id, v_labels[i], v_colors[((i - 1) % array_length(v_colors, 1)) + 1], v_admin_flags[i], i)
    returning id into v_pos_id;
    if v_admin_flags[i] and v_admin_position_id is null then
      v_admin_position_id := v_pos_id;
    end if;
  end loop;

  insert into project_members (project_id, user_id, position_id, is_guest, display_name)
  values (v_project_id, auth.uid(), v_admin_position_id, false, '');

  insert into days (project_id, label, start_time, target_end, sort_order)
  values (v_project_id, 'Day 1', '18:00', '', 0);

  return v_project_id;
end;
$$;

grant execute on function create_project_bootstrap to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table projects enable row level security;
alter table positions enable row level security;
alter table project_members enable row level security;
alter table invites enable row level security;
alter table days enable row level security;
alter table cues enable row level security;
alter table cue_notes enable row level security;

-- PROJECTS: any signed-in user can create one. Readable/writable by members;
-- also readable if you've been invited (so you can "discover" it before joining).
drop policy if exists "projects_select" on projects;
create policy "projects_select" on projects for select
  using (is_project_member(id) or is_project_invited(id));

drop policy if exists "projects_insert" on projects;
create policy "projects_insert" on projects for insert
  with check (auth.uid() is not null);

drop policy if exists "projects_update" on projects;
create policy "projects_update" on projects for update
  using (is_project_admin(id));

drop policy if exists "projects_delete" on projects;
create policy "projects_delete" on projects for delete
  using (is_project_admin(id));

-- POSITIONS: visible to members/invitees; only admins can manage.
drop policy if exists "positions_select" on positions;
create policy "positions_select" on positions for select
  using (is_project_member(project_id) or is_project_invited(project_id));

drop policy if exists "positions_write" on positions;
create policy "positions_write" on positions for all
  using (is_project_admin(project_id)) with check (is_project_admin(project_id));

-- PROJECT_MEMBERS: a user can see members of projects they belong to; anyone
-- signed in can insert their OWN membership row (this is how "joining" works
-- after matching an invite, or the bootstrap admin on project creation).
drop policy if exists "members_select" on project_members;
create policy "members_select" on project_members for select
  using (is_project_member(project_id));

drop policy if exists "members_insert_self" on project_members;
create policy "members_insert_self" on project_members for insert
  with check (user_id = auth.uid());

drop policy if exists "members_update_self" on project_members;
create policy "members_update_self" on project_members for update
  using (user_id = auth.uid() or is_project_admin(project_id));

drop policy if exists "members_delete" on project_members;
create policy "members_delete" on project_members for delete
  using (user_id = auth.uid() or is_project_admin(project_id));

-- INVITES: members can see the invite list; only admins manage it. A user can
-- also check invites addressed to their own email (to resolve their role on join).
drop policy if exists "invites_select" on invites;
create policy "invites_select" on invites for select
  using (is_project_member(project_id) or email = auth.jwt() ->> 'email');

drop policy if exists "invites_write" on invites;
create policy "invites_write" on invites for all
  using (is_project_admin(project_id)) with check (is_project_admin(project_id));

-- DAYS: visible to members; only admins manage.
drop policy if exists "days_select" on days;
create policy "days_select" on days for select using (is_project_member(project_id));

drop policy if exists "days_write" on days;
create policy "days_write" on days for all
  using (is_project_admin(project_id)) with check (is_project_admin(project_id));

-- CUES: visible to members; only admins manage (mirrors "only Stage Manager
-- edits the schedule" from the original app).
drop policy if exists "cues_select" on cues;
create policy "cues_select" on cues for select
  using (is_project_member((select project_id from days where days.id = cues.day_id)));

drop policy if exists "cues_write" on cues;
create policy "cues_write" on cues for all
  using (is_project_admin((select project_id from days where days.id = cues.day_id)))
  with check (is_project_admin((select project_id from days where days.id = cues.day_id)));

-- CUE_NOTES: a member can read/write notes for their OWN position, or any
-- note if they're an admin (mirrors "Stage Manager sees everything").
drop policy if exists "cue_notes_select" on cue_notes;
create policy "cue_notes_select" on cue_notes for select
  using (
    exists (
      select 1 from cues c join days d on d.id = c.day_id
      where c.id = cue_notes.cue_id and (
        is_project_admin(d.project_id)
        or exists (
          select 1 from project_members pm
          where pm.project_id = d.project_id and pm.user_id = auth.uid()
            and pm.position_id = cue_notes.position_id
        )
      )
    )
  );

drop policy if exists "cue_notes_insert" on cue_notes;
create policy "cue_notes_insert" on cue_notes for insert
  with check (
    author_user_id = auth.uid() and
    exists (
      select 1 from cues c join days d on d.id = c.day_id
      where c.id = cue_notes.cue_id and (
        is_project_admin(d.project_id)
        or exists (
          select 1 from project_members pm
          where pm.project_id = d.project_id and pm.user_id = auth.uid()
            and pm.position_id = cue_notes.position_id
        )
      )
    )
  );

drop policy if exists "cue_notes_delete" on cue_notes;
create policy "cue_notes_delete" on cue_notes for delete
  using (
    author_user_id = auth.uid()
    or exists (
      select 1 from cues c join days d on d.id = c.day_id
      where c.id = cue_notes.cue_id and is_project_admin(d.project_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: include these tables in the supabase_realtime publication so the
-- app can subscribe to live changes.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table projects, positions, project_members, invites, days, cues, cue_notes;
