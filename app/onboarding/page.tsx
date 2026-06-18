"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "join" | "create";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<Mode>("join");
  const [code, setCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "saving">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(profile?.display_name || user.email?.split("@")[0] || "");
      setStatus("ready");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return setErrorMsg("Please enter your name.");
    if (mode === "join" && !code.trim())
      return setErrorMsg("Enter your group's invite code.");
    if (mode === "create" && !groupName.trim())
      return setErrorMsg("Enter a name for your new group.");

    setStatus("saving");
    setErrorMsg("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");

    // 1) name + onboarded
    const upd = await supabase
      .from("profiles")
      .update({ display_name: name, onboarded: true })
      .eq("id", user.id);
    if (upd.error) {
      setStatus("ready");
      return setErrorMsg(upd.error.message);
    }

    // 2) join or create the group
    const { error } =
      mode === "join"
        ? await supabase.rpc("join_group", { p_code: code.trim() })
        : await supabase.rpc("create_group", { p_name: groupName.trim() });
    if (error) {
      setStatus("ready");
      return setErrorMsg(error.message);
    }

    window.location.assign("/");
  }

  const input =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-neutral-100 outline-none focus:border-neutral-400 disabled:opacity-60";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
        <p className="text-sm text-neutral-400">
          Pick a name and join your group. You only compete with people in your
          group.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-400">
            Display name
          </label>
          <input
            type="text"
            required
            maxLength={40}
            disabled={status === "loading"}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className={input}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["join", "create"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErrorMsg("");
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === m
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                  : "border-neutral-700 text-neutral-300"
              }`}
            >
              {m === "join" ? "Join a group" : "Create a group"}
            </button>
          ))}
        </div>

        {mode === "join" ? (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-400">
              Invite code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7K2A9F"
              className={`${input} uppercase tracking-widest`}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-400">
              New group name
            </label>
            <input
              type="text"
              maxLength={40}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. The Office Pool"
              className={input}
            />
            <p className="text-xs text-neutral-500">
              You&apos;ll get a code to share with friends.
            </p>
          </div>
        )}

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
