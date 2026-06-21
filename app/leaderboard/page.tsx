import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/data/groups";

export const dynamic = "force-dynamic";

interface Row {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_hits: number;
  winner_hits: number;
  champion_correct: boolean;
}

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_RING = [
  "border-amber-400/60 bg-amber-400/10",
  "border-neutral-300/40 bg-neutral-300/10",
  "border-orange-700/50 bg-orange-700/10",
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { group?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const myGroups = await getMyGroups(supabase, user.id);
  // Selected group: ?group= if it's one of mine, else the primary (first).
  const selected =
    myGroups.find((g) => g.id === searchParams.group)?.id ??
    myGroups[0]?.id ??
    null;

  // group_leaderboard(group_id) returns that group's ranking in tiebreaker order.
  const { data } = selected
    ? await supabase.rpc("group_leaderboard", { p_group_id: selected })
    : { data: [] };

  const rows = ((data ?? []) as Row[]).map((r) => ({
    ...r,
    total_points: Number(r.total_points),
    exact_hits: Number(r.exact_hits),
    winner_hits: Number(r.winner_hits),
  }));

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const anyPoints = rows.some((r) => r.total_points > 0);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      {myGroups.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {myGroups.map((g) => (
            <a
              key={g.id}
              href={`/leaderboard?group=${g.id}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                g.id === selected
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              {g.name}
            </a>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
          No players yet.
        </p>
      ) : (
        <>
          {!anyPoints && (
            <p className="mt-4 text-sm text-neutral-500">
              No points yet — the table fills in as matches are settled.
            </p>
          )}

          {/* Top 3 — enlarged podium cards */}
          <section className="mt-6 space-y-3">
            {podium.map((r, i) => {
              const isMe = r.user_id === user.id;
              return (
                <div
                  key={r.user_id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${PODIUM_RING[i]} ${
                    isMe ? "ring-1 ring-emerald-500/60" : ""
                  }`}
                >
                  <div className="text-3xl" aria-hidden>
                    {MEDAL[i]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-neutral-50">
                      {r.display_name}
                      {isMe && (
                        <span className="ml-2 text-xs font-normal text-emerald-400">
                          you
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {r.exact_hits} exact · {r.winner_hits} winners
                      {r.champion_correct ? " · 🏆 champion" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-neutral-50">
                      {r.total_points}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      pts
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Ranks 4+ — compact list */}
          {rest.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {rest.map((r, i) => {
                const isMe = r.user_id === user.id;
                return (
                  <li
                    key={r.user_id}
                    className={`flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 text-sm ${
                      isMe ? "ring-1 ring-emerald-500/60" : ""
                    }`}
                  >
                    <span className="w-5 shrink-0 text-center text-neutral-500">
                      {i + 4}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-100">
                      {r.display_name}
                      {isMe && (
                        <span className="ml-2 text-xs text-emerald-400">you</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {r.exact_hits} exact
                    </span>
                    <span className="w-10 shrink-0 text-right font-semibold text-neutral-100">
                      {r.total_points}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-6 text-center text-xs text-neutral-600">
            Ties broken by most exact scores, then earliest to join.
          </p>
        </>
      )}
    </main>
  );
}
