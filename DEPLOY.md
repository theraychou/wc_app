# Deploying to Vercel + scheduling the sync

## 1. Push the code to GitHub

The project isn't a git repo yet. From the project folder:

```bash
git init
git add -A
git commit -m "World Cup 2026 prediction pool"
# create an EMPTY repo on github.com first, then:
git remote add origin https://github.com/<you>/wc-app.git
git branch -M main
git push -u origin main
```

`.gitignore` already excludes `.env.local`, so no secrets are committed.

## 2. Import into Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset auto-detects **Next.js**. No build settings needed.
3. Add the **Environment Variables** below (Settings → Environment Variables),
   then **Deploy**.

| Variable | Value | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | **NO — server only** |
| `APISPORTS_KEY` | API-Football key | no |
| `SYNC_SECRET` | the long random string from `.env.local` | no |
| `WC_LEAGUE_ID` | `1` | no |
| `WC_SEASON` | `2022` for dev data, `2026` for live (needs a paid API-Football plan) | no |
| `NEXT_PUBLIC_SITE_URL` | your Vercel URL, e.g. `https://wc-app.vercel.app` (no trailing slash) | yes |

> Never set `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` var — it bypasses
> all security.

## 3. Point Supabase auth at the deployed domain

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/auth/callback`

(Keep the localhost entries too if you still develop locally.)

Then redeploy if you changed `NEXT_PUBLIC_SITE_URL`.

## 4. Schedule the sync with cron-job.org

The sync endpoint is `GET /api/sync`, protected by `SYNC_SECRET`.

1. cron-job.org → **Create cronjob**.
2. **URL**: `https://<your-app>.vercel.app/api/sync?secret=<YOUR_SYNC_SECRET>`
   (use the `SYNC_SECRET` value from `.env.local`).
3. **Schedule**: every 15 minutes is plenty. Increase frequency only on
   knockout match days; the free API tier is 100 requests/day and each sync is
   ~1 call.
4. Save. The first run should return `{"ok":true,...}`.

> Prefer to keep the secret out of the URL? The endpoint also accepts it as the
> header `x-sync-secret: <YOUR_SYNC_SECRET>` — set that in cron-job.org's
> advanced "Headers" instead of the query string.

## 5. Going live with real 2026 data

When you're ready for the actual tournament: upgrade API-Football (or switch to
football-data.org), set `WC_SEASON=2026`, and run a sync. Re-verify the
`Round of 32` label maps correctly (see `lib/football/provider.ts`).
