import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/rounds";
import { updateMatchAction } from "../../actions";
import type { MatchRound } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MatchRow {
  id: string;
  round: MatchRound;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: string;
  home_score_ft: number | null;
  away_score_ft: number | null;
  winner_team_id: string | null;
  went_to_penalties: boolean;
}

export default async function AdminMatchEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/");

  const [{ data: match }, { data: teams }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, round, kickoff_at, home_team_id, away_team_id, status, home_score_ft, away_score_ft, winner_team_id, went_to_penalties",
      )
      .eq("id", params.id)
      .single<MatchRow>(),
    supabase.from("teams").select("id, name").order("name"),
  ]);
  if (!match) notFound();

  const teamOpts = (teams ?? []) as { id: string; name: string }[];
  // datetime-local value (UTC wall-clock).
  const koLocal = match.kickoff_at.slice(0, 16);

  const field =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-400";
  const label = "block text-xs font-medium text-neutral-400";

  function TeamSelect({
    name,
    value,
    allowNone,
  }: {
    name: string;
    value: string | null;
    allowNone?: boolean;
  }) {
    return (
      <select name={name} defaultValue={value ?? ""} className={field}>
        {allowNone && <option value="">— TBD / none —</option>}
        {teamOpts.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <header className="flex items-center justify-between">
        <a
          href="/admin"
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          ← Admin
        </a>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {ROUND_LABELS[match.round]}
        </span>
      </header>

      <h1 className="mt-4 text-xl font-bold tracking-tight">Edit match</h1>
      {searchParams.saved && (
        <p className="mt-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-2 text-sm text-emerald-200">
          Saved &amp; re-settled ✓
        </p>
      )}

      <form action={updateMatchAction} className="mt-5 space-y-4">
        <input type="hidden" name="match_id" value={match.id} />

        <div className="space-y-1">
          <label className={label}>Kickoff (UTC)</label>
          <input
            type="datetime-local"
            name="kickoff_at"
            defaultValue={koLocal}
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label}>Home team</label>
            <TeamSelect name="home_team_id" value={match.home_team_id} allowNone />
          </div>
          <div className="space-y-1">
            <label className={label}>Away team</label>
            <TeamSelect name="away_team_id" value={match.away_team_id} allowNone />
          </div>
        </div>

        <div className="space-y-1">
          <label className={label}>Status</label>
          <select name="status" defaultValue={match.status} className={field}>
            <option value="scheduled">scheduled</option>
            <option value="live">live</option>
            <option value="finished">finished</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label}>Home score (90&apos;)</label>
            <input
              type="number"
              min={0}
              name="home_score_ft"
              defaultValue={match.home_score_ft ?? ""}
              className={field}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Away score (90&apos;)</label>
            <input
              type="number"
              min={0}
              name="away_score_ft"
              defaultValue={match.away_score_ft ?? ""}
              className={field}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className={label}>Advances (winner)</label>
          <TeamSelect
            name="winner_team_id"
            value={match.winner_team_id}
            allowNone
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            name="went_to_penalties"
            defaultChecked={match.went_to_penalties}
            className="h-4 w-4"
          />
          Decided on penalties
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
        >
          Save &amp; re-settle
        </button>
        <p className="text-center text-xs text-neutral-500">
          Saving recomputes everyone&apos;s points for this match.
        </p>
      </form>
    </main>
  );
}
