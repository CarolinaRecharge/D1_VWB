-- D1 Training Gym Workout Whiteboard — Supabase Schema
-- Run this in the Supabase SQL editor to set up the database.

-- ============================================================
-- Workouts table
-- ============================================================
create table workouts (
  id uuid default gen_random_uuid() primary key,
  track text not null check (track in ('Adult', 'Devo', 'Rookie', 'Prep')),
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  section text not null check (section in ('P','S','C&C')),
  section_order integer not null,        -- controls display order within a section
  exercise_label text not null,          -- e.g. "A1", "B2", "C1" — empty string for motivational text rows
  exercise_name text not null,           -- e.g. "BB Front Squat" or motivational text
  sets integer,
  reps text,                             -- stored as text to support "10 ea.", "30s ea.", "15 yds"
  notes text,                            -- optional coach notes
  week_start_date date not null,         -- Monday of the active week
  created_at timestamptz default now()
);

-- Index for fast daily lookups
create index on workouts (track, day_of_week, week_start_date);

-- ============================================================
-- RPC function for admin SQL execution
-- Used by the admin panel's "Execute SQL" feature.
-- The service role key is required to call this function.
-- ============================================================
create or replace function exec_sql(sql text) returns void
  language plpgsql security definer as
$$
begin
  execute sql;
end;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- Enable RLS on the workouts table.
-- The public display page uses the anon key with read-only access.
-- The admin page uses the service role key which bypasses RLS.
-- ============================================================
alter table workouts enable row level security;

-- Allow anyone with the anon key to SELECT workouts (TV display)
create policy "Public read access"
  on workouts for select
  using (true);

-- The service role key (used by admin) bypasses RLS automatically.
-- No insert/update/delete policies needed for the anon role.
