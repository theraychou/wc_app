-- ============================================================================
-- World Cup 2026 Prediction Pool — Supabase schema, RLS, triggers, leaderboard
-- Run this in the Supabase SQL Editor (it runs as a privileged role, so the
-- guard triggers below will not block it).
--
-- Security model in one line:
--   * End users connect as the `authenticated` role and are gated by RLS + the
--     guard triggers below.
--   * The sync job / admin server actions use the service-role key, which
--     bypasses RLS. The guard triggers deliberately exempt non-`authenticated`
--     roles so settlement and corrections can write locked rows.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table if not exists teams (
  id         text primary key,            -- API-Football team id, stored as text
  name       text not null,
  code       text,                        -- e.g. "BRA"
  flag_url   text,
  eliminated boolean not null default false
);

create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null,
  champion_team_id text references teams(id),
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists matches (
  id                uuid primary key default gen_random_uuid(),
  api_fixture_id    bigint unique,
  round             text not null check (round in ('R32','R16','QF','SF','THIRD','FINAL')),
  match_number      int,
  kickoff_at        timestamptz not null,
  home_team_id      text references teams(id),   -- null while TBD
  away_team_id      text references teams(id),   -- null while TBD
  status            text not null default 'scheduled'
                      check (status in ('scheduled','live','finished')),
  home_score_ft     int,                          -- 90-minute score
  away_score_ft     int,
  winner_team_id    text references teams(id),     -- team that advanced
  went_to_penalties boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table if not exists predictions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  match_id            uuid not null references matches(id) on delete cascade,
  pred_home_score     int not null check (pred_home_score >= 0),
  pred_away_score     int not null check (pred_away_score >= 0),
  pred_winner_team_id text not null references teams(id),
  exact_hit           boolean,
  winner_hit          boolean,
  points_awarded      int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, match_id)
);

-- Singleton tournament/config row (id is forced to 1)
create table if not exists tournament (
  id                int primary key default 1 check (id = 1),
  champion_team_id  text references teams(id),   -- actual WC winner, set on settle
  champion_lock_at  timestamptz,                 -- = first R32 kickoff
  settled_champion  boolean not null default false
);

insert into tournament (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------

create index if not exists idx_predictions_match on predictions(match_id);
create index if not exists idx_predictions_user  on predictions(user_id);
create index if not exists idx_matches_kickoff    on matches(kickoff_at);
create index if not exists idx_matches_round      on matches(round);

-- ----------------------------------------------------------------------------
-- HELPER: is the current user an admin?  (security definer so it can read
-- profiles regardless of the caller's RLS context)
-- ----------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- TRIGGER: auto-create a profile when a new auth user signs up
-- ----------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- TRIGGER: lock predictions at kickoff (end users only)
-- ----------------------------------------------------------------------------

create or replace function enforce_prediction_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ko timestamptz;
begin
  -- Service role / SQL editor (settlement, corrections) bypass the lock.
  if current_user <> 'authenticated' then
    return new;
  end if;

  select kickoff_at into ko from matches where id = new.match_id;
  if ko is null then
    raise exception 'Match not found for prediction';
  end if;
  -- Predictions lock 5 minutes before kickoff.
  if now() >= ko - interval '5 minutes' then
    raise exception 'Predictions are locked for this match (locks 5 minutes before kickoff)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prediction_lock on predictions;
create trigger trg_prediction_lock
  before insert or update on predictions
  for each row execute function enforce_prediction_lock();

-- ----------------------------------------------------------------------------
-- TRIGGER: profile rules for end users
--   * cannot change their own is_admin
--   * cannot change champion pick once the champion lock has passed
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

drop trigger if exists trg_profile_rules on profiles;
create trigger trg_profile_rules
  before update on profiles
  for each row execute function enforce_profile_rules();

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table teams       enable row level security;
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table predictions enable row level security;
alter table tournament  enable row level security;

-- teams: everyone reads, admins write
create policy teams_read    on teams for select to authenticated using (true);
create policy teams_insert  on teams for insert to authenticated with check (is_admin());
create policy teams_update  on teams for update to authenticated using (is_admin()) with check (is_admin());
create policy teams_delete  on teams for delete to authenticated using (is_admin());

-- profiles: everyone reads (leaderboard names), user updates only own row
create policy profiles_read   on profiles for select to authenticated using (true);
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- matches: everyone reads, admins write
create policy matches_read   on matches for select to authenticated using (true);
create policy matches_insert on matches for insert to authenticated with check (is_admin());
create policy matches_update on matches for update to authenticated using (is_admin()) with check (is_admin());
create policy matches_delete on matches for delete to authenticated using (is_admin());

-- tournament: everyone reads, admins write
create policy tournament_read   on tournament for select to authenticated using (true);
create policy tournament_update on tournament for update to authenticated using (is_admin()) with check (is_admin());

-- predictions:
--   read  -> always your own; others' only after that match has kicked off
--   write -> only your own (kickoff lock enforced by trigger above)
create policy predictions_read on predictions for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from matches m
      where m.id = predictions.match_id and now() >= m.kickoff_at
    )
  );

create policy predictions_insert on predictions for insert to authenticated
  with check (user_id = auth.uid());

create policy predictions_update on predictions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- (no delete policy for predictions -> end users cannot delete)

-- ----------------------------------------------------------------------------
-- LEADERBOARD VIEW
-- Aggregates everyone's points (incl. champion bonus) across all users.
-- security_invoker = off so it can read all rows for the totals; only
-- aggregates are exposed, never individual unrevealed predictions.
-- ----------------------------------------------------------------------------

create or replace view leaderboard
with (security_invoker = off) as
select
  p.id                                                   as user_id,
  p.display_name,
  coalesce(sum(pr.points_awarded), 0)
    + case
        when t.settled_champion
         and p.champion_team_id is not null
         and p.champion_team_id = t.champion_team_id
        then 20 else 0
      end                                                as total_points,
  coalesce(count(*) filter (where pr.exact_hit), 0)      as exact_hits,
  coalesce(count(*) filter (where pr.winner_hit), 0)     as winner_hits,
  (t.settled_champion
     and p.champion_team_id is not null
     and p.champion_team_id = t.champion_team_id)        as champion_correct,
  p.created_at
from profiles p
cross join tournament t                  -- single row (id = 1)
left join predictions pr on pr.user_id = p.id
group by p.id, p.display_name, p.champion_team_id, p.created_at,
         t.settled_champion, t.champion_team_id
order by total_points desc, exact_hits desc, p.created_at asc;

grant select on leaderboard to authenticated;

-- ============================================================================
-- AFTER RUNNING: make yourself an admin (replace the email).
-- The SQL editor runs as a privileged role, so the guard trigger allows this.
--
--   update profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- (You must have signed in once first so your profile row exists.)
-- ============================================================================
