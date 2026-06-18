-- ============================================================================
-- Milestone 12 (Groups): multiple independent groups.
--
-- The tournament (teams, matches, results, scoring) stays GLOBAL. Only the
-- social layer is per-group: each player belongs to one group, and the
-- leaderboard + prediction visibility are scoped to that group.
--
-- Joining is self-service via a private join code. Codes are never browsable:
-- groups are read-only to their own members, and joining/creating go through
-- SECURITY DEFINER functions so a code lookup can't be used to enumerate.
--
-- Run this in the Supabase SQL Editor AFTER 0001 and 0002.
-- ============================================================================

create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table profiles
  add column if not exists group_id uuid references groups(id);

create index if not exists idx_profiles_group on profiles(group_id);

alter table groups enable row level security;

-- Members can read only their own group's row (so codes aren't browsable).
drop policy if exists groups_read on groups;
create policy groups_read on groups for select to authenticated
  using (id = (select group_id from profiles where id = auth.uid()));

-- ----------------------------------------------------------------------------
-- Block end users from changing group_id directly; force the join/create
-- functions (which are SECURITY DEFINER, so current_user is the owner there).
-- ----------------------------------------------------------------------------
create or replace function enforce_profile_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lock_at timestamptz;
begin
  if current_user = 'authenticated' then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'You cannot change admin status';
    end if;

    if new.group_id is distinct from old.group_id then
      raise exception 'Use the group join/create functions to change groups';
    end if;

    if new.champion_team_id is distinct from old.champion_team_id then
      select champion_lock_at into lock_at from tournament where id = 1;
      if lock_at is not null and now() >= lock_at then
        raise exception 'Champion pick is locked';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- create_group(name): make a group with a unique code, join the caller to it.
-- ----------------------------------------------------------------------------
create or replace function create_group(p_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
  code text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Group name required'; end if;

  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from groups where join_code = code);
  end loop;

  insert into groups (name, join_code, created_by)
  values (trim(p_name), code, auth.uid())
  returning * into g;

  update profiles set group_id = g.id where id = auth.uid();
  return g;
end;
$$;

-- ----------------------------------------------------------------------------
-- join_group(code): join the caller to the group with this code.
-- ----------------------------------------------------------------------------
create or replace function join_group(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into g from groups where join_code = upper(trim(p_code));
  if g.id is null then raise exception 'No group found for that code'; end if;

  update profiles set group_id = g.id where id = auth.uid();
  return g;
end;
$$;

-- ----------------------------------------------------------------------------
-- group_leaderboard(): the caller's group ranking (totals incl. champion bonus,
-- with the tiebreaker order). SECURITY DEFINER so it can aggregate the group.
-- ----------------------------------------------------------------------------
create or replace function group_leaderboard()
returns table (
  user_id          uuid,
  display_name     text,
  total_points     int,
  exact_hits       int,
  winner_hits      int,
  champion_correct boolean,
  created_at       timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    (coalesce(sum(pr.points_awarded), 0)
      + case
          when t.settled_champion
           and p.champion_team_id is not null
           and p.champion_team_id = t.champion_team_id
          then 20 else 0
        end)::int                                            as total_points,
    coalesce(count(*) filter (where pr.exact_hit), 0)::int    as exact_hits,
    coalesce(count(*) filter (where pr.winner_hit), 0)::int   as winner_hits,
    (t.settled_champion
      and p.champion_team_id is not null
      and p.champion_team_id = t.champion_team_id)            as champion_correct,
    p.created_at
  from profiles p
  cross join tournament t
  left join predictions pr on pr.user_id = p.id
  where p.group_id = (select group_id from profiles where id = auth.uid())
    and p.group_id is not null
  group by p.id, p.display_name, p.champion_team_id, p.created_at,
           t.settled_champion, t.champion_team_id
  order by total_points desc, exact_hits desc, p.created_at asc;
$$;

grant execute on function create_group(text)   to authenticated;
grant execute on function join_group(text)     to authenticated;
grant execute on function group_leaderboard()  to authenticated;

-- ----------------------------------------------------------------------------
-- Predictions: reveal others' picks only to SAME-GROUP members after kickoff.
-- ----------------------------------------------------------------------------
drop policy if exists predictions_read on predictions;
create policy predictions_read on predictions for select to authenticated
  using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from matches m
        where m.id = predictions.match_id and now() >= m.kickoff_at
      )
      and (select group_id from profiles where id = auth.uid()) is not null
      and (select group_id from profiles where id = auth.uid())
          = (select group_id from profiles where id = predictions.user_id)
    )
  );
