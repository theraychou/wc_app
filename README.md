# World Cup 2026 Prediction Pool

Mobile-first web app where a small private group predicts the FIFA World Cup 2026
knockout stage. See [BUILD.md](BUILD.md) for the full spec.

## Stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS** (mobile-first)
- **Supabase** — magic-link auth, Postgres, Row-Level Security
- **API-Football** for results (added in a later milestone)
- **Vercel** for hosting

## Milestone status

- ✅ **1. Scaffold** — Next.js + TS + Tailwind + Supabase client, deployable hello-world.
- ✅ **2. Auth** — magic-link login, first-login display-name capture, route protection
  (middleware), sign out. Degrades gracefully until `.env.local` is set.
- ✅ **3. Schema + RLS** — `0001`/`0002` migrations applied: tables, `leaderboard` view,
  RLS policies, locking trigger.
- ✅ **4. Football adapter + `/api/sync`** — `lib/football/provider.ts` (API-Football),
  secured `GET /api/sync`, shared `runSync`, admin "Sync now" at `/admin`. Season is set by
  `WC_SEASON` (dev uses the real 2022 World Cup; free plan can't access 2026).
- ✅ **5. Predictions** — `/matches` (grouped by round), `/match/[id]` (score + advancing-team
  entry with optimistic save), 5-minute kickoff lock (DB trigger), privacy reveal at kickoff,
  dashboard "open to predict" preview. Local-time display via `<LocalTime>`.
- ✅ **6. Champion pick** — `/champion` pick/change flow, lock at first knockout kickoff
  (DB trigger), dashboard champion card. `runSync` sets `champion_lock_at` (once) to the
  earliest knockout kickoff.
- ✅ **7. Scoring engine** — idempotent settlement (`lib/scoring/settle.ts`) on finished matches:
  round-based points (5/2, 10/5 from SF on), independent exact/winner flags, +20 champion via the
  `leaderboard` view. Runs inside `runSync`; self-heals on result corrections.
- ✅ **8. Leaderboard** — `/leaderboard` backed by the `leaderboard` view: enlarged top-3 podium
  cards, compact list for the rest, "you" highlight, full tiebreaker order (points → exact hits →
  join time). Dashboard shows your rank + points.
- ✅ **9. Admin panel** — `/admin` (result override → re-settle, edit kickoffs/teams/status,
  champion lock + reset controls, Sync now, Re-settle), `/admin/match/[id]` editor,
  `/admin/data` raw tables. All admin-gated (RLS + server-action check).
- 🚧 **10. Polish** — kickoff countdowns, thumb-reachable bottom nav, loading/error/not-found
  states done. Deploy to Vercel + cron-job.org pending (see [DEPLOY.md](DEPLOY.md)).
- ✅ **12. Groups** — multi-group support (migration `0003`): self-service join codes
  (`create_group`/`join_group`), group-scoped leaderboard (`group_leaderboard()`), cross-group
  prediction privacy (RLS), group name shown on the dashboard. Tournament data stays global.
- ✅ **11. Bracket** — `/bracket`: data-driven knockout tree (`lib/bracket.ts` orders each round by
  real lineage so connectors trace progression), teams/90'-scores/winners populate and propagate,
  per-viewer points badges, pure-CSS connectors, horizontal-scroll mobile layout. Auto-adapts to the
  2026 R32 format.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000
```

## Environment

Copy `.env.example` to `.env.local` and fill in the values. Only `NEXT_PUBLIC_*`
vars are exposed to the browser. Never commit `.env.local`.

## Database

The schema, RLS policies, triggers, and the `leaderboard` view live in
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
(a copy of `supabase_migration.sql`).

To apply it, paste the file into the **Supabase SQL Editor** and run it against
your project. (Applying it requires a live Supabase project, so it is not run as
part of the scaffold.)

## Supabase client modules

- `lib/supabase/client.ts` — browser client for Client Components (anon key).
- `lib/supabase/server.ts` — cookie-based client for Server Components / Route
  Handlers / Server Actions (anon key, RLS as the signed-in user).
- `lib/supabase/admin.ts` — service-role client; **server-only**, bypasses RLS.
