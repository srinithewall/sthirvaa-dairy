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
}

export interface RationGroup {
  id: number;
  name: string;
  color?: string;
  notes?: string;
  sortOrder?: number;
  items: RationItem[];
  herdIds: number[];
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

/** Concentrate and mineral bought for the plan period, as whole bags. */
export function purchaseRows(
  groups: RationGroup[],
  plan: RationPlan,
  products: Record<string, ProductSetting>,
  storeItems: StoreItemLite[],
  animalCount: (g: RationGroup) => number,
): PurchaseRow[] {
  const kg: Record<string, { name: string; storeItemId?: number | null; kg: number; kind: RationKind }> = {};
  const start = plan.startDate;
  if (start) {
    for (let i = 0; i < plan.days; i++) {
      const day = addDays(start, i);
      for (const g of groups) {
        const n = animalCount(g);
        if (!n) continue;
        for (const it of g.items) {
          if ((it.kind !== 'CONCENTRATE' && it.kind !== 'MINERAL') || it.unit === 'L' || !isActive(it, day)) continue;
          const perDay = (it.morningQty + it.eveningQty) / (it.unit === 'G' ? 1000 : 1);
          const key = productKey(it);
          kg[key] ??= { name: it.name, storeItemId: it.storeItemId, kg: 0, kind: it.kind };
          kg[key].kg += perDay * n;
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
