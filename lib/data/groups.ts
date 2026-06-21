import type { SupabaseClient } from "@supabase/supabase-js";

export interface GroupMember {
  id: string;
  display_name: string;
}

export interface MyGroup {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
  is_owner: boolean;
  owner_id: string | null;
  members: GroupMember[];
}

/** The groups the user belongs to (primary first), with members + ownership. */
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
    supabase.from("groups").select("id, name, join_code, created_by").in("id", ids),
    supabase
      .from("group_members")
      .select("group_id, user_id, joined_at")
      .in("group_id", ids)
      .order("joined_at", { ascending: true }),
  ]);

  // names for all members across these groups
  const memberIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds);
  const nameById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name as string]),
  );

  const byGroup: Record<string, GroupMember[]> = {};
  for (const m of members ?? []) {
    (byGroup[m.group_id] ??= []).push({
      id: m.user_id,
      display_name: nameById[m.user_id] ?? "Player",
    });
  }

  const groupById = Object.fromEntries((groups ?? []).map((g) => [g.id, g]));

  return ids
    .filter((id) => groupById[id])
    .map((id) => {
      const g = groupById[id];
      return {
        id,
        name: g.name as string,
        join_code: g.join_code as string,
        owner_id: (g.created_by as string | null) ?? null,
        is_owner: g.created_by === userId,
        members: byGroup[id] ?? [],
        member_count: (byGroup[id] ?? []).length,
      };
    });
}
