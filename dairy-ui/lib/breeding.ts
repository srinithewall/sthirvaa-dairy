// Bull ID is kept inside an AI event's details text as a leading "Bull ID: X." —
// there is no separate column for it.

const BULL_RE = /bull\s*(?:id|tag|no)?\s*[:#-]\s*([A-Za-z0-9][A-Za-z0-9-]*)\.?\s*/i;

export const bullIdOf = (details?: string | null): string | null =>
  details?.match(BULL_RE)?.[1] ?? null;

/** Details text with the Bull ID part removed (the free-text notes). */
export const notesOf = (details?: string | null): string =>
  (details ?? '').replace(BULL_RE, '').trim();

/** Combine a Bull ID and notes back into the stored details text. */
export const withBullId = (bullId: string, notes: string): string => {
  const b = bullId.trim(), n = notes.trim();
  return b ? `Bull ID: ${b}.${n ? ' ' + n : ''}` : n;
};

/** Days after AI that the pregnancy diagnosis (PD) check falls due. */
export const PD_AFTER_AI_DAYS = 60;
