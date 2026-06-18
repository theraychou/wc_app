import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTeamMap, teamName } from "@/lib/data/teams";
import { isLocked } from "@/lib/lock";
import { Countdown } from "@/components/countdown";

// Per-user, session-dependent — never statically cache the dashboard.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Before Supabase is set up, show a setup notice instead of crashing.
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="text-5xl" aria-hidden>
          ⚽️
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          World Cup 2026. Here We GO
        </h1>
        <div className="w-full rounded-lg border border-amber-700/50 bg-amber-950/30 p-4 text-left text-sm text-amber-200">
          <p className="font-medium">Supabase isn&apos;t configured yet.</p>
          <p className="mt-1 text-amber-200/80">
            Copy <code>.env.example</code> to <code>.env.local</code>, add your
            Supabase keys, then restart the dev server.
          </p>
        </div>
        <a
          href="/instructions"
          className="text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
        >
          How it works &amp; scoring →
        </a>
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should already enforce this, but guard defensively.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded, is_admin, champion_team_id")
    .eq("id", user.id)
    .single();

  // First login (or onboarding never finished) → capture a display name.
  if (!profile || !profile.onboarded) {
    redirect("/onboarding");
  }

  // Next few matches still open for prediction.
  const nowIso = new Date().toISOString();
  const [teamMap, { data: upcoming }, { data: board }] = await Promise.all([
    getTeamMap(supabase),
    supabase
      .from("matches")
      .select("id, kickoff_at, home_team_id, away_team_id")
      .neq("status", "finished")
      .gt("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .limit(3),
    supabase
      .from("leaderboard")
      .select("user_id, total_points, created_at")
      .order("total_points", { ascending: false })
      .order("exact_hits", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);
  const openUpcoming = (upcoming ?? []).filter((m) => !isLocked(m.kickoff_at));

  const myIndex = (board ?? []).findIndex((r) => r.user_id === user.id);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myPoints =
    myIndex >= 0 ? Number((board ?? [])[myIndex].total_points) : 0;
  const playerCount = (board ?? []).length;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Welcome back
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.display_name}
          </h1>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8 space-y-3">
        <a
          href="/leaderboard"
          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hover:bg-neutral-900"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Your standing
            </p>
            <p className="text-lg font-bold text-neutral-50">
              {myRank ? `Rank ${myRank} of ${playerCount}` : "Unranked"}
              <span className="ml-2 text-sm font-normal text-neutral-400">
                · {myPoints} pts
              </span>
            </p>
          </div>
          <span className="text-sm text-emerald-400">Leaderboard →</span>
        </a>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-100">
              Open to predict
            </h2>
            <a href="/matches" className="text-xs text-emerald-400">
              All matches →
            </a>
          </div>
          {openUpcoming.length === 0 ? (
            <p className="text-sm text-neutral-400">
              No matches open right now. Check{" "}
              <a href="/matches" className="text-emerald-400 underline">
                all matches
              </a>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {openUpcoming.map((m) => (
                <li key={m.id}>
                  <a
                    href={`/match/${m.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 p-2.5 text-sm hover:bg-neutral-900"
                  >
                    <span className="truncate text-neutral-100">
                      {teamName(teamMap, m.home_team_id)} v{" "}
                      {teamName(teamMap, m.away_team_id)}
                    </span>
                    <span className="shrink-0 text-xs">
                      <Countdown iso={m.kickoff_at} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <a
          href="/champion"
          className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hover:bg-neutral-900"
        >
          <span className="text-sm font-medium text-neutral-100">
            🏆 Champion pick
          </span>
          <span className="text-sm text-neutral-400">
            {profile.champion_team_id
              ? teamName(teamMap, profile.champion_team_id)
              : "Pick →"}
          </span>
        </a>

        <a
          href="/matches"
          className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-100 hover:bg-neutral-900"
        >
          ⚽ Matches &amp; predictions →
        </a>

        <a
          href="/instructions"
          className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm font-medium text-neutral-100 hover:bg-neutral-900"
        >
          📖 How it works &amp; scoring →
        </a>

        {profile.is_admin && (
          <a
            href="/admin"
            className="block rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4 text-sm font-medium text-emerald-200 hover:bg-emerald-950/40"
          >
            🛠️ Admin · Sync &amp; results →
          </a>
        )}
      </section>
    </main>
  );
}
