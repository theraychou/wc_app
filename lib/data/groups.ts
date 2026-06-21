import type { SupabaseClient } from "@supabase/supabase-js";

export interface MyGroup {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
}

/** The groups the user belongs to (primary/first joined first), with counts. */
export async function getMyGroups(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyGroup[]> {
  const { data: mine } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  const ids = (mine ?? []).map((m) => m.group_id as string);
  if (ids.length === 0) return [];

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("id, name, join_code").in("id", ids),
    supabase.from("group_members").select("group_id").in("group_id", ids),
  ]);

  const counts: Record<string, number> = {};
  for (const m of members ?? [])
    counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;
  const byId = Object.fromEntries((groups ?? []).map((g) => [g.id, g]));

  return ids
    .filter((id) => byId[id])
    .map((id) => ({
      id,
      name: byId[id].name as string,
      join_code: byId[id].join_code as string,
      member_count: counts[id] ?? 0,
    }));
}
