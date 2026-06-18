# BUILD.md — World Cup 2026 Prediction Pool

> Hand this file to Claude Code. It is the single source of truth for what to build.
> Build in the milestone order at the bottom. Ask me before doing anything destructive
> or anything that costs money.

---

## 1. What we're building

A **mobile-first web app** where a small private group of friends predict the
**knockout stage** of the FIFA World Cup 2026 and compete for the most points.

- Friends sign in with **email (magic link)** — no passwords.
- Each player picks **one team to win the whole tournament** (the "champion pick").
- For every knockout match, each player predicts the **score** and the **team that advances**.
- Actual results are pulled **automatically from a football API**; points are then settled automatically.
- A **leaderboard** ranks everyone by total points, with the **top 3 shown larger** than the rest.
- There is **one overall winner**: the player with the most points at the end.

Scale: private group, under ~50 users. Keep it simple, cheap, and reliable.

---

## 2. Tech stack (all free tier)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase, server + client |
| Styling | **Tailwind CSS** | Mobile-first |
| Auth + DB | **Supabase** | Email magic-link auth, Postgres, Row-Level Security |
| Hosting | **Vercel** | Free hobby tier, auto-deploy from GitHub |
| Results data | **API-Football (api-sports.io)** | Free tier: 100 req/day, no card. WC 2026 = `league=1&season=2026` |
| Scheduled sync | **External cron (cron-job.org)** hitting a secured Next.js route | Avoids Vercel hobby cron's once-per-day limit |

Abstract the football API behind a single adapter module (`lib/football/provider.ts`) so it can be
swapped for football-data.org later without touching the rest of the app.

---

## 3. Tournament facts (hard-code these as reference; sync fills the live data)

48-team format. The game only covers the **knockout phase**.

| Round | Dates 2026 | Matches | Internal `round` code |
|---|---|---|---|
| Round of 32 | Jun 28 – Jul 3 | 16 | `R32` |
| Round of 16 | Jul 4 – Jul 7 | 8 | `R16` |
| Quarter-finals | Jul 9 – Jul 11 | 4 | `QF` |
| Semi-finals | Jul 14 – Jul 15 | 2 | `SF` |
| Third-place match | Jul 18 | 1 | `THIRD` |
| Final | Jul 19 | 1 | `FINAL` |

**32 knockout matches total.** Round-of-32 matchups are only known after the group stage ends
**Jun 27**, so the app must handle matches whose two teams are still `TBD` and only open them for
prediction once both teams are assigned.

### Scoring rules
Points are **round-dependent**. "Score" = the result at the **end of 90 minutes (regulation)**,
NOT including extra time (a knockout match can be a draw at 90 mins, e.g. `1–1`). "Winner" = the team
that **progresses** (covers extra-time and penalty-shootout outcomes).

| Round group | Exact score correct | Correct team advancing | Perfect (stacked) |
|---|---|---|---|
| **R32, R16, QF** | +5 | +2 | +7 |
| **SF, THIRD, FINAL** (semi-finals onward) | +10 | +5 | +15 |

- The two components **stack** within a match.
- **Champion pick correct → +20 points**, awarded once after the Final is settled.
- **No prediction entered for a match → 0 points** for that match. A player only earns points for
  matches they predicted before the lock.

### Locking rules
- A match's prediction **locks 5 minutes before its kickoff time** (`kickoff_at − 5 min`). Any player
  may create or edit their prediction up until that moment; once locked it is read-only and the
  prediction is taken as-is.
- The **champion pick locks at the first Round-of-32 kickoff** (≈ Jun 28). After that it cannot change.
- Players who join late simply miss points for matches already locked, and cannot set a champion
  pick if the champion lock has passed.

### Privacy rule (important)
A player must **not** see another player's prediction for a match **until that match has kicked off**.
Before kickoff, each player sees only their own picks.

---

## 4. Data model (Supabase / Postgres)

Enable Row-Level Security on every table. `auth.users` is Supabase-managed.

```sql
-- One row per player, 1:1 with auth.users
profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null,
  champion_team_id text references teams(id),   -- their predicted WC winner
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
)

teams (
  id        text primary key,        -- use API-Football team id as text
  name      text not null,
  code      text,                    -- e.g. "BRA"
  flag_url  text,
  eliminated boolean not null default false
)

matches (
  id               uuid primary key default gen_random_uuid(),
  api_fixture_id   bigint unique,            -- maps to API-Football fixture id
  round            text not null,            -- R32 | R16 | QF | SF | THIRD | FINAL
  match_number     int,                      -- official FIFA match number, for ordering
  kickoff_at       timestamptz not null,
  home_team_id     text references teams(id),-- null while TBD
  away_team_id     text references teams(id),-- null while TBD
  status           text not null default 'scheduled', -- scheduled | live | finished
  home_score_ft    int,                      -- 90-minute score, null until finished
  away_score_ft    int,
  winner_team_id   text references teams(id),-- team that advanced, null until finished
  went_to_penalties boolean not null default false,
  updated_at       timestamptz not null default now()
)

predictions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  match_id          uuid not null references matches(id) on delete cascade,
  pred_home_score   int not null,
  pred_away_score   int not null,
  pred_winner_team_id text not null references teams(id), -- who they think advances
  exact_hit         boolean,        -- set on settle
  winner_hit        boolean,        -- set on settle
  points_awarded    int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, match_id)
)

-- Singleton config / tournament state
tournament (
  id                   int primary key default 1,
  champion_team_id     text references teams(id), -- actual WC winner, null until Final settled
  champion_lock_at     timestamptz,               -- = first R32 kickoff
  settled_champion     boolean not null default false
)
```

### RLS policies (summary — implement precisely)
- `profiles`: a user can read all profiles (needed for leaderboard names); can update only their own row; cannot set `is_admin`.
- `teams`, `matches`, `tournament`: readable by all authenticated users; writable only by admins / service role.
- `predictions`:
  - INSERT/UPDATE: only `auth.uid() = user_id`, **and only while** the match has not kicked off (`now() < matches.kickoff_at`). Enforce with a Postgres trigger/function that looks up the match kickoff and the champion lock as needed; the client UI must also hide locked items, but the DB is the real gate.
  - SELECT: a user can always read their **own** predictions; they can read **others'** predictions only for matches where `now() >= matches.kickoff_at`.
- Champion pick (`profiles.champion_team_id`): updatable only while `now() < tournament.champion_lock_at`.

---

## 5. Scoring engine (settlement)

Runs whenever a match transitions to `finished` (during the sync job). Pseudocode:

```
# round-dependent point values
exact_pts(round)  = 10 if round in {SF, THIRD, FINAL} else 5
winner_pts(round) = 5  if round in {SF, THIRD, FINAL} else 2

for each prediction p of match m where m.status = 'finished':
    p.exact_hit  = (p.pred_home_score == m.home_score_ft) and
                   (p.pred_away_score == m.away_score_ft)
    p.winner_hit = (p.pred_winner_team_id == m.winner_team_id)
    p.points_awarded = (exact_pts(m.round) if p.exact_hit else 0)
                     + (winner_pts(m.round) if p.winner_hit else 0)
# Players with no prediction row for m earn 0 — nothing to settle.

after the Final is finished and tournament.settled_champion is false:
    set tournament.champion_team_id = winner of the FINAL match
    for each profile pr with pr.champion_team_id == tournament.champion_team_id:
        award +20 (track via a separate column or a fixed row so totals stay correct)
    set tournament.settled_champion = true
```

Settlement must be **idempotent** — re-running sync on an already-settled match produces identical
results (recompute from scratch, don't increment). This also lets an admin correct a wrong result and
have totals self-heal.

**Total points per player** = `sum(predictions.points_awarded)` + champion bonus (20 if correct).
Expose this as a Postgres **view** `leaderboard` for easy querying. The leaderboard is therefore
**always live**: it recomputes from `predictions` + `tournament`, so it updates automatically as each
match is settled during sync — no separate refresh step.

### Tiebreaker (for ranking order)
1. Total points (desc)
2. Most exact-score hits (`count(exact_hit)`) (desc)
3. Earliest `profiles.created_at` (asc)

---

## 6. Football API integration

Provider: **API-Football** (`https://v3.football.api-sports.io`). World Cup 2026 = `league=1&season=2026`.
Auth via `x-apisports-key` header. Adapter responsibilities:

- `fetchKnockoutFixtures()` → all fixtures for the league/season, filtered to knockout rounds.
  Map each to our `matches` shape. Use the API's `round` label to map into our `R32/R16/QF/SF/THIRD/FINAL` codes, and `fixture.id` → `api_fixture_id`, `fixture.date` → `kickoff_at` (store UTC), `teams.home/away` → team ids/names/logos.
- `fetchResult(fixture)` → for a finished match, read the **90-minute** score from the fixture's
  full-time score field (NOT the aggregate including extra time) for the exact-score check, and read
  which team is flagged as the winner/advancer for the winner check. Set `went_to_penalties` when the
  status indicates a shootout.

> Field names above are the expected API-Football shape. **Verify them against the live API response and
> current docs before relying on them**, and write the adapter defensively (handle TBD teams, postponed
> matches, and missing fields).

### Sync job — `GET /api/sync`
- Protected by a secret header/query (`SYNC_SECRET`); reject anything without it.
- Steps: upsert teams → upsert/refresh matches (kickoffs, assigned teams, statuses) → for newly
  finished matches, run settlement → mark `tournament` champion when Final finishes.
- Caching: only call the API when needed; respect the 100 req/day free limit. A single fixtures call
  returns all matches, so one or two calls per sync is plenty.
- Also expose an admin **"Sync now"** button that calls the same logic.
- Schedule it with **cron-job.org** every ~15 minutes (you can increase frequency only on knockout
  match days). Tell me the URL + secret to paste into cron-job.org when ready.

---

## 7. Pages / routes (mobile-first)

- `/login` — email input → Supabase magic link → on first login, prompt for `display_name`.
- `/` (Dashboard) — your champion pick (with edit if unlocked), your next few upcoming matches with
  quick prediction entry, your current rank + points.
- `/matches` — list of all knockout matches grouped by round. Each shows kickoff (in the user's local
  time), teams (or "TBD"), and your prediction. Locked matches are read-only and reveal others' picks
  + the result.
- `/match/[id]` — single match: enter/edit score + pick the advancing team (only if open); after
  kickoff, show everyone's predictions and (once finished) the result and points each person earned.
- `/leaderboard` — full ranking. **Top 3 rendered in larger "podium" cards**, the rest in a compact
  list. Show total points and exact-score-hit count.
- `/champion` — pick/change your champion (disabled after champion lock).
- `/bracket` — visual knockout bracket (R32 → R16 → QF → SF → Final, plus bronze final), in the
  official FIFA 2026 layout. Built from a **hard-coded 2026 bracket structure** (slot labels like
  `1E`/`3AB`, round-to-round connections, dates) with live teams/scores/advancers joined in by FIFA
  match number. Must work mobile-first (horizontal scroll / pinch-zoom or a round stepper). Scheduled
  for the **polish milestone** (see build order); reuses existing match data.
- `/instructions` — a **rules page any player can open at any time**. Plain-language summary of: how to
  predict, the 5-minutes-before-kickoff lock, the "no prediction = 0 points" rule, the full point
  table (incl. the higher SF-onward values), the +20 champion bonus, the privacy rule, and how the
  leaderboard / tiebreakers work. Static content, no auth-gated data.
- `/admin` (admins only) — Sync now, manually override a match result, edit kickoffs/teams, set/clear
  champion, view raw tables.

UX notes: everything thumb-reachable; big tap targets; show kickoff countdown / "LOCKED" badges;
optimistic UI on prediction save with server validation.

---

## 8. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never exposed to client
APISPORTS_KEY=                    # API-Football key
SYNC_SECRET=                      # random string guarding /api/sync
NEXT_PUBLIC_SITE_URL=             # for magic-link redirect
```

Provide a `.env.example`. Never commit real keys.

---

## 9. Build order (milestones)

1. **Scaffold**: Next.js + TS + Tailwind + Supabase client. `.env.example`. Deployable hello-world.
2. **Auth**: magic-link login, first-login `display_name` capture, protected routes, sign out.
3. **Schema + RLS**: create all tables, the `leaderboard` view, RLS policies, the locking trigger. Provide SQL migration files.
4. **Football adapter + `/api/sync`**: pull teams + knockout fixtures into the DB. Admin "Sync now".
5. **Predictions**: per-match score + advancing-team entry, with kickoff locking + the privacy rule.
6. **Champion pick**: pick/lock flow.
7. **Scoring engine**: idempotent settlement on finished matches + champion bonus.
8. **Leaderboard**: view-backed page with enlarged top 3.
9. **Admin panel**: manual result override + re-settle, edit fixtures.
10. **Polish**: loading/empty/error states, local-time display, countdowns, mobile spacing, deploy to Vercel, wire cron-job.org.
11. **Bracket view** (`/bracket`): hard-coded 2026 bracket structure + live overlay (teams/scores/advancers by FIFA match number), mobile-first rendering. Can slot alongside polish.

After each milestone: run it, show me, and wait before moving on.

---

## 10. Acceptance tests (must pass)

- **R32/R16/QF:** predicting `2–1` on a match that finishes `2–1` after 90 mins, with the right advancing team → **7 pts** (5 + 2).
- **SF/THIRD/FINAL:** the same perfect prediction → **15 pts** (10 + 5).
- Predicting `1–1` (advances on pens) where the match is `1–1` at 90 and your picked team advances → **7 pts** in QF, **15 pts** in the Final.
- Right advancing team but wrong score → **+2** (R32–QF) / **+5** (SF onward). Verify the exact-score and winner flags independently.
- A player with **no prediction** for a match earns **0 pts** for it.
- Editing a prediction **within 5 minutes of kickoff (i.e. at/after `kickoff_at − 5 min`)** is rejected by the DB, not just hidden in the UI.
- Player A cannot read Player B's pick for a match that hasn't kicked off; can after kickoff.
- Champion pick cannot be changed after the champion lock time.
- Re-running `/api/sync` on already-settled matches does not change anyone's totals.
- Correct champion → exactly **+20**, applied once.
- The `/instructions` page is reachable by any signed-in player at any time.

---

## 11. Out of scope (do NOT build)
- Group-stage predictions (knockouts only).
- Real-money buy-ins, payments, payouts.
- Push notifications, native apps, social login.
- Public sign-up beyond the friends group (keep it invite/email based; an admin allowlist is fine).

---

## 12. Open items to confirm with me if they come up
- Whether champion pick is chosen from the 32 teams that reached the knockouts (preferred) vs all 48.
- Exact API-Football field for the 90-minute score vs extra-time score (verify against live data).
- Whether to email players when a new round opens (nice-to-have, skip for v1).
