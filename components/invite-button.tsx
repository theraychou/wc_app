"use client";

import { useState } from "react";

export function InviteButton({
  code,
  groupName,
}: {
  code: string;
  groupName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is shown for manual copy */
    }
  }

  async function share() {
    const text = `Join my World Cup 2026 prediction group "${groupName}" with code ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my group", text });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-900"
      >
        Invite
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-950 p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-neutral-400">
              Share this code to invite friends to
            </p>
            <p className="mb-3 text-sm font-semibold text-neutral-100">
              {groupName}
            </p>

            <div className="mb-4 rounded-xl bg-yellow-300 py-3 text-3xl font-bold tracking-[0.3em] text-black">
              {code}
            </div>

            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900"
              >
                {copied ? "Copied ✓" : "Copy code"}
              </button>
              <button
                onClick={share}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Share
              </button>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-3 text-xs text-neutral-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
