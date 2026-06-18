import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamMap, teamName } from "@/lib/data/teams";
import { ROUND_ORDER, ROUND_LABELS } from "@/lib/rounds";
import { isLocked, isKickedOff } from "@/lib/lock";
import { LocalTime } from "@/components/local-time";
import type { MatchRound } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MatchRow {
  id: string;
  round: MatchRound;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: "scheduled" | "live" | "finished";
  home_score_ft: number | null;
  away_score_ft: number | null;
}

function StatusBadge({ m }: { m: MatchRow }) {
  if (m.status === "finished")
    return <Badge tone="neutral">Final</Badge>;
  if (m.status === "live") return <Badge tone="live">Live</Badge>;
  if (isLocked(m.kickoff_at)) return <Badge tone="locked">Locked</Badge>;
  return <Badge tone="open">Open</Badge>;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "open" | "locked" | "live" | "neutral";
}) {
  const cls = {
    open: "border-emerald-700/50 text-emerald-300",
    locked: "border-amber-700/50 text-amber-300",
    live: "border-red-700/50 text-red-300",
    neutral: "border-neutral-700 text-neutral-400",
  }[tone];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

export default async function MatchesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [teamMap, { data: matches }, { data: preds }] = await Promise.all([
    getTeamMap(supabase),
    supabase
      .from("matches")
      .select(
        "id, round, kickoff_at, home_team_id, away_team_id, status, home_score_ft, away_score_ft",
      )
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, pred_home_score, pred_away_score, pred_winner_team_id")
      .eq("user_id", user.id),
  ]);

  const myPred = new Map(
    (preds ?? []).map((p) => [p.match_id, p] as const),
  );

  const byRound = new Map<MatchRound, MatchRow[]>();
  for (const m of (matches ?? []) as MatchRow[]) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      {(!matches || matches.length === 0) && (
        <p className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
          No matches yet. An admin needs to run a sync.
        </p>
      )}

      {ROUND_ORDER.filter((r) => byRound.has(r)).map((round) => (
        <section key={round} className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {ROUND_LABELS[round]}
          </h2>
          <ul className="space-y-2">
            {byRound.get(round)!.map((m) => {
              const p = myPred.get(m.id);
              const revealResult = m.status === "finished";
              return (
                <li key={m.id}>
                  <a
                    href={`/match/${m.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 hover:bg-neutral-900"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-neutral-100">
                        {teamName(teamMap, m.home_team_id)}{" "}
                        <span className="text-neutral-500">v</span>{" "}
                        {teamName(teamMap, m.away_team_id)}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        <LocalTime iso={m.kickoff_at} />
                        {revealResult &&
                          m.home_score_ft != null &&
                          m.away_score_ft != null && (
                            <span className="ml-2 text-neutral-300">
                              · {m.home_score_ft}–{m.away_score_ft} (90&apos;)
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge m={m} />
                      {p ? (
                        <span className="text-[11px] text-neutral-400">
                          You: {p.pred_home_score}–{p.pred_away_score}
                        </span>
                      ) : isKickedOff(m.kickoff_at) ? (
                        <span className="text-[11px] text-neutral-600">
                          no pick
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-400">
                          predict →
                        </span>
                      )}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
