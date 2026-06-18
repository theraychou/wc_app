/**
 * Football data adapter — API-Football (https://v3.football.api-sports.io).
 *
 * This is the ONLY module that knows the provider's wire format. The rest of
 * the app consumes the normalized `KnockoutFixture` / `NormalizedTeam` shapes,
 * so the provider can be swapped (e.g. football-data.org) without touching
 * sync, scoring, or the UI.
 *
 * Field mapping verified against live 2022 World Cup data:
 *   - score.fulltime  = the 90-MINUTE (regulation) score   -> *_score_ft
 *   - goals           = aggregate incl. extra time (NOT used for exact score)
 *   - teams.{home,away}.winner = which side advanced
 *   - status.short == 'PEN' => decided on penalties
 */

import type { MatchRound } from "@/lib/types";

const API_BASE = "https://v3.football.api-sports.io";

function leagueId(): string {
  return process.env.WC_LEAGUE_ID ?? "1";
}
function season(): string {
  return process.env.WC_SEASON ?? "2026";
}

// --- Provider wire types (only the fields we read) ----------------------------

interface ApiTeam {
  id: number | null;
  name: string | null;
  logo: string | null;
  winner: boolean | null;
}

interface ApiScoreLine {
  home: number | null;
  away: number | null;
}

interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO 8601, UTC
    status: { short: string };
  };
  league: { round: string };
  teams: { home: ApiTeam; away: ApiTeam };
  score: {
    fulltime: ApiScoreLine; // 90-minute score
    extratime: ApiScoreLine;
    penalty: ApiScoreLine;
  };
}

interface ApiResponse {
  errors: unknown;
  results: number;
  response: ApiFixture[];
}

// --- Normalized shapes the rest of the app uses -------------------------------

export interface NormalizedTeam {
  id: string; // API team id as text
  name: string;
  flag_url: string | null;
}

export interface KnockoutFixture {
  api_fixture_id: number;
  round: MatchRound;
  kickoff_at: string; // ISO UTC
  home_team_id: string | null; // null while TBD
  away_team_id: string | null;
  status: "scheduled" | "live" | "finished";
  home_score_ft: number | null; // 90-minute score, null until finished
  away_score_ft: number | null;
  winner_team_id: string | null; // advancer, null until finished
  went_to_penalties: boolean;
}

export interface FixturesResult {
  teams: NormalizedTeam[];
  fixtures: KnockoutFixture[];
}

// --- Mapping tables -----------------------------------------------------------

// Exact API-Football round labels -> our internal codes. "Round of 32" only
// appears in the 48-team (2026+) format; the rest are stable across editions.
const ROUND_MAP: Record<string, MatchRound> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-finals": "QF",
  "Semi-finals": "SF",
  "3rd Place Final": "THIRD",
  "Final": "FINAL",
};

const FINISHED = new Set(["FT", "AET", "PEN"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

function mapStatus(short: string): KnockoutFixture["status"] {
  if (FINISHED.has(short)) return "finished";
  if (LIVE.has(short)) return "live";
  return "scheduled";
}

function teamId(t: ApiTeam): string | null {
  return t?.id != null ? String(t.id) : null;
}

// --- Public API ---------------------------------------------------------------

async function getFixtures(): Promise<ApiFixture[]> {
  const key = process.env.APISPORTS_KEY;
  if (!key) throw new Error("APISPORTS_KEY is not set");

  const url = `${API_BASE}/fixtures?league=${leagueId()}&season=${season()}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}`);
  }

  const data = (await res.json()) as ApiResponse;

  // API-Football returns 200 with an `errors` object/array on plan/quota issues.
  const hasErrors = Array.isArray(data.errors)
    ? data.errors.length > 0
    : data.errors && Object.keys(data.errors).length > 0;
  if (hasErrors) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }

  return data.response ?? [];
}

/**
 * Fetch all knockout fixtures for the configured league/season and normalize
 * them, along with the set of teams referenced. Group-stage rounds are dropped.
 * Defensive against TBD teams and missing score fields.
 */
export async function fetchKnockoutFixtures(): Promise<FixturesResult> {
  const raw = await getFixtures();

  const teams = new Map<string, NormalizedTeam>();
  const fixtures: KnockoutFixture[] = [];

  for (const f of raw) {
    const round = ROUND_MAP[f.league?.round?.trim()];
    if (!round) continue; // not a knockout round we track

    const status = mapStatus(f.fixture?.status?.short ?? "NS");
    const finished = status === "finished";

    const home = f.teams?.home;
    const away = f.teams?.away;
    const homeId = home ? teamId(home) : null;
    const awayId = away ? teamId(away) : null;

    for (const t of [home, away]) {
      const id = t ? teamId(t) : null;
      if (id && t?.name && !teams.has(id)) {
        teams.set(id, { id, name: t.name, flag_url: t.logo ?? null });
      }
    }

    let winnerId: string | null = null;
    if (home?.winner) winnerId = homeId;
    else if (away?.winner) winnerId = awayId;

    fixtures.push({
      api_fixture_id: f.fixture.id,
      round,
      kickoff_at: f.fixture.date,
      home_team_id: homeId,
      away_team_id: awayId,
      status,
      home_score_ft: finished ? (f.score?.fulltime?.home ?? null) : null,
      away_score_ft: finished ? (f.score?.fulltime?.away ?? null) : null,
      winner_team_id: finished ? winnerId : null,
      went_to_penalties: (f.fixture?.status?.short ?? "") === "PEN",
    });
  }

  return { teams: [...teams.values()], fixtures };
}
