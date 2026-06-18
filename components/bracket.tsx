import { ROUND_LABELS } from "@/lib/rounds";
import type { BracketData, BracketMatch } from "@/lib/bracket";

function Side({
  name,
  score,
  isWinner,
  show,
}: {
  name: string;
  score: number | null;
  isWinner: boolean;
  show: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span
        className={`truncate text-[11px] ${
          isWinner ? "font-semibold text-emerald-300" : "text-neutral-300"
        }`}
      >
        {name}
      </span>
      {show && (
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            isWinner ? "font-semibold text-emerald-300" : "text-neutral-400"
          }`}
        >
          {score ?? "–"}
        </span>
      )}
    </div>
  );
}

function Card({ m }: { m: BracketMatch }) {
  const showScores = m.finished;
  return (
    <a
      href={`/match/${m.id}`}
      className="bkt-card block rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 hover:border-neutral-600"
    >
      <Side
        name={m.homeName}
        score={m.homeScore}
        isWinner={!!m.winnerId && m.winnerId === m.homeId}
        show={showScores}
      />
      <div className="my-0.5 h-px bg-neutral-800" />
      <Side
        name={m.awayName}
        score={m.awayScore}
        isWinner={!!m.winnerId && m.winnerId === m.awayId}
        show={showScores}
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-neutral-600">
          {m.wentToPens ? "pens" : ""}
        </span>
        {m.myPoints != null && (
          <span className="rounded-sm bg-[#0a1f44] px-1 text-[9px] font-semibold text-yellow-300">
            +{m.myPoints}
          </span>
        )}
      </div>
    </a>
  );
}

export function Bracket({ data }: { data: BracketData }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="bkt">
        {data.rounds.map((col) => (
          <div key={col.round} className="bkt-round">
            <div className="mb-1 rounded bg-yellow-300 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-black">
              {ROUND_LABELS[col.round]}
            </div>
            {col.matches.map((m) => (
              <div key={m.id} className="bkt-cell">
                <Card m={m} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {data.third && (
        <div className="mt-4 w-[150px]">
          <div className="mb-1 rounded bg-yellow-300 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-black">
            {ROUND_LABELS.THIRD}
          </div>
          <Card m={data.third} />
        </div>
      )}
    </div>
  );
}
