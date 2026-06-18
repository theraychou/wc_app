// Prediction locking. The DB trigger `enforce_prediction_lock` is the real gate
// (locks at kickoff − 5 minutes); these helpers mirror it for UI display only.

export const LOCK_LEAD_MS = 5 * 60 * 1000;

export function lockAtMs(kickoffIso: string): number {
  return new Date(kickoffIso).getTime() - LOCK_LEAD_MS;
}

/** True once predictions are locked (within 5 min of, or past, kickoff). */
export function isLocked(kickoffIso: string, now: number = Date.now()): boolean {
  return now >= lockAtMs(kickoffIso);
}

/** True once the match has actually kicked off (privacy reveal point). */
export function isKickedOff(
  kickoffIso: string,
  now: number = Date.now(),
): boolean {
  return now >= new Date(kickoffIso).getTime();
}
