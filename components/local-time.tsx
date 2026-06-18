"use client";

import { useEffect, useState } from "react";

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Renders a UTC timestamp in the viewer's local timezone. Falls back to a
 * stable UTC string for SSR so there's no hydration mismatch; the local format
 * fills in on mount.
 */
export function LocalTime({
  iso,
  opts,
}: {
  iso: string;
  opts?: Intl.DateTimeFormatOptions;
}) {
  const [local, setLocal] = useState<string>("");

  useEffect(() => {
    setLocal(new Date(iso).toLocaleString(undefined, opts ?? DEFAULT_OPTS));
  }, [iso, opts]);

  const fallback = `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {local || fallback}
    </time>
  );
}
