"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TeamSide {
  id: string;
  name: string;
}

export default function PredictionForm({
  matchId,
  userId,
  home,
  away,
  initial,
}: {
  matchId: string;
  userId: string;
  home: TeamSide;
  away: TeamSide;
  initial: {
    pred_home_score: number;
    pred_away_score: number;
    pred_winner_team_id: string;
  } | null;
}) {
  const router = useRouter();
  const [homeScore, setHomeScore] = useState(
    initial ? String(initial.pred_home_score) : "",
  );
  const [awayScore, setAwayScore] = useState(
    initial ? String(initial.pred_away_score) : "",
  );
  const [winnerId, setWinnerId] = useState<string | null>(
    initial?.pred_winner_team_id ?? null,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(homeScore);
    const a = Number(awayScore);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setStatus("error");
      setErrorMsg("Enter both scores as whole numbers (0 or more).");
      return;
    }
    if (!winnerId) {
      setStatus("error");
      setErrorMsg("Pick which team advances.");
      return;
    }

    setStatus("saving");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        match_id: matchId,
        pred_home_score: h,
        pred_away_score: a,
        pred_winner_team_id: winnerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,match_id" },
    );

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  const scoreInput =
    "w-16 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-lg text-neutral-100 outline-none focus:border-neutral-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Score after 90 minutes
        </p>
        <div className="flex items-center justify-between gap-2">
          <label className="flex-1 text-sm text-neutral-200">{home.name}</label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            className={scoreInput}
            aria-label={`${home.name} score`}
          />
          <span className="text-neutral-600">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            className={scoreInput}
            aria-label={`${away.name} score`}
          />
          <label className="flex-1 text-right text-sm text-neutral-200">
            {away.name}
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Who advances? (covers extra time / penalties)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[home, away].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setWinnerId(t.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                winnerId === t.id
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {status === "saving"
          ? "Saving…"
          : initial
            ? "Update prediction"
            : "Save prediction"}
      </button>

      {status === "saved" && (
        <p className="text-sm text-emerald-300">Saved ✓</p>
      )}
      {status === "error" && <p className="text-sm text-red-400">{errorMsg}</p>}
    </form>
  );
}
