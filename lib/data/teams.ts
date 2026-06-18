import type { SupabaseClient } from "@supabase/supabase-js";

export interface TeamLite {
  id: string;
  name: string;
  flag_url: string | null;
}

/** Fetch all teams as an id -> team map. The set is small (≤32). */
export async function getTeamMap(
  supabase: SupabaseClient,
): Promise<Record<string, TeamLite>> {
  const { data } = await supabase.from("teams").select("id, name, flag_url");
  const map: Record<string, TeamLite> = {};
  for (const t of data ?? []) map[t.id] = t as TeamLite;
  return map;
}

export function teamName(
  map: Record<string, TeamLite>,
  id: string | null,
): string {
  return id ? (map[id]?.name ?? "Unknown") : "TBD";
}
