"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/sync/run";
import { settleFinishedMatches } from "@/lib/scoring/settle";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns a service-role client iff the caller is a signed-in admin, else null. */
async function adminClientIfAllowed(): Promise<SupabaseClient | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return null;
  return createAdminClient();
}

export type SyncActionResult =
  | { ok: true; teamsUpserted: number; matchesUpserted: number }
  | { ok: false; error: string };

export async function syncNowAction(): Promise<SyncActionResult> {
  const admin = await adminClientIfAllowed();
  if (!admin) return { ok: false, error: "Admins only" };
  try {
    const summary = await runSync(admin);
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return {
      ok: true,
      teamsUpserted: summary.teamsUpserted,
      matchesUpserted: summary.matchesUpserted,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "sync failed",
    };
  }
}

/** Re-run settlement only (no API call). */
export async function reSettleAction(): Promise<void> {
  const admin = await adminClientIfAllowed();
  if (!admin) return;
  await settleFinishedMatches(admin);
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/**
 * Override a match: kickoff, teams, status, 90-minute score, advancer,
 * penalties. Then re-settle so points self-heal. Admin-gated; uses the
 * service-role client (bypasses RLS + lock trigger).
 */
export async function updateMatchAction(formData: FormData): Promise<void> {
  const admin = await adminClientIfAllowed();
  if (!admin) return;

  const matchId = String(formData.get("match_id"));
  const ko = strOrNull(formData.get("kickoff_at"));

  const patch: Record<string, unknown> = {
    status: String(formData.get("status")),
    home_team_id: strOrNull(formData.get("home_team_id")),
    away_team_id: strOrNull(formData.get("away_team_id")),
    home_score_ft: intOrNull(formData.get("home_score_ft")),
    away_score_ft: intOrNull(formData.get("away_score_ft")),
    winner_team_id: strOrNull(formData.get("winner_team_id")),
    went_to_penalties: formData.get("went_to_penalties") === "on",
    updated_at: new Date().toISOString(),
  };
  // datetime-local is wall-clock; treat admin input as UTC.
  if (ko) patch.kickoff_at = new Date(`${ko}Z`).toISOString();

  const { error } = await admin
    .from("matches")
    .update(patch)
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  await settleFinishedMatches(admin);
  revalidatePath("/admin");
  revalidatePath(`/admin/match/${matchId}`);
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  redirect(`/admin/match/${matchId}?saved=1`);
}

/** Tournament controls: champion lock + champion settlement reset. */
export async function lockChampionNowAction(): Promise<void> {
  const admin = await adminClientIfAllowed();
  if (!admin) return;
  await admin
    .from("tournament")
    .update({ champion_lock_at: new Date().toISOString() })
    .eq("id", 1);
  revalidatePath("/admin");
  revalidatePath("/champion");
}

export async function unlockChampionAction(): Promise<void> {
  const admin = await adminClientIfAllowed();
  if (!admin) return;
  await admin
    .from("tournament")
    .update({ champion_lock_at: null })
    .eq("id", 1);
  revalidatePath("/admin");
  revalidatePath("/champion");
}

export async function resetChampionAction(): Promise<void> {
  const admin = await adminClientIfAllowed();
  if (!admin) return;
  await admin
    .from("tournament")
    .update({ champion_team_id: null, settled_champion: false })
    .eq("id", 1);
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}
