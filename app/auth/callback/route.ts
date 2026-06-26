import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * GET: the normal in-app magic link (PKCE `code`) → exchangeCodeForSession.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

/**
 * POST: admin-generated token_hash links, verified only on an explicit button
 * click from /auth/confirm. Using POST means link-preview crawlers (WhatsApp,
 * email scanners) that GET the URL can't consume the one-time token.
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  const next = String(form.get("next") ?? "/");

  if (tokenHash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`, { status: 303 });
    }
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`, {
    status: 303,
  });
}
