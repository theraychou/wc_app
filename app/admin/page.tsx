import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamMap, teamName } from "@/lib/data/teams";
import { ROUND_ORDER, ROUND_LABELS } from "@/lib/rounds";
import { LocalTime } from "@/components/local-time";
import SyncButton from "./sync-button";
import {
  reSettleAction,
  lockChampionNowAction,
  unlockChampionAction,
  resetChampionAction,
} from "./actions";
import type { MatchRound } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AdminMatch {
  id: string;
  round: MatchRound;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: string;
  home_score_ft: number | null;
  away_score_ft: number | null;
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/");

  const [
    teamMap,
    { count: teamCount },
    { count: matchCount },
    { count: predCount },
    { data: tournament },
    { data: matches },
  ] = await Promise.all([
    getTeamMap(supabase),
    supabase.from("teams").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("predictions").select("*", { count: "exact", head: true }),
    supabase
      .from("tournament")
      .select("champion_team_id, settled_champion, champion_lock_at")
      .eq("id", 1)
      .single(),
    supabase
      .from("matches")
      .select(
        "id, round, kickoff_at, home_team_id, away_team_id, status, home_score_ft, away_score_ft",
      )
      .order("kickoff_at", { ascending: true }),
  ]);

  const byRound = new Map<MatchRound, AdminMatch[]>();
  for (const m of (matches ?? []) as AdminMatch[]) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ["Teams", teamCount],
          ["Matches", matchCount],
          ["Predictions", predCount],
        ].map(([label, n]) => (
          <div
            key={label as string}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center"
          >
            <p className="text-2xl font-bold">{n ?? 0}</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Sync + settle */}
      <section className="mt-5 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="text-sm font-semibold text-neutral-100">Data</h2>
        <p className="text-xs text-neutral-400">
          Sync pulls fixtures/results from the football API and settles. Re-settle
          recomputes points from current match data without an API call.
        </p>
        <SyncButton />
        <form action={reSettleAction}>
          <button
            type="submit"
            className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900"
          >
            Re-settle now
          </button>
        </form>
      </section>

      {/* Tournament / champion */}
      <section className="mt-4 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="text-sm font-semibold text-neutral-100">
          Tournament &amp; champion
        </h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Champion</dt>
            <dd className="text-neutral-200">
              {tournament?.champion_team_id
                ? teamName(teamMap, tournament.champion_team_id)
                : "—"}
              {tournament?.settled_champion ? " (settled)" : ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Champion lock</dt>
            <dd className="text-neutral-200">
              {tournament?.champion_lock_at ? (
                <LocalTime iso={tournament.champion_lock_at} />
              ) : (
                "open (unset)"
              )}
            </dd>
          </div>
        </dl>
        <div className="grid grid-cols-3 gap-2">
          <form action={lockChampionNowAction}>
            <button className="w-full rounded-lg border border-neutral-700 px-2 py-2 text-xs text-neutral-200 hover:bg-neutral-900">
              Lock now
            </button>
          </form>
          <form action={unlockChampionAction}>
            <button className="w-full rounded-lg border border-neutral-700 px-2 py-2 text-xs text-neutral-200 hover:bg-neutral-900">
              Unlock
            </button>
          </form>
          <form action={resetChampionAction}>
            <button className="w-full rounded-lg border border-amber-700/50 px-2 py-2 text-xs text-amber-200 hover:bg-amber-950/30">
              Reset champ
            </button>
          </form>
        </div>
      </section>

      {/* Matches → edit */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-100">
            Matches — tap to edit
          </h2>
          <a href="/admin/data" className="text-xs text-emerald-400">
            Raw tables →
          </a>
        </div>
        {ROUND_ORDER.filter((r) => byRound.has(r)).map((round) => (
          <div key={round} className="mt-3">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {ROUND_LABELS[round]}
            </h3>
            <ul className="space-y-1.5">
              {byRound.get(round)!.map((m) => (
                <li key={m.id}>
                  <a
                    href={`/admin/match/${m.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm hover:bg-neutral-900"
                  >
                    <span className="truncate text-neutral-100">
                      {teamName(teamMap, m.home_team_id)} v{" "}
                      {teamName(teamMap, m.away_team_id)}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {m.status === "finished" &&
                      m.home_score_ft != null
                        ? `${m.home_score_ft}–${m.away_score_ft}`
                        : m.status}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
