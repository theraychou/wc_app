"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function JoinAnotherGroup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.rpc("join_group", { p_code: code.trim() });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setCode("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter invite code"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm uppercase tracking-widest text-neutral-100 outline-none focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Join"}
        </button>
      </div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
    </form>
  );
}

export function LeaveGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!confirm(`Leave "${groupName}"? Your points stay in your other groups.`))
      return;
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("leave_group", { p_group_id: groupId });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={leave}
      disabled={busy}
      className="text-[11px] text-neutral-500 hover:text-red-400 disabled:opacity-60"
    >
      {busy ? "Leaving…" : "Leave"}
    </button>
  );
}
