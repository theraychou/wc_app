-- ============================================================================
-- Milestone 13: multi-group membership (shared predictions).
--
-- A player can now belong to SEVERAL groups. Predictions and the champion pick
-- stay per-player (one set, shared) and appear on every group's leaderboard.
--
-- profiles.group_id is kept as the player's PRIMARY group (first one joined) so
-- the previously-deployed app keeps working during the transition. The new
-- group_members table is the source of truth for membership.
--
-- Run in the Supabase SQL Editor AFTER 0001-0003.
-- ============================================================================

create table if not exists group_members (
  user_id   uuid not null references profiles(id) on delete cascade,
  group_id  uuid not null references groups(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, group_id)
);
create index if not exists idx_group_members_group on group_members(group_id);

-- Backfill existing single-group memberships.
insert into group_members (user_id, group_id)
select id, group_id from profiles where group_id is not null
on conflict do nothing;

alter table group_members enable row level security;

-- Helper checks as SECURITY DEFINER so policies that need to look at
-- group_members don't recurse through RLS (Postgres errors otherwise).
create or replace function is_member_of(p_group_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members
    where user_id = auth.uid() and group_id = p_group_id
  );
$$;

create or replace function shares_group_with(p_other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members a
    join group_members b on b.group_id = a.group_id
    where a.user_id = auth.uid() and b.user_id = p_other
  );
$$;

grant execute on function is_member_of(uuid)       to authenticated;
grant execute on function shares_group_with(uuid)  to authenticated;

-- Read memberships of any group you belong to (for member lists / counts).
drop policy if exists group_members_read on group_members;
create policy group_members_read on group_members for select to authenticated
  using (is_member_of(group_id));

-- Leave a group (delete your own membership). Joining goes through functions.
drop policy if exists group_members_leave on group_members;
create policy group_members_leave on group_members for delete to authenticated
  using (user_id = auth.uid());

-- Groups are readable to their members.
drop policy if exists groups_read on groups;
create policy groups_read on groups for select to authenticated
  using (is_member_of(id));

-- ----------------------------------------------------------------------------
-- create_group / join_group: write membership; set primary only if unset so
-- joining additional groups doesn't move the player's primary.
-- ----------------------------------------------------------------------------
create or replace function create_group(p_name text)
returns groups language plpgsql security definer set search_path = public as $$
declare g groups; code text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Group name required'; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from groups where join_code = code);
  end loop;
  insert into groups (name, join_code, created_by)
  values (trim(p_name), code, auth.uid()) returning * into g;
  insert into group_members (user_id, group_id) values (auth.uid(), g.id)
  on conflict do nothing;
  update profiles set group_id = coalesce(group_id, g.id) where id = auth.uid();
  return g;
end; $$;

create or replace function join_group(p_code text)
returns groups language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into g from groups where join_code = upper(trim(p_code));
  if g.id is null then raise exception 'No group found for that code'; end if;
  insert into group_members (user_id, group_id) values (auth.uid(), g.id)
  on conflict do nothing;
  update profiles set group_id = coalesce(group_id, g.id) where id = auth.uid();
  return g;
end; $$;

create or replace function leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from group_members where user_id = auth.uid() and group_id = p_group_id;
  -- if that was the primary group, repoint to a remaining one (or null)
  update profiles set group_id = (
    select group_id from group_members where user_id = auth.uid()
    order by joined_at limit 1
  ) where id = auth.uid() and group_id = p_group_id;
end; $$;

-- ----------------------------------------------------------------------------
-- group_leaderboard(group_id): a specific group's ranking (caller must be a
-- member). Plus a no-arg version (primary group) for backward compatibility.
-- ----------------------------------------------------------------------------
create or replace function group_leaderboard(p_group_id uuid)
returns table (
  user_id uuid, display_name text, total_points int, exact_hits int,
  winner_hits int, champion_correct boolean, created_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    p.id                                                    as user_id,
    p.display_name                                          as display_name,
    (coalesce(sum(pr.points_awarded), 0)
      + case when t.settled_champion and p.champion_team_id is not null
             and p.champion_team_id = t.champion_team_id then 20 else 0 end)::int
                                                            as total_points,
    coalesce(count(*) filter (where pr.exact_hit), 0)::int  as exact_hits,
    coalesce(count(*) filter (where pr.winner_hit), 0)::int as winner_hits,
    (t.settled_champion and p.champion_team_id is not null
      and p.champion_team_id = t.champion_team_id)          as champion_correct,
    p.created_at                                            as created_at
  from profiles p
  join group_members gm on gm.user_id = p.id and gm.group_id = p_group_id
  cross join tournament t
  left join predictions pr on pr.user_id = p.id
  where exists (
    select 1 from group_members me
    where me.user_id = auth.uid() and me.group_id = p_group_id
  )
  group by p.id, p.display_name, p.champion_team_id, p.created_at,
           t.settled_champion, t.champion_team_id
  order by total_points desc, exact_hits desc, p.created_at asc;
$$;

create or replace function group_leaderboard()
returns table (
  user_id uuid, display_name text, total_points int, exact_hits int,
  winner_hits int, champion_correct boolean, created_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select * from group_leaderboard(
    (select group_id from profiles where id = auth.uid())
  );
$$;

grant execute on function create_group(text)            to authenticated;
grant execute on function join_group(text)              to authenticated;
grant execute on function leave_group(uuid)             to authenticated;
grant execute on function group_leaderboard(uuid)       to authenticated;
grant execute on function group_leaderboard()           to authenticated;

-- ----------------------------------------------------------------------------
-- Predictions: reveal others' picks after kickoff to anyone who shares ANY
-- group with you.
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
      and shares_group_with(predictions.user_id)
    )
  );
