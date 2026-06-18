import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamMap } from "@/lib/data/teams";
import { buildBracket, type RawMatch } from "@/lib/bracket";
import { Bracket } from "@/components/bracket";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
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
        "id, round, kickoff_at, home_team_id, away_team_id, status, home_score_ft, away_score_ft, winner_team_id, went_to_penalties",
      ),
    supabase
      .from("predictions")
      .select("match_id, points_awarded")
      .eq("user_id", user.id),
  ]);

  const rows = (matches ?? []) as RawMatch[];
  const finished = new Set(
    rows.filter((m) => m.status === "finished").map((m) => m.id),
  );

  // Viewer's points per match — only for matches that have been settled.
  const pointsByMatch = new Map<string, number | null>();
  for (const p of preds ?? []) {
    if (finished.has(p.match_id))
      pointsByMatch.set(p.match_id, p.points_awarded);
  }

  const data = buildBracket(rows, teamMap, pointsByMatch);

  return (
    <main className="mx-auto min-h-screen max-w-md px-3 py-8">
      <header className="flex items-center justify-between px-2">
        <h1 className="text-2xl font-bold tracking-tight">Bracket</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      {data.rounds.length === 0 ? (
        <p className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
          No knockout matches yet — an admin needs to run a sync.
        </p>
      ) : (
        <>
          <p className="mb-2 mt-2 px-2 text-xs text-neutral-500">
            Scroll sideways → · green = advanced · badge = your points · tap a
            match for details
          </p>
          <Bracket data={data} />
        </>
      )}
    </main>
  );
}
