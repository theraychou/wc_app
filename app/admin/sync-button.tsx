"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncNowAction, type SyncActionResult } from "./actions";

export default function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncActionResult | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const res = await syncNowAction();
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>

      {result?.ok && (
        <p className="text-sm text-emerald-300">
          Synced {result.teamsUpserted} teams and {result.matchesUpserted}{" "}
          knockout matches.
        </p>
      )}
      {result && !result.ok && (
        <p className="text-sm text-red-400">{result.error}</p>
      )}
    </div>
  );
}
