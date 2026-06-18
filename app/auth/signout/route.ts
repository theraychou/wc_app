import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the user out (clears the session cookie) and returns them to /login.
 * POST-only so it can't be triggered by link prefetching.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
