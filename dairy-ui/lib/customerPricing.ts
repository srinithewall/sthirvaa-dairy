/** A customer's milk price by volume: deliveries of fromLitres or more pay milkRate + deliveryRate per litre. */
export interface PriceSlab {
  id?: number;
  customerId?: number;
  fromLitres: number;
  milkRate: number;
  deliveryRate: number;
  /** false: no delivery at this volume, the customer collects (milk price only). */
  deliveryAvailable?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  defaultRate: number;
  /** Where the milk is delivered. */
  deliveryLocation?: string | null;
  /** Round-trip km for one delivery. */
  deliveryKm?: number | null;
}

export interface Quote { milkRate: number; deliveryRate: number; rate: number; }

/**
 * Same rule as CustomerPricingService.quote on the backend: the slab with the highest starting
 * volume at or below the litres; below the first slab, the first slab; no slabs, the default rate.
 */
export function quote(customer: Pick<Customer, 'defaultRate'> | undefined, slabs: PriceSlab[] | undefined, litres: number): Quote {
  if (!slabs || slabs.length === 0) {
    const rate = customer?.defaultRate ?? 45;
    return { milkRate: rate, deliveryRate: 0, rate };
  }
  const sorted = [...slabs].sort((a, b) => a.fromLitres - b.fromLitres);
  let pick = sorted[0];
  for (const s of sorted) if (s.fromLitres <= litres + 1e-9) pick = s;
  const delivery = pick.deliveryAvailable === false ? 0 : (pick.deliveryRate ?? 0);
  return { milkRate: pick.milkRate, deliveryRate: delivery, rate: pick.milkRate + delivery };
}

/** "Below 10 L", "10 – 15 L", "20 L and above" for each slab in order. */
export function slabLabel(slabs: PriceSlab[], i: number): string {
  const sorted = [...slabs].sort((a, b) => a.fromLitres - b.fromLitres);
  const s = sorted[i];
  const next = sorted[i + 1];
  const fmt = (n: number) => `${+n.toFixed(1)}`;
  if (i === 0 && s.fromLitres <= 0) return next ? `Below ${fmt(next.fromLitres)} L` : 'Any volume';
  if (!next) return `${fmt(s.fromLitres)} L and above`;
  return `${fmt(s.fromLitres)} – ${fmt(next.fromLitres)} L`;
}

/** Rupees with no paise. */
export const rupees = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
