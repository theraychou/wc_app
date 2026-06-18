import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import ChampionPicker from "./champion-picker";
import type { TeamLite } from "@/lib/data/teams";

export const dynamic = "force-dynamic";

export default async function ChampionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: tournament }, { data: teams }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("champion_team_id")
        .eq("id", user.id)
        .single(),
      supabase
        .from("tournament")
        .select("champion_lock_at")
        .eq("id", 1)
        .single(),
      supabase
        .from("teams")
        .select("id, name, flag_url")
        .order("name", { ascending: true }),
    ]);

  const lockAt = tournament?.champion_lock_at ?? null;
  const locked = lockAt != null && Date.now() >= new Date(lockAt).getTime();
  const currentId = profile?.champion_team_id ?? null;
  const teamList = (teams ?? []) as TeamLite[];
  const current = teamList.find((t) => t.id === currentId) ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Champion</h1>
        <a
          href="/"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Dashboard
        </a>
      </header>

      <p className="mt-3 text-sm text-neutral-400">
        Pick the team you think wins the whole tournament. Correct champion =
        <strong className="text-neutral-200"> +20 points</strong>, awarded after
        the Final.
      </p>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Your champion
        </p>
        <p className="mt-1 text-lg font-semibold text-neutral-100">
          {current ? current.name : "Not picked yet"}
        </p>
        {lockAt && (
          <p className="mt-1 text-xs text-neutral-500">
            {locked ? "Locked at " : "Locks at "}
            <LocalTime iso={lockAt} /> (first knockout kickoff)
          </p>
        )}
      </div>

      <section className="mt-6">
        {teamList.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
            No teams yet — an admin needs to sync the knockout teams first.
          </p>
        ) : locked ? (
          <p className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
            The champion pick is locked (the tournament has started). It can no
            longer be changed.
          </p>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-semibold text-neutral-200">
              Choose your champion
            </h2>
            <ChampionPicker
              userId={user.id}
              teams={teamList}
              currentId={currentId}
            />
          </>
        )}
      </section>
    </main>
  );
}
