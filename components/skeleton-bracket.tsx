import { ROUND_LABELS } from "@/lib/rounds";
import type { SkeletonData, SkeletonMatch } from "@/lib/bracket2026";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const [, mo, d] = iso.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${d}`;
}

function Card({ m }: { m: SkeletonMatch }) {
  return (
    <div className="bkt-card rounded-md border border-dashed border-neutral-700 bg-neutral-900/40 px-2 py-1.5">
      <div className="truncate text-[11px] text-neutral-300">{m.homeLabel}</div>
      <div className="my-0.5 h-px bg-neutral-800" />
      <div className="truncate text-[11px] text-neutral-300">{m.awayLabel}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wide text-neutral-600">
        {shortDate(m.date)}
      </div>
    </div>
  );
}

export function SkeletonBracket({ data }: { data: SkeletonData }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="bkt">
        {data.rounds.map((col) => (
          <div key={col.round} className="bkt-round">
            <div className="mb-1 rounded bg-yellow-300 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-black">
              {ROUND_LABELS[col.round]}
            </div>
            {col.matches.map((m) => (
              <div key={m.num} className="bkt-cell">
                <Card m={m} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 w-[150px]">
        <div className="mb-1 rounded bg-yellow-300 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-black">
          {ROUND_LABELS.THIRD}
        </div>
        <Card m={data.third} />
      </div>

      <div className="mt-5 max-w-md space-y-1 text-[11px] text-neutral-500">
        <p className="font-medium text-neutral-400">How to read this</p>
        <p>
          <strong className="text-neutral-300">Winner E / Runner-up A</strong> —
          the team that finishes 1st / 2nd in that group.
        </p>
        <p>
          <strong className="text-neutral-300">3rd ABCDF</strong> — one of the
          eight best third-placed teams (from one of those groups); decided once
          the group stage ends.
        </p>
        <p>
          <strong className="text-neutral-300">Winner M74</strong> — the winner
          of match 74. Real team names appear here once the Round of 32 is set.
        </p>
      </div>
    </div>
  );
}
