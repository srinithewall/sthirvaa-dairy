// Heat (oestrus) cycle tracking, read from an animal's herd events.
//
// A heat is any of: a HEAT_OBSERVED event (entered on the Heat Cycles screen), an insemination
// (AI is only done when she is in heat), or a PD-negative recorded as "Returned to heat".
// Cows and buffaloes cycle every ~21 days (normal range 18-24). Her own cycle length is the
// median of her heat-to-heat gaps that fall in 15-30 days; longer gaps are missed heats.

export const HEAT_EVENT = 'HEAT_OBSERVED';
export const DEFAULT_CYCLE_DAYS = 21;
/** Heat window either side of the expected date. */
export const HEAT_WINDOW_DAYS = 2;
/** First heat after calving is watched for from here (uterus recovery). */
export const POST_CALVING_FIRST_HEAT_DAYS = 45;
/** No heat this long after calving: anoestrus, call the vet. */
export const POST_CALVING_ANOESTRUS_DAYS = 90;
const AI_TYPES = ['SEMEN_GIVEN', 'AI_DONE'];
const CALVING_TYPES = ['CALF_DELIVERED', 'CALVING'];

export const HEAT_SIGNS = [
  'Standing to be mounted', 'Mounting others', 'Clear mucus discharge', 'Bellowing',
  'Restless', 'Swollen vulva', 'Milk drop', 'Off feed',
];

export interface HeatEventLike {
  id: number; herdId: number; eventDate: string; eventType: string; title?: string; details?: string | null;
}

export type HeatSource = 'OBSERVED' | 'AI' | 'RETURNED';
export interface HeatEntry {
  date: string; source: HeatSource; event: HeatEventLike;
  /** Days since the previous heat, if any. */
  gap: number | null;
}

export type HeatStatus =
  | 'IN_HEAT'      // expected window is now
  | 'DUE_SOON'     // within the next week
  | 'UPCOMING'
  | 'MISSED'       // expected heat(s) passed with nothing recorded
  | 'INSEMINATED'  // AI done, watching for a return heat
  | 'PD_DUE'       // AI done, no return: probably pregnant, confirm by PD
  | 'PREGNANT'     // PD positive
  | 'POST_CALVING' // resting after calving, first heat not yet due
  | 'NO_HEAT'      // long after calving / no heat seen, anoestrus
  | 'NO_RECORD';

export interface HeatSummary {
  history: HeatEntry[];          // newest first
  lastHeat: HeatEntry | null;
  cycleDays: number;             // her own, or the default
  ownCycle: boolean;             // cycleDays measured from her history
  nextExpected: string | null;
  daysToNext: number | null;     // negative: in the past
  missedCycles: number;
  status: HeatStatus;
  note: string;
  lastCalving: string | null;
}

const DAY = 86400000;
export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const addDays = (iso: string, n: number) => new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);

const sourceOf = (e: HeatEventLike): HeatSource | null => {
  const t = (e.eventType || '').toUpperCase();
  if (t === HEAT_EVENT) return 'OBSERVED';
  if (AI_TYPES.includes(t)) return 'AI';
  if (t === 'PREGNANCY_NEGATIVE' && /heat/i.test(e.title || '')) return 'RETURNED';
  return null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** One animal's heat history and where she is in her cycle on {@code today}. */
export function summariseHeat(events: HeatEventLike[], today = isoToday()): HeatSummary {
  const past = events.filter(e => e.eventDate && e.eventDate <= today);

  // One heat per day: an observed heat and the AI done on it are the same heat; keep the AI.
  const byDate = new Map<string, { source: HeatSource; event: HeatEventLike }>();
  for (const e of past) {
    const s = sourceOf(e);
    if (!s) continue;
    const prev = byDate.get(e.eventDate);
    if (!prev || (s === 'AI' && prev.source !== 'AI')) byDate.set(e.eventDate, { source: s, event: e });
  }
  const asc = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const history: HeatEntry[] = asc.map(([date, v], i) => ({
    date, source: v.source, event: v.event, gap: i ? daysBetween(asc[i - 1][0], date) : null,
  })).reverse();

  const cycleGaps = history.map(h => h.gap).filter((g): g is number => g != null && g >= 15 && g <= 30);
  const ownCycle = cycleGaps.length > 0;
  const cycleDays = ownCycle ? Math.round(median(cycleGaps)) : DEFAULT_CYCLE_DAYS;

  const latest = (types: string[], pred: (e: HeatEventLike) => boolean = () => true) =>
    past.filter(e => types.includes((e.eventType || '').toUpperCase()) && pred(e))
      .reduce<string | null>((m, e) => (m == null || e.eventDate > m ? e.eventDate : m), null);
  const lastCalving = latest(CALVING_TYPES);
  const lastPdPos = latest(['PREGNANCY_CONFIRMED']);

  // Heats before the latest calving belong to the last lactation.
  const current = history.filter(h => !lastCalving || h.date > lastCalving);
  const lastHeat = current[0] ?? (lastCalving ? null : history[0] ?? null);

  const base = { history, lastHeat, cycleDays, ownCycle, lastCalving, missedCycles: 0 };

  // Pregnant: PD positive after her last heat (and after calving).
  if (lastPdPos && (!lastCalving || lastPdPos > lastCalving) && (!lastHeat || lastPdPos >= lastHeat.date)) {
    return { ...base, nextExpected: null, daysToNext: null, status: 'PREGNANT', note: `PD positive on ${fmtDate(lastPdPos)}` };
  }

  if (!lastHeat) {
    if (lastCalving) {
      const since = daysBetween(lastCalving, today);
      const firstDue = addDays(lastCalving, POST_CALVING_FIRST_HEAT_DAYS);
      if (since < POST_CALVING_FIRST_HEAT_DAYS) {
        return { ...base, nextExpected: firstDue, daysToNext: daysBetween(today, firstDue), status: 'POST_CALVING',
          note: `Calved ${since} days ago · watch for first heat from ${fmtDate(firstDue)}` };
      }
      if (since >= POST_CALVING_ANOESTRUS_DAYS) {
        return { ...base, nextExpected: null, daysToNext: null, status: 'NO_HEAT',
          note: `No heat recorded in ${since} days since calving · get her checked` };
      }
      return { ...base, nextExpected: today, daysToNext: 0, status: 'IN_HEAT',
        note: `Calved ${since} days ago · first heat due, watch closely` };
    }
    return { ...base, nextExpected: null, daysToNext: null, status: 'NO_RECORD', note: 'No heat recorded yet' };
  }

  const since = daysBetween(lastHeat.date, today);

  // Inseminated: a return heat around one cycle later means the AI failed.
  if (lastHeat.source === 'AI') {
    const ret = addDays(lastHeat.date, cycleDays);
    if (since <= cycleDays + HEAT_WINDOW_DAYS + 1) {
      const d = daysBetween(today, ret);
      const inWindow = Math.abs(d) <= HEAT_WINDOW_DAYS;
      return { ...base, nextExpected: ret, daysToNext: d, status: inWindow ? 'IN_HEAT' : 'INSEMINATED',
        note: inWindow ? 'Return-heat window after AI · if she shows heat, AI failed'
                       : `AI ${since} days ago · watch for return heat around ${fmtDate(ret)}` };
    }
    const pd = addDays(lastHeat.date, 60);
    return { ...base, nextExpected: null, daysToNext: null, status: 'PD_DUE',
      note: `No return heat since AI ${since} days ago · likely pregnant, PD ${daysBetween(today, pd) > 0 ? `due ${fmtDate(pd)}` : 'overdue'}` };
  }

  // Open: roll the expected date forward past heats that went unrecorded.
  let next = addDays(lastHeat.date, cycleDays), missed = 0;
  while (daysBetween(next, today) > HEAT_WINDOW_DAYS) { next = addDays(next, cycleDays); missed++; }
  const d = daysBetween(today, next);
  const status: HeatStatus = Math.abs(d) <= HEAT_WINDOW_DAYS ? 'IN_HEAT' : missed > 0 ? 'MISSED' : d <= 7 ? 'DUE_SOON' : 'UPCOMING';
  const note = missed > 0
    ? `${missed} expected heat${missed > 1 ? 's' : ''} not recorded since ${fmtDate(lastHeat.date)}`
    : status === 'IN_HEAT' ? 'In her heat window now · watch and inseminate'
    : `Day ${since} of her ${cycleDays}-day cycle`;
  return { ...base, nextExpected: next, daysToNext: d, missedCycles: missed, status, note };
}

export const fmtDate = (iso: string) =>
  new Date(toUtc(iso)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Stored details text for a heat entry: "Signs: a, b. notes". */
export const heatDetails = (signs: string[], notes: string) => {
  const n = notes.trim();
  return signs.length ? `Signs: ${signs.join(', ')}.${n ? ' ' + n : ''}` : n;
};
