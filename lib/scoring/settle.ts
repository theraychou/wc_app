import type { SupabaseClient } from "@supabase/supabase-js";
import { exactPoints, winnerPoints } from "@/lib/rounds";
import type { MatchRound } from "@/lib/types";

export interface SettleSummary {
  finishedMatches: number;
  predictionsScored: number;
  championSettled: boolean;
}

interface FinishedMatch {
  id: string;
  round: MatchRound;
  status: string;
  home_score_ft: number | null;
  away_score_ft: number | null;
  winner_team_id: string | null;
}

interface PredRow {
  id: string;
  match_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string;
}

/**
 * Idempotent settlement. Recomputes exact_hit / winner_hit / points_awarded for
 * every prediction on a finished match FROM SCRATCH (never increments), and
 * records the champion when the Final is finished.
 *
 * - Exact score uses the 90-minute result (matches.*_score_ft).
 * - Winner uses matches.winner_team_id (the team that advanced).
 * - Points are round-dependent (5/2 base, 10/5 from the semis on).
 * - The +20 champion bonus is applied by the `leaderboard` view from
 *   tournament.champion_team_id, so settlement only records the champion here.
 *
 * Must be called with a SERVICE-ROLE client (bypasses RLS and the prediction
 * lock trigger so settled rows on locked matches can be written).
 */
export async function settleFinishedMatches(
  admin: SupabaseClient,
): Promise<SettleSummary> {
  const { data: matchesRaw } = await admin
    .from("matches")
    .select("id, round, status, home_score_ft, away_score_ft, winner_team_id")
    .eq("status", "finished");
  const matches = (matchesRaw ?? []) as FinishedMatch[];

  let predictionsScored = 0;

  if (matches.length > 0) {
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const { data: predsRaw } = await admin
      .from("predictions")
      .select(
        "id, match_id, pred_home_score, pred_away_score, pred_winner_team_id",
      )
      .in(
        "match_id",
        matches.map((m) => m.id),
      );
    const preds = (predsRaw ?? []) as PredRow[];

    // Group prediction ids by identical outcome so we issue a handful of bulk
    // updates instead of one per row.
    const groups = new Map<
      string,
      { exact: boolean; winner: boolean; points: number; ids: string[] }
    >();

    for (const p of preds) {
      const m = matchById.get(p.match_id)!;
      const exact =
        m.home_score_ft != null &&
        m.away_score_ft != null &&
        p.pred_home_score === m.home_score_ft &&
        p.pred_away_score === m.away_score_ft;
      const winner =
        m.winner_team_id != null && p.pred_winner_team_id === m.winner_team_id;
      const points =
        (exact ? exactPoints(m.round) : 0) +
        (winner ? winnerPoints(m.round) : 0);

      const key = `${exact}|${winner}|${points}`;
      const g = groups.get(key) ?? { exact, winner, points, ids: [] };
      g.ids.push(p.id);
      groups.set(key, g);
    }

    for (const g of groups.values()) {
      const { error } = await admin
        .from("predictions")
        .update({
          exact_hit: g.exact,
          winner_hit: g.winner,
          points_awarded: g.points,
          updated_at: new Date().toISOString(),
        })
        .in("id", g.ids);
      if (error) throw new Error(`settle update failed: ${error.message}`);
      predictionsScored += g.ids.length;
    }
  }

  // Champion: derive from the Final whenever it's finished (self-heals if an
  // admin corrects the result); clear otherwise.
  const final = matches.find((m) => m.round === "FINAL");
  let championSettled = false;
  if (final && final.winner_team_id) {
    await admin
      .from("tournament")
      .update({
        champion_team_id: final.winner_team_id,
        settled_champion: true,
      })
      .eq("id", 1);
    championSettled = true;
  } else {
    await admin
      .from("tournament")
      .update({ champion_team_id: null, settled_champion: false })
      .eq("id", 1);
  }

  return {
    finishedMatches: matches.length,
    predictionsScored,
    championSettled,
  };
}
