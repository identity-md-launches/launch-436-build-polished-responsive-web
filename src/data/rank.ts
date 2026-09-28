export interface RankInput {
  tokenId: string;
  attempts: number;
  accepted: number;
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
  const byAccepted = 1 + seats.filter((s) => s.accepted > me.accepted).length;
  const byAttempts = 1 + seats.filter((s) => s.attempts > me.attempts).length;
  const cohort = seats.filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_RATE);
  const rate = (s: RankInput) => (s.attempts > 0 ? s.accepted / s.attempts : 0);
  const inCohort = me.attempts >= MIN_ATTEMPTS_FOR_RATE;
  const byAcceptanceRate = inCohort ? 1 + cohort.filter((s) => rate(s) > rate(me)).length : null;
  const percentile = total > 1 ? Math.round((seats.filter((s) => s.accepted < me.accepted).length / (total - 1)) * 100) : null;
  return { total, byAccepted, byAttempts, byAcceptanceRate, rateCohort: cohort.length, percentile };
}
