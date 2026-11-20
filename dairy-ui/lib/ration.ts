// Ration plan types and helpers. Backend: /api/ration (RationController).

export type RationKind = 'CONCENTRATE' | 'FODDER' | 'MINERAL' | 'MILK' | 'OTHER';
export type RationUnit = 'KG' | 'G' | 'L';

/** One line of a batch's ration, per animal per feed. */
export interface RationItem {
  id?: number;
  storeItemId?: number | null;
  name: string;
  kind: RationKind;
  unit: RationUnit;
  morningQty: number;
  eveningQty: number;
  /** yyyy-mm-dd; empty = from the start / to the end of the plan. */
  fromDate?: string | null;
  toDate?: string | null;
  /** Adjust to each cow's own milk yield; needs the batch's refMilk. */
  scaleWithMilk?: boolean;
}

/** Which animals a batch takes automatically. Unset parts don't limit; an empty rule takes no one. */
export interface RationRule {
  statuses: string[];
  minMilk?: number | null;
  maxMilk?: number | null;
  minDim?: number | null;
  maxDim?: number | null;
  minAgeMonths?: number | null;
  maxAgeMonths?: number | null;
}

export interface RationGroup {
  id: number;
  name: string;
  color?: string;
  notes?: string;
  sortOrder?: number;
  items: RationItem[];
  /** Everyone fed in this batch today: pinned by hand or placed by the rule. */
  herdIds: number[];
  /** The ones pinned by hand. */
  pinnedHerdIds?: number[];
  rule?: RationRule;
  /** Milk per day (L) the lines are written for; scaleWithMilk lines adjust from it. */
  refMilk?: number | null;
}

/** An active cow or buffalo with the herd facts the batch rules use. From GET /ration. */
export interface RationAnimal {
  id: number;
  animalName?: string;
  tagNumber?: string;
  animalType?: string;
  animalStatus?: string;
  breed?: string;
  bcs?: number;
  milk7Days?: number | null;
  avgMilk30Days?: number | null;
  /** 7-day average, else the 30-day one: what rules and scaling use. */
  milkPerDay?: number | null;
  dim?: number | null;
  ageMonths?: number | null;
  pregnancyDays?: number | null;
  groupId?: number | null;
  pinned: boolean;
  ruleGroupId?: number | null;
  /** First day in her batch, for animals the rules placed. */
  inBatchSince?: string | null;
  /** The rules would move her, but she joined her batch under a week ago: she stays until this day. */
  heldUntil?: string | null;
}

/** Purchase-list settings for one product, edited on the purchase list. */
export interface ProductSetting {
  name: string;
  bagKg?: number;
  bagPrice?: number;
  inStock?: number;
  extraBags?: number;
}

export interface RationPlan {
  startDate?: string | null;
  days: number;
  wastagePct: number;
  /** JSON of Record<productKey, ProductSetting>. */
  products?: string | null;
}

export const KINDS: { id: RationKind; label: string; dot: string; text: string }[] = [
  { id: 'CONCENTRATE', label: 'Concentrate', dot: '#d97706', text: 'text-amber-700' },
  { id: 'FODDER',      label: 'Fodder',      dot: '#16a34a', text: 'text-green-700' },
  { id: 'MINERAL',     label: 'Mineral',     dot: '#7c3aed', text: 'text-violet-700' },
  { id: 'MILK',        label: 'Milk',        dot: '#2563eb', text: 'text-blue-700' },
  { id: 'OTHER',       label: 'Other',       dot: '#64748b', text: 'text-slate-600' },
];
export const kindOf = (k: RationKind) => KINDS.find((x) => x.id === k) ?? KINDS[4];

/** Batch colours: distinct enough to tell apart on a printed sheet. */
export const BATCH_COLORS = ['#16a34a', '#0d9488', '#d97706', '#db2777', '#7c3aed', '#2563eb', '#64748b'];

const trim = (n: number) => Number(n.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Staff-friendly amount: under 1 kg is shown in grams. */
export function fmtQty(q: number, unit: RationUnit): string {
  if (unit === 'G') return `${Math.round(q)} g`;
  if (unit === 'L') return `${trim(q)} L`;
  return q < 1 ? `${Math.round(q * 1000)} g` : `${trim(q)} kg`;
}

/** Whether a ration line applies on a day (yyyy-mm-dd strings compare in date order). */
export const isActive = (it: RationItem, day: string) =>
  (!it.fromDate || it.fromDate <= day) && (!it.toDate || it.toDate >= day);

export const productKey = (it: { storeItemId?: number | null; name: string }) =>
  it.storeItemId ? `s:${it.storeItemId}` : `n:${it.name.trim().toLowerCase()}`;

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const fmtDate = (day?: string | null) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

export function parseProducts(plan?: RationPlan | null): Record<string, ProductSetting> {
  try {
    return plan?.products ? JSON.parse(plan.products) : {};
  } catch {
    return {};
  }
}

export interface StoreItemLite {
  id: number;
  name: string;
  kannadaName?: string;
  category: string;
  brand?: string;
  unitSize?: number;
  salePrice: number;
  active: boolean;
}

export interface PurchaseRow {
  key: string;
  name: string;
  kgNeeded: number;
  kgWithWastage: number;
  bagKg: number;
  inStock: number;
  extraBags: number;
  bags: number;
  bagPrice: number | null;
  cost: number | null;
}

/** Concentrate and mineral bought for the plan period, as whole bags. Uses each cow's amounts as scaled to today's milk. */
export function purchaseRows(
  groups: RationGroup[],
  plan: RationPlan,
  products: Record<string, ProductSetting>,
  storeItems: StoreItemLite[],
  membersOf: (g: RationGroup) => RationAnimal[],
): PurchaseRow[] {
  const kg: Record<string, { name: string; storeItemId?: number | null; kg: number; kind: RationKind }> = {};
  const start = plan.startDate;
  if (start) {
    for (let i = 0; i < plan.days; i++) {
      const day = addDays(start, i);
      for (const g of groups) {
        const members = membersOf(g);
        if (!members.length) continue;
        for (const line of resolveLines(g, members, day)) {
          const it = line.item;
          if ((it.kind !== 'CONCENTRATE' && it.kind !== 'MINERAL') || it.unit === 'L') continue;
          const total = line.morning.reduce((t, q) => t + q, 0) + line.evening.reduce((t, q) => t + q, 0);
          const key = productKey(it);
          kg[key] ??= { name: it.name, storeItemId: it.storeItemId, kg: 0, kind: it.kind };
          kg[key].kg += total / (it.unit === 'G' ? 1000 : 1);
        }
      }
    }
  }
  // Products with extra bags but not in any ration yet (e.g. Milkgen 10000 kept in reserve).
  for (const [key, p] of Object.entries(products)) {
    if (!kg[key] && (p.extraBags ?? 0) > 0) {
      kg[key] = { name: p.name, storeItemId: key.startsWith('s:') ? Number(key.slice(2)) : null, kg: 0, kind: 'CONCENTRATE' };
    }
  }

  return Object.entries(kg).map(([key, v]) => {
    const p = products[key] ?? { name: v.name };
    const store = v.storeItemId ? storeItems.find((s) => s.id === v.storeItemId) : undefined;
    const bagKg = p.bagKg || Number(store?.unitSize) || (v.kind === 'MINERAL' ? 25 : 50);
    const kgWithWastage = v.kg * (1 + (plan.wastagePct || 0) / 100);
    const inStock = p.inStock ?? 0;
    const extraBags = p.extraBags ?? 0;
    const bags = Math.max(0, Math.ceil(kgWithWastage / bagKg - 1e-9) - inStock) + extraBags;
    const bagPrice = p.bagPrice ?? (store ? Number(store.salePrice) : null);
    return {
      key,
      name: store?.name ?? v.name,
      kgNeeded: v.kg,
      kgWithWastage,
      bagKg,
      inStock,
      extraBags,
      bags,
      bagPrice,
      cost: bagPrice != null ? bags * bagPrice : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ Dynamic: batch rules and milk scaling */

export const STATUSES: { id: string; label: string }[] = [
  { id: 'LACTATING', label: 'Milking' },
  { id: 'DRY',       label: 'Dry' },
  { id: 'PREGNANT',  label: 'Pregnant' },
  { id: 'HEIFER',    label: 'Heifer' },
  { id: 'CALF',      label: 'Calf' },
];
const statusLabel = (s: string) => STATUSES.find((x) => x.id === s)?.label ?? s;

export const animalLabel = (a: { id: number; animalName?: string; tagNumber?: string }) =>
  (a.animalName || a.tagNumber || `#${a.id}`).trim();

export const ruleIsEmpty = (r?: RationRule | null) =>
  !r || (!r.statuses?.length && r.minMilk == null && r.maxMilk == null && r.minDim == null
    && r.maxDim == null && r.minAgeMonths == null && r.maxAgeMonths == null);

const inRange = (v: number | null | undefined, min?: number | null, max?: number | null) => {
  if (min == null && max == null) return true;
  if (v == null) return false;
  return (min == null || v >= min) && (max == null || v <= max);
};

/** Same test as RationService.matches on the server. */
export function matchesRule(r: RationRule | undefined | null, a: RationAnimal): boolean {
  if (!r || ruleIsEmpty(r)) return false;
  if (r.statuses?.length && !r.statuses.includes((a.animalStatus || '').toUpperCase())) return false;
  return inRange(a.milkPerDay, r.minMilk, r.maxMilk)
    && inRange(a.dim, r.minDim, r.maxDim)
    && inRange(a.ageMonths, r.minAgeMonths, r.maxAgeMonths);
}

/** First batch, in order, whose rule the animal meets. */
export const ruleBatchFor = (groups: { id: number; rule?: RationRule }[], a: RationAnimal) =>
  groups.find((g) => matchesRule(g.rule, a))?.id ?? null;

const span = (lo: number | null | undefined, hi: number | null | undefined, unit: string, pre = '') =>
  lo != null && hi != null ? `${pre}${lo}–${hi}${unit}`
    : lo != null ? `${pre}${lo}${unit} or more`
    : hi != null ? `${pre}up to ${hi}${unit}` : '';

/** e.g. "Milking · 14 L/day or more · DIM up to 100". */
export function ruleText(r?: RationRule | null): string {
  if (!r || ruleIsEmpty(r)) return 'Picked by hand only';
  return [
    r.statuses?.length ? r.statuses.map(statusLabel).join(' or ') : '',
    span(r.minMilk, r.maxMilk, ' L/day'),
    span(r.minDim, r.maxDim, '', 'DIM '),
    span(r.minAgeMonths, r.maxAgeMonths, ' months'),
  ].filter(Boolean).join(' · ');
}

/** NDDB rule of thumb: 1 kg concentrate for every 2.5 L of cow milk, every 2 L of buffalo milk. */
export const litresPerKg = (animalType?: string) => ((animalType || '').toUpperCase() === 'BUFFALO' ? 2 : 2.5);
/** Scaling stays between half and one and a half times the typed ration: beyond that the cow belongs in another batch. */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 1.5;

/** Staff-friendly amounts: 250 g steps from 1 kg, 50 g below that, 10 g for gram lines. */
function roundFeed(q: number, unit: RationUnit): number {
  if (q <= 0) return 0;
  if (unit === 'G') return Math.max(10, Math.round(q / 10) * 10);
  if (unit === 'L') return Math.round(q * 10) / 10;
  return q >= 1 ? Math.round(q * 4) / 4 : Math.max(0.05, Math.round(q * 20) / 20);
}

/**
 * What a cow's milk-scaled lines are multiplied by on a day: together they move by
 * (her milk - the batch's refMilk) / litresPerKg kg a day, shared in proportion to their amounts.
 * null when nothing scales for her: no refMilk, no scaled line that day, not milking, or no milk record.
 */
export function milkFactor(g: RationGroup, activeItems: RationItem[], a: RationAnimal): number | null {
  if (!g.refMilk || a.milkPerDay == null || (a.animalStatus || '').toUpperCase() !== 'LACTATING') return null;
  const base = activeItems
    .filter((it) => it.scaleWithMilk && it.unit !== 'L')
    .reduce((t, it) => t + (it.morningQty + it.eveningQty) / (it.unit === 'G' ? 1000 : 1), 0);
  if (base <= 0) return null;
  const f = (base + (a.milkPerDay - g.refMilk) / litresPerKg(a.animalType)) / base;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, f));
}

/** One ration line on a day, with each member's own amount (same order as the members). */
export interface ResolvedLine {
  item: RationItem;
  morning: number[];
  evening: number[];
  /** True when members get different amounts. */
  varies: boolean;
}

/** The lines that apply on a day, with every member's amount after milk scaling. */
export function resolveLines(g: RationGroup, members: RationAnimal[], day: string): ResolvedLine[] {
  const active = g.items.filter((it) => isActive(it, day));
  const factors = members.map((a) => milkFactor(g, active, a));
  return active.map((it) => {
    const amount = (q: number, f: number | null) =>
      (it.scaleWithMilk && f != null && it.unit !== 'L' ? roundFeed(q * f, it.unit) : q);
    const morning = members.map((_, i) => amount(it.morningQty, factors[i]));
    const evening = members.map((_, i) => amount(it.eveningQty, factors[i]));
    return { item: it, morning, evening, varies: new Set(morning).size > 1 || new Set(evening).size > 1 };
  });
}

/* Suggested rules, from where the animals sit today. */

export interface RuleSuggestion { groupId: number; rule: RationRule; refMilk: number | null }

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rules that keep today's animals where they are: each batch takes its members' statuses, and
 * where batches share a status they are split by milk per day (milking cows) or age (young stock)
 * at the midpoint between them. All-milking batches also get refMilk, their members' average milk.
 */
export function suggestRules(groups: RationGroup[], animals: RationAnimal[]): RuleSuggestion[] {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const membersOf = (g: RationGroup) => g.herdIds.map((id) => byId.get(id)).filter(Boolean) as RationAnimal[];
  const statusesOf = (g: RationGroup) =>
    [...new Set(membersOf(g).map((a) => (a.animalStatus || '').toUpperCase()).filter(Boolean))];
  const out = new Map<number, RuleSuggestion>(
    groups.map((g) => [g.id, { groupId: g.id, rule: { statuses: statusesOf(g) }, refMilk: null }]));

  for (const s of STATUSES.map((x) => x.id)) {
    const sharing = groups.filter((g) => statusesOf(g).includes(s));
    if (sharing.length < 2) continue;
    // Milking cows can be split by milk or by days in milk: take whichever keeps more of them
    // where they are today (milk on a tie). Young stock are split by age.
    const candidates = s === 'LACTATING' ? [FACTS.milk, FACTS.dim] : [FACTS.age];
    let best: { fact: Fact; bounds: Map<number, Bounds>; misplaced: number } | null = null;
    for (const fact of candidates) {
      const bounds = splitBy(sharing, membersOf, fact);
      if (!bounds) continue;
      const misplaced = sharing.reduce((t, g) => t + membersOf(g)
        .filter((a) => (a.animalStatus || '').toUpperCase() === s)
        .filter((a) => !inRange(fact.get(a), bounds.get(g.id)?.lo, bounds.get(g.id)?.hi)).length, 0);
      if (!best || misplaced < best.misplaced) best = { fact, bounds, misplaced };
    }
    if (!best) continue;
    for (const [gid, b] of best.bounds) {
      const rule = out.get(gid)!.rule;
      rule[best.fact.min] = b.lo;
      rule[best.fact.max] = b.hi;
    }
  }

  // A batch with no animals today gives nothing to learn from: keep whatever rule it has.
  const result = groups.map((g) => (membersOf(g).length
    ? out.get(g.id)!
    : { groupId: g.id, rule: g.rule ?? { statuses: [] }, refMilk: g.refMilk ?? null }));

  // The milk each batch's ration is for: the average of the cows the new rules put in it.
  const proposed = groups.map((g, i) => ({ id: g.id, rule: result[i].rule }));
  result.forEach((r, i) => {
    if (!membersOf(groups[i]).length) return;
    const landed = animals.filter((a) => ruleBatchFor(proposed, a) === r.groupId);
    const milking = landed.filter((a) => (a.animalStatus || '').toUpperCase() === 'LACTATING' && a.milkPerDay != null);
    r.refMilk = milking.length && milking.length === landed.length
      ? round1(milking.reduce((t, a) => t + a.milkPerDay!, 0) / milking.length)
      : null;
  });
  return result;
}

type RangeKey = Exclude<keyof RationRule, 'statuses'>;
interface Fact { get: (a: RationAnimal) => number | null | undefined; min: RangeKey; max: RangeKey; whole: boolean }
interface Bounds { lo: number | null; hi: number | null }
const FACTS: Record<'milk' | 'dim' | 'age', Fact> = {
  milk: { get: (a) => a.milkPerDay, min: 'minMilk', max: 'maxMilk', whole: false },
  dim: { get: (a) => a.dim, min: 'minDim', max: 'maxDim', whole: true },
  age: { get: (a) => a.ageMonths, min: 'minAgeMonths', max: 'maxAgeMonths', whole: true },
};

/**
 * Splits batches on one fact at the midpoints between them (lowest batch first), so the ranges
 * meet without overlapping: milk in 0.1 L steps, days and months in whole numbers.
 */
function splitBy(sharing: RationGroup[], membersOf: (g: RationGroup) => RationAnimal[], fact: Fact): Map<number, Bounds> | null {
  const ranges = sharing.map((g) => {
    const vals = membersOf(g).map(fact.get).filter((v): v is number => v != null);
    return { g, lo: Math.min(...vals), hi: Math.max(...vals), mean: vals.reduce((t, v) => t + v, 0) / (vals.length || 1), n: vals.length };
  }).filter((r) => r.n > 0).sort((a, b) => a.mean - b.mean);
  if (ranges.length < 2) return null;
  const step = fact.whole ? 1 : 0.1;
  const cuts = ranges.slice(1).map((y, i) => {
    const x = ranges[i];
    const c = x.hi < y.lo ? (x.hi + y.lo) / 2 : (x.mean + y.mean) / 2;
    return fact.whole ? Math.ceil(c) : round1(c);
  });
  return new Map(ranges.map((r, i) => [r.g.id, {
    lo: i > 0 ? cuts[i - 1] : null,
    hi: i < cuts.length ? round1(cuts[i] - step) : null,
  }]));
}
