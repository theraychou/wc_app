import type { MatchRound } from "./types";

// ---------------------------------------------------------------------------
// Hard-coded FIFA World Cup 2026 knockout bracket (official match numbers,
// dates, and group-position slots). Source: 2026 FIFA World Cup knockout stage.
// Slots: "1A" = winner Group A, "2B" = runner-up Group B,
//        "3:A/B/C/D/F" = a third-placed team from one of those groups,
//        "W74" = winner of match 74, "L101" = loser of match 101.
// ---------------------------------------------------------------------------

interface TplMatch {
  num: number;
  round: MatchRound;
  date: string; // YYYY-MM-DD (UTC date only)
  home: string;
  away: string;
}

const TEMPLATE: TplMatch[] = [
  // Round of 32
  { num: 73, round: "R32", date: "2026-06-28", home: "2A", away: "2B" },
  { num: 74, round: "R32", date: "2026-06-29", home: "1E", away: "3:A/B/C/D/F" },
  { num: 75, round: "R32", date: "2026-06-29", home: "1F", away: "2C" },
  { num: 76, round: "R32", date: "2026-06-29", home: "1C", away: "2F" },
  { num: 77, round: "R32", date: "2026-06-30", home: "1I", away: "3:C/D/F/G/H" },
  { num: 78, round: "R32", date: "2026-06-30", home: "2E", away: "2I" },
  { num: 79, round: "R32", date: "2026-06-30", home: "1A", away: "3:C/E/F/H/I" },
  { num: 80, round: "R32", date: "2026-07-01", home: "1L", away: "3:E/H/I/J/K" },
  { num: 81, round: "R32", date: "2026-07-01", home: "1D", away: "3:B/E/F/I/J" },
  { num: 82, round: "R32", date: "2026-07-01", home: "1G", away: "3:A/E/H/I/J" },
  { num: 83, round: "R32", date: "2026-07-02", home: "2K", away: "2L" },
  { num: 84, round: "R32", date: "2026-07-02", home: "1H", away: "2J" },
  { num: 85, round: "R32", date: "2026-07-02", home: "1B", away: "3:E/F/G/I/J" },
  { num: 86, round: "R32", date: "2026-07-03", home: "1J", away: "2H" },
  { num: 87, round: "R32", date: "2026-07-03", home: "1K", away: "3:D/E/I/J/L" },
  { num: 88, round: "R32", date: "2026-07-03", home: "2D", away: "2G" },
  // Round of 16
  { num: 89, round: "R16", date: "2026-07-04", home: "W74", away: "W77" },
  { num: 90, round: "R16", date: "2026-07-04", home: "W73", away: "W75" },
  { num: 91, round: "R16", date: "2026-07-05", home: "W76", away: "W78" },
  { num: 92, round: "R16", date: "2026-07-05", home: "W79", away: "W80" },
  { num: 93, round: "R16", date: "2026-07-06", home: "W83", away: "W84" },
  { num: 94, round: "R16", date: "2026-07-06", home: "W81", away: "W82" },
  { num: 95, round: "R16", date: "2026-07-07", home: "W86", away: "W88" },
  { num: 96, round: "R16", date: "2026-07-07", home: "W85", away: "W87" },
  // Quarter-finals
  { num: 97, round: "QF", date: "2026-07-09", home: "W89", away: "W90" },
  { num: 98, round: "QF", date: "2026-07-10", home: "W93", away: "W94" },
  { num: 99, round: "QF", date: "2026-07-11", home: "W91", away: "W92" },
  { num: 100, round: "QF", date: "2026-07-11", home: "W95", away: "W96" },
  // Semi-finals
  { num: 101, round: "SF", date: "2026-07-14", home: "W97", away: "W98" },
  { num: 102, round: "SF", date: "2026-07-15", home: "W99", away: "W100" },
  // Third place + Final
  { num: 103, round: "THIRD", date: "2026-07-18", home: "L101", away: "L102" },
  { num: 104, round: "FINAL", date: "2026-07-19", home: "W101", away: "W102" },
];

export interface SkeletonMatch {
  num: number;
  round: MatchRound;
  date: string;
  homeLabel: string;
  awayLabel: string;
}

export interface SkeletonData {
  rounds: { round: MatchRound; matches: SkeletonMatch[] }[];
  third: SkeletonMatch;
}

function feedNum(slot: string): number | null {
  const m = /^W(\d+)$/.exec(slot);
  return m ? Number(m[1]) : null;
}

function label(slot: string): string {
  let m;
  if ((m = /^W(\d+)$/.exec(slot))) return `Winner M${m[1]}`;
  if ((m = /^L(\d+)$/.exec(slot))) return `Loser M${m[1]}`;
  if (slot.startsWith("3:")) return `3rd ${slot.slice(2).replace(/\//g, "")}`;
  return (slot[0] === "1" ? "Winner " : "Runner-up ") + slot.slice(1);
}

/** Build the bracket skeleton, ordering each round so children align under the
 *  parent they feed (walked from the Final via the W## references). */
export function buildSkeleton(): SkeletonData {
  const byNum = new Map(TEMPLATE.map((t) => [t.num, t]));
  const order = new Map<MatchRound, TplMatch[]>();
  order.set("FINAL", [byNum.get(104)!]);

  const seq: [MatchRound, MatchRound][] = [
    ["FINAL", "SF"],
    ["SF", "QF"],
    ["QF", "R16"],
    ["R16", "R32"],
  ];
  for (const [parent, child] of seq) {
    const arr: TplMatch[] = [];
    for (const p of order.get(parent)!) {
      for (const slot of [p.home, p.away]) {
        const n = feedNum(slot);
        if (n != null) arr.push(byNum.get(n)!);
      }
    }
    order.set(child, arr);
  }

  const toMatch = (t: TplMatch): SkeletonMatch => ({
    num: t.num,
    round: t.round,
    date: t.date,
    homeLabel: label(t.home),
    awayLabel: label(t.away),
  });

  const rounds = (["R32", "R16", "QF", "SF", "FINAL"] as MatchRound[]).map(
    (r) => ({ round: r, matches: (order.get(r) ?? []).map(toMatch) }),
  );

  return { rounds, third: toMatch(byNum.get(103)!) };
}
