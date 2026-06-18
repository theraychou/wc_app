"use client";

import { usePathname } from "next/navigation";

const HIDE_ON = ["/login", "/onboarding", "/auth"];

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/matches", label: "Matches", icon: "⚽" },
  { href: "/bracket", label: "Bracket", icon: "🗂️" },
  { href: "/leaderboard", label: "Ranks", icon: "🏅" },
  { href: "/champion", label: "Champion", icon: "🏆" },
];

export function BottomNav() {
  const path = usePathname() ?? "/";
  if (HIDE_ON.some((h) => path === h || path.startsWith(`${h}/`))) return null;

  return (
    <>
      {/* spacer so fixed bar doesn't cover page content */}
      <div className="h-20" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <a
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                  active ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
