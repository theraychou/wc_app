"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  // Prefill with the default name (email local-part) so the field isn't empty.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setDisplayName(user.email?.split("@")[0] ?? "");
      setStatus("ready");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setErrorMsg("Please enter a name.");
      return;
    }
    setStatus("saving");
    setErrorMsg("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, onboarded: true })
      .eq("id", user.id);

    if (error) {
      setStatus("ready");
      setErrorMsg(error.message);
      return;
    }

    // Full navigation so the dashboard re-reads the fresh profile server-side.
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          What should we call you?
        </h1>
        <p className="text-sm text-neutral-400">
          This name shows on the leaderboard and next to your picks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          maxLength={40}
          disabled={status === "loading"}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 outline-none focus:border-neutral-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Continue"}
        </button>
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      </form>
    </main>
  );
}
