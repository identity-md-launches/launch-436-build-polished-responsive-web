export interface RankInput {
  tokenId: string;
  attempts: number | null;
  accepted: number | null;
}

export interface Rank {
  total: number; // seats with records
  byAccepted: number | null;
  byAttempts: number | null;
  byAcceptanceRate: number | null; // among seats with at least MIN_ATTEMPTS_FOR_RATE attempts
  rateCohort: number;
  percentile: number | null; // 0..100, share of seats with fewer accepted jobs
}

export const MIN_ATTEMPTS_FOR_RATE = 20;

export function computeRank(seats: RankInput[], tokenId: string): Rank | null {
  const me = seats.find((s) => s.tokenId === tokenId);
  if (!me) return null;
  const total = seats.length;
  const acceptedComplete = seats.every((s) => s.accepted !== null && Number.isFinite(s.accepted));
  const attemptsComplete = seats.every((s) => s.attempts !== null && Number.isFinite(s.attempts));
  const byAccepted = acceptedComplete && me.accepted !== null
    ? 1 + seats.filter((s) => s.accepted! > me.accepted!).length : null;
  const byAttempts = attemptsComplete && me.attempts !== null
    ? 1 + seats.filter((s) => s.attempts! > me.attempts!).length : null;
  const cohort = seats.filter((s) => s.attempts !== null && s.attempts >= MIN_ATTEMPTS_FOR_RATE && s.accepted !== null);
  const inCohort = me.attempts !== null && me.attempts >= MIN_ATTEMPTS_FOR_RATE && me.accepted !== null;
  const rate = (s: RankInput) => s.accepted! / s.attempts!;
  const byAcceptanceRate = acceptedComplete && attemptsComplete && inCohort
    ? 1 + cohort.filter((s) => rate(s) > rate(me)).length : null;
  const percentile = acceptedComplete && me.accepted !== null && total > 1
    ? Math.round((seats.filter((s) => s.accepted! < me.accepted!).length / (total - 1)) * 100) : null;
  return { total, byAccepted, byAttempts, byAcceptanceRate, rateCohort: cohort.length, percentile };
}
