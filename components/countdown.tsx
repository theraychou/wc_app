"use client";

import { useEffect, useState } from "react";
import { LOCK_LEAD_MS } from "@/lib/lock";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

/**
 * Live countdown to the prediction lock (kickoff − 5 min), then "Locked", then
 * "Kicked off". Returns null on the server pass to avoid hydration mismatch.
 */
export function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return null;

  const ko = new Date(iso).getTime();
  const lockAt = ko - LOCK_LEAD_MS;

  if (now >= ko)
    return <span className="text-neutral-500">Kicked off</span>;
  if (now >= lockAt)
    return <span className="font-medium text-amber-400">🔒 Locked</span>;

  return (
    <span className="text-emerald-400">Locks in {fmt(lockAt - now)}</span>
  );
}
