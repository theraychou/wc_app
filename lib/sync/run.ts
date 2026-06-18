import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchKnockoutFixtures } from "@/lib/football/provider";
import { settleFinishedMatches } from "@/lib/scoring/settle";

export interface SyncSummary {
  teamsUpserted: number;
  matchesUpserted: number;
  finishedMatches: number;
  predictionsScored: number;
  championSettled: boolean;
  fetchedAt: string;
}

/**
 * Core sync routine. Pulls knockout teams + fixtures from the football provider
 * and upserts them. Must be called with a SERVICE-ROLE client (bypasses RLS;
 * matches/teams are admin-writable only).
 *
 * Idempotent: re-running refreshes existing rows by their natural keys
 * (teams.id, matches.api_fixture_id). Settlement of finished matches is added
 * in Milestone 7.
 */
export async function runSync(admin: SupabaseClient): Promise<SyncSummary> {
  const { teams, fixtures } = await fetchKnockoutFixtures();

  // Teams first — matches reference team ids via FK.
  if (teams.length > 0) {
    const { error } = await admin
      .from("teams")
      .upsert(
        teams.map((t) => ({ id: t.id, name: t.name, flag_url: t.flag_url })),
        { onConflict: "id" },
      );
    if (error) throw new Error(`teams upsert failed: ${error.message}`);
  }

  if (fixtures.length > 0) {
    const { error } = await admin
      .from("matches")
      .upsert(
        fixtures.map((f) => ({
          api_fixture_id: f.api_fixture_id,
          round: f.round,
          kickoff_at: f.kickoff_at,
          home_team_id: f.home_team_id,
          away_team_id: f.away_team_id,
          status: f.status,
          home_score_ft: f.home_score_ft,
          away_score_ft: f.away_score_ft,
          winner_team_id: f.winner_team_id,
          went_to_penalties: f.went_to_penalties,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "api_fixture_id" },
      );
    if (error) throw new Error(`matches upsert failed: ${error.message}`);
  }

  // Champion pick locks at the first knockout kickoff. Set it once (when still
  // null) so an admin override isn't clobbered on later syncs.
  if (fixtures.length > 0) {
    const earliest = fixtures
      .map((f) => f.kickoff_at)
      .sort()[0];
    const { data: t } = await admin
      .from("tournament")
      .select("champion_lock_at")
      .eq("id", 1)
      .single();
    if (t && t.champion_lock_at == null && earliest) {
      await admin
        .from("tournament")
        .update({ champion_lock_at: earliest })
        .eq("id", 1);
    }
  }

  // Settle any newly-finished matches and the champion.
  const settle = await settleFinishedMatches(admin);

  return {
    teamsUpserted: teams.length,
    matchesUpserted: fixtures.length,
    finishedMatches: settle.finishedMatches,
    predictionsScored: settle.predictionsScored,
    championSettled: settle.championSettled,
    fetchedAt: new Date().toISOString(),
  };
}
