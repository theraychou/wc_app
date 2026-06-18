import type { MatchRound } from "./types";

export const ROUND_ORDER: MatchRound[] = [
  "R32",
  "R16",
  "QF",
  "SF",
  "THIRD",
  "FINAL",
];

export const ROUND_LABELS: Record<MatchRound, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  THIRD: "Third-place",
  FINAL: "Final",
};

// Higher points from the semi-finals onward (see BUILD.md scoring rules).
const HIGH_VALUE: ReadonlySet<MatchRound> = new Set<MatchRound>([
  "SF",
  "THIRD",
  "FINAL",
]);

export function exactPoints(round: MatchRound): number {
  return HIGH_VALUE.has(round) ? 10 : 5;
}

export function winnerPoints(round: MatchRound): number {
  return HIGH_VALUE.has(round) ? 5 : 2;
}
