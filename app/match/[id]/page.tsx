import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamMap, teamName } from "@/lib/data/teams";
import { ROUND_LABELS, exactPoints, winnerPoints } from "@/lib/rounds";
import { isLocked, isKickedOff } from "@/lib/lock";
import { LocalTime } from "@/components/local-time";
import { Countdown } from "@/components/countdown";
import PredictionForm from "./prediction-form";
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
  winner_team_id: string | null;
  went_to_penalties: boolean;
}

interface PredRow {
  user_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string;
  points_awarded: number;
  exact_hit: boolean | null;
  winner_hit: boolean | null;
  profiles: { display_name: string } | null;
}

export default async function MatchPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [teamMap, { data: match }] = await Promise.all([
    getTeamMap(supabase),
    supabase
      .from("matches")
      .select(
        "id, round, kickoff_at, home_team_id, away_team_id, status, home_score_ft, away_score_ft, winner_team_id, went_to_penalties",
      )
      .eq("id", params.id)
      .single<MatchRow>(),
  ]);

  if (!match) notFound();

  // RLS returns my own prediction always; others' only once kicked off.
  const { data: predsRaw } = await supabase
    .from("predictions")
    .select(
      "user_id, pred_home_score, pred_away_score, pred_winner_team_id, points_awarded, exact_hit, winner_hit, profiles(display_name)",
    )
    .eq("match_id", params.id);
  const preds = (predsRaw ?? []) as unknown as PredRow[];

  const teamsAssigned = !!match.home_team_id && !!match.away_team_id;
  const locked = isLocked(match.kickoff_at);
  const kickedOff = isKickedOff(match.kickoff_at);
  const finished = match.status === "finished";
  const open = teamsAssigned && !locked;

  const mine = preds.find((p) => p.user_id === user.id) ?? null;
  const others = preds.filter((p) => p.user_id !== user.id);

  const homeName = teamName(teamMap, match.home_team_id);
  const awayName = teamName(teamMap, match.away_team_id);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <a
          href="/matches"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Matches
        </a>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {ROUND_LABELS[match.round]}
        </span>
      </header>

      <section className="mt-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">
          {homeName} <span className="text-neutral-500">v</span> {awayName}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          <LocalTime iso={match.kickoff_at} />
        </p>
        {!finished && (
          <p className="mt-1 text-sm">
            <Countdown iso={match.kickoff_at} />
          </p>
        )}

        {finished && match.home_score_ft != null && (
          <div className="mt-3 inline-block rounded-lg border border-neutral-700 px-4 py-2">
            <div className="text-2xl font-bold">
              {match.home_score_ft}–{match.away_score_ft}
              <span className="ml-1 text-xs font-normal text-neutral-500">
                90&apos;
              </span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-400">
              {teamName(teamMap, match.winner_team_id)} advance
              {match.went_to_penalties ? " (penalties)" : ""}
            </div>
          </div>
        )}
      </section>

      {/* Prediction entry / your pick */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          Your prediction
        </h2>

        {!teamsAssigned ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
            Teams aren&apos;t set yet. Predictions open once both teams are
            known.
          </p>
        ) : open ? (
          <>
            <p className="mb-3 text-xs text-neutral-500">
              Locks 5 minutes before kickoff · exact score +
              {exactPoints(match.round)}, right team +{winnerPoints(match.round)}
            </p>
            <PredictionForm
              matchId={match.id}
              userId={user.id}
              home={{ id: match.home_team_id!, name: homeName }}
              away={{ id: match.away_team_id!, name: awayName }}
              initial={
                mine
                  ? {
                      pred_home_score: mine.pred_home_score,
                      pred_away_score: mine.pred_away_score,
                      pred_winner_team_id: mine.pred_winner_team_id,
                    }
                  : null
              }
            />
          </>
        ) : mine ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <p className="text-sm text-neutral-200">
              {mine.pred_home_score}–{mine.pred_away_score} ·{" "}
              {teamName(teamMap, mine.pred_winner_team_id)} to advance
            </p>
            <p className="mt-1 text-xs text-amber-300">
              Locked — predictions closed.
            </p>
            {finished && (
              <p className="mt-1 text-xs text-neutral-400">
                Points: {mine.points_awarded}
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
            Locked — you didn&apos;t make a prediction, so 0 points for this
            match.
          </p>
        )}
      </section>

      {/* Everyone else — only visible after kickoff (RLS-enforced) */}
      {kickedOff && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-200">
            Everyone&apos;s picks
          </h2>
          {others.length === 0 ? (
            <p className="text-sm text-neutral-500">No other predictions.</p>
          ) : (
            <ul className="space-y-2">
              {others.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-sm"
                >
                  <span className="text-neutral-200">
                    {p.profiles?.display_name ?? "Player"}
                  </span>
                  <span className="text-neutral-400">
                    {p.pred_home_score}–{p.pred_away_score} ·{" "}
                    {teamName(teamMap, p.pred_winner_team_id)}
                    {finished && (
                      <span className="ml-2 text-neutral-300">
                        ({p.points_awarded} pts)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
