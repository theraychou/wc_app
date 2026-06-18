import type { MatchRound } from "./types";
import type { TeamLite } from "./data/teams";

// Rounds that form the main single-elimination tree (THIRD is shown separately).
const TREE_DESC: MatchRound[] = ["FINAL", "SF", "QF", "R16", "R32"];

export interface RawMatch {
  id: string;
  round: MatchRound;
  kickoff_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: string;
  home_score_ft: number | null;
  away_score_ft: number | null;
  winner_team_id: string | null;
  went_to_penalties: boolean;
}

export interface BracketMatch {
  id: string;
  round: MatchRound;
  kickoff_at: string;
  homeName: string;
  awayName: string;
  homeId: string | null;
  awayId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  finished: boolean;
  wentToPens: boolean;
  myPoints: number | null; // viewer's points for this match (null if none/not settled)
}

export interface BracketData {
  rounds: { round: MatchRound; matches: BracketMatch[] }[];
  third: BracketMatch | null;
}

function sortKickoff(a: RawMatch, b: RawMatch): number {
  return a.kickoff_at.localeCompare(b.kickoff_at) || a.id.localeCompare(b.id);
}

/**
 * Order each round so a match sits directly left of the next-round match it
 * feeds. Derived from results: a parent match's two teams are the winners of
 * two child matches. Falls back to kickoff order for any round we can't fully
 * resolve (e.g. teams still TBD).
 */
function orderRounds(
  byRound: Map<MatchRound, RawMatch[]>,
): Map<MatchRound, RawMatch[]> {
  const desc = TREE_DESC.filter((r) => byRound.has(r));
  const ordered = new Map<MatchRound, RawMatch[]>();
  if (desc.length === 0) return ordered;

  ordered.set(desc[0], [...byRound.get(desc[0])!].sort(sortKickoff));

  for (let i = 1; i < desc.length; i++) {
    const parents = ordered.get(desc[i - 1])!;
    const children = byRound.get(desc[i])!;
    const used = new Set<string>();
    const result: RawMatch[] = [];
    let resolved = true;

    for (const p of parents) {
      for (const tid of [p.home_team_id, p.away_team_id]) {
        const f = tid
          ? children.find((c) => !used.has(c.id) && c.winner_team_id === tid)
          : undefined;
        if (f) {
          used.add(f.id);
          result.push(f);
        } else {
          resolved = false;
        }
      }
    }

    ordered.set(
      desc[i],
      resolved && used.size === children.length
        ? result
        : [...children].sort(sortKickoff),
    );
  }
  return ordered;
}

export function buildBracket(
  matches: RawMatch[],
  teamMap: Record<string, TeamLite>,
  pointsByMatch: Map<string, number | null>,
): BracketData {
  const byRound = new Map<MatchRound, RawMatch[]>();
  let third: RawMatch | null = null;
  for (const m of matches) {
    if (m.round === "THIRD") {
      third = m;
      continue;
    }
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }

  const name = (id: string | null) => (id ? (teamMap[id]?.name ?? "?") : "TBD");
  const shape = (m: RawMatch): BracketMatch => ({
    id: m.id,
    round: m.round,
    kickoff_at: m.kickoff_at,
    homeName: name(m.home_team_id),
    awayName: name(m.away_team_id),
    homeId: m.home_team_id,
    awayId: m.away_team_id,
    homeScore: m.home_score_ft,
    awayScore: m.away_score_ft,
    winnerId: m.winner_team_id,
    finished: m.status === "finished",
    wentToPens: m.went_to_penalties,
    myPoints: pointsByMatch.get(m.id) ?? null,
  });

  const ordered = orderRounds(byRound);
  const rounds = TREE_DESC.filter((r) => ordered.has(r))
    .reverse()
    .map((round) => ({ round, matches: ordered.get(round)!.map(shape) }));

  return { rounds, third: third ? shape(third) : null };
}
