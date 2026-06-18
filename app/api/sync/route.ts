import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/sync/run";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync — pulls teams + knockout fixtures into the DB.
 *
 * Protected by SYNC_SECRET (header `x-sync-secret` or `?secret=`). This is the
 * endpoint cron-job.org calls on a schedule.
 */
export async function GET(request: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SYNC_SECRET not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const provided =
    request.headers.get("x-sync-secret") ?? searchParams.get("secret");

  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSync(createAdminClient());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
