"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TeamLite } from "@/lib/data/teams";

export default function ChampionPicker({
  userId,
  teams,
  currentId,
}: {
  userId: string;
  teams: TeamLite[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentId);
  const [saving, setSaving] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function pick(teamId: string) {
    if (teamId === selected) return;
    setSaving(teamId);
    setErrorMsg("");
    const prev = selected;
    setSelected(teamId); // optimistic

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ champion_team_id: teamId })
      .eq("id", userId);

    setSaving(null);
    if (error) {
      setSelected(prev); // roll back
      setErrorMsg(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {teams.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t.id)}
              disabled={!!saving}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:opacity-60 ${
                active
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-100"
                  : "border-neutral-700 text-neutral-200 hover:bg-neutral-900"
              }`}
            >
              {t.flag_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.flag_url} alt="" className="h-4 w-6 object-contain" />
              )}
              <span className="truncate">{t.name}</span>
              {active && <span className="ml-auto text-emerald-300">✓</span>}
            </button>
          );
        })}
      </div>
      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
    </div>
  );
}
