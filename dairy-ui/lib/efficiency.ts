// Types and herd totals for the Efficiency screen (GET /reports/efficiency, see EfficiencyService).

export type ReproState = 'NO_CALVING' | 'WAITING' | 'INSEMINATED' | 'CONFIRMED' | 'OPEN';

export interface Reproduction {
  state: ReproState;
  inseminations: number;
  aiDate: string | null;
  pdDate: string | null;
  daysLeft?: number;
  daysOpen?: number | null;
  calvingInterval?: number | null;
  efficiency?: number;
  milkLostPerYear?: number;
  calvesMissedPerYear?: number;
  /** Set when a negative PD made her open again; the next AI is one heat cycle later. */
  notPregnantOn?: string;
  nextAiDue?: string;
  /** Still in the rest after calving: inseminate by this date to keep one calf a year. */
  breedBy?: string;
  monthsToNextCalf?: number;
  expectedCalving?: string;
  dryOffDate?: string;
  dryOffInDays?: number;
  drySince?: string;
  dryPeriodDays?: number;
}

export interface MilkTarget { avgPerDay: number; targetPerDay: number; efficiency: number; lostPerDay: number }

export interface Lactation {
  from: string;
  ended: boolean;
  recordedDays: number;
  recordedLitres: number;
  firstRecord: string | null;
  partlyRecorded: boolean;
  projected: number;
  recordedTarget?: number;
  achieved?: number | null;
  estimate?: number;
  projectedPct?: number;
}

export interface LactationHistory { number: number; from: string; to: string | null; recordedDays: number; litres: number }

export interface EffCow {
  id: number;
  name: string;
  tagNumber: string;
  breed: string | null;
  animalStatus: string;
  imageUrl: string | null;
  lastCalving: string | null;
  dim: number | null;
  reproduction: Reproduction;
  milkTarget: MilkTarget | null;
  lactation: Lactation | null;
  /** Milk a day over whole calving cycles, dry days included (current cycle projected). */
  cycleAverage: { perDay: number; completedCycles: number } | null;
  history: LactationHistory[];
  flags: string[];
}

export interface EffReport {
  asOf: string;
  milkRate: number;
  milkRateSource: 'AMCS' | 'DEFAULT';
  rules: { targetDaysOpen: number; gestationDays: number; calvingInterval: number; lactationDays: number };
  milkPerDay: { last7Avg: number | null; days: number; latestDate: string | null; latestTotal: number | null };
  cows: EffCow[];
}

export const rupees = (n: number) => `${n < 0 ? '-' : ''}₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
export const litres = (n: number, digits = 0) =>
  `${n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} L`;
export const shortDate = (iso: string | null | undefined, withYear = false) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }) : '—';

export type Tone = 'good' | 'fair' | 'poor';
/**
 * 90% and up is on track, 75-90% needs watching, below 75% is a problem. Judged on the whole
 * percentage shown, so 74.5% (shown as 75%) is amber. Colours: components/efficiency/ui.tsx.
 */
export const toneOf = (pct: number): Tone => {
  const p = Math.round(pct);
  return p >= 90 ? 'good' : p >= 75 ? 'fair' : 'poor';
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Herd figures shown in the cards above each tab. */
export function summarise(r: EffReport) {
  const scored = r.cows.filter(c => c.reproduction.calvingInterval != null);
  const avgInterval = mean(scored.map(c => c.reproduction.calvingInterval!));
  const reproLost = sum(scored.map(c => c.reproduction.milkLostPerYear ?? 0));

  const milking = r.cows.filter(c => c.milkTarget);
  const milkAvg = sum(milking.map(c => c.milkTarget!.avgPerDay));
  const milkTarget = sum(milking.map(c => c.milkTarget!.targetPerDay));
  const milkLost = sum(milking.map(c => c.milkTarget!.lostPerDay));

  // Every cow in the milking herd, dry ones too: that is what "over a full cycle" means.
  const cycleCows = r.cows.filter(c => c.cycleAverage);
  const cyclePerDay = sum(cycleCows.map(c => c.cycleAverage!.perDay));

  const lact = r.cows.filter(c => c.lactation?.estimate);
  const estimate = sum(lact.map(c => c.lactation!.estimate!));
  const projected = sum(lact.map(c => c.lactation!.projected));

  return {
    repro: {
      cows: scored.length,
      avgInterval,
      efficiency: avgInterval ? Math.min(100, (100 * r.rules.calvingInterval) / avgInterval) : null,
      avgDaysOpen: mean(scored.map(c => c.reproduction.daysOpen ?? 0)),
      milkLost: reproLost,
      milkLostPerCow: scored.length ? reproLost / scored.length : 0,
      calvesMissed: sum(scored.map(c => c.reproduction.calvesMissedPerYear ?? 0)),
    },
    milk: {
      cows: milking.length,
      avg: milkAvg,
      target: milkTarget,
      efficiency: milkTarget ? (100 * milkAvg) / milkTarget : null,
      lostPerDay: milkLost,
      lostPerCowPerDay: milking.length ? milkLost / milking.length : 0,
      cyclePerDay,
      cycleCows: cycleCows.length,
    },
    lactation: {
      cows: lact.length,
      estimate,
      projected,
      pct: estimate ? (100 * projected) / estimate : null,
      shortfall: Math.max(0, estimate - projected),
    },
  };
}
