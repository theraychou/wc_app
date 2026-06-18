"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${redirectBase}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="space-y-3">
        <div className="text-5xl" aria-hidden>
          ⚽️
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          World Cup 2026. Here We GO
        </h1>
        <p className="text-sm text-neutral-400">One Cup. One Game. One Winner</p>
      </div>

      {!configured ? (
        <div className="w-full rounded-lg border border-amber-700/50 bg-amber-950/30 p-4 text-left text-sm text-amber-200">
          <p className="font-medium">Supabase isn&apos;t configured yet.</p>
          <p className="mt-1 text-amber-200/80">
            Copy <code>.env.example</code> to <code>.env.local</code>, fill in
            your Supabase URL and anon key, then restart the dev server to enable
            sign-in.
          </p>
        </div>
      ) : status === "sent" ? (
        <div className="w-full rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          <p className="font-medium">Check your email ✉️</p>
          <p className="mt-1 text-emerald-200/80">
            We sent a magic link to <strong>{email}</strong>. Open it on this
            device to sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
          <label htmlFor="email" className="block text-sm text-neutral-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}
          <p className="pt-1 text-xs text-neutral-500">
            No password. We&apos;ll email you a one-tap sign-in link.
          </p>
        </form>
      )}

      <a
        href="/instructions"
        className="text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
      >
        How it works &amp; scoring →
      </a>
    </main>
  );
}
