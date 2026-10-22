// Poultry and fish are stored one record per batch. Deaths and egg collections are herd events
// with a quantity, so the live count is the starting count minus every recorded death.

export const BIRD_DEATH = 'BIRD_DEATH';
export const EGGS_COLLECTED = 'EGGS_COLLECTED';

export interface BatchType {
  type: string;
  label: string;
  /** Tag prefix for the generated batch ID. */
  prefix: string;
  /** What one head is called in counts: "12 birds", "300 fish". */
  unit: string;
  laysEggs: boolean;
  breeds: string[];
  /** Tailwind classes: chip background/border, icon tile background, icon colour. */
  chip: string;
  tile: string;
  icon: string;
}

/** In display order on the herds page and the register form. */
export const BATCH_TYPES: BatchType[] = [
  { type: 'CHICKEN', label: 'Chicken', prefix: 'CK', unit: 'birds', laysEggs: true,
    breeds: ['Giriraja', 'Kadaknath', 'Broiler', 'Swarnadhara', 'Country (Naati)'],
    chip: 'bg-amber-50 border-amber-200 hover:bg-amber-100', tile: 'bg-amber-100', icon: 'text-amber-600' },
  { type: 'DUCK', label: 'Duck', prefix: 'DK', unit: 'birds', laysEggs: true,
    breeds: ['Khaki Campbell', 'Pekin', 'Indian Runner', 'Country (Naati)'],
    chip: 'bg-sky-50 border-sky-200 hover:bg-sky-100', tile: 'bg-sky-100', icon: 'text-sky-600' },
  { type: 'FISH', label: 'Fish', prefix: 'FS', unit: 'fish', laysEggs: false,
    breeds: ['Rohu', 'Catla', 'Mrigal', 'Tilapia', 'Common carp', 'Pangasius'],
    chip: 'bg-teal-50 border-teal-200 hover:bg-teal-100', tile: 'bg-teal-100', icon: 'text-teal-600' },
  { type: 'QUAIL', label: 'Quail', prefix: 'QL', unit: 'birds', laysEggs: true,
    breeds: ['Japanese quail', 'Bobwhite'],
    chip: 'bg-orange-50 border-orange-200 hover:bg-orange-100', tile: 'bg-orange-100', icon: 'text-orange-700' },
];

export const batchType = (t?: string | null) => BATCH_TYPES.find(b => b.type === t) ?? BATCH_TYPES[0];

export const isPoultryType = (t?: string | null) => BATCH_TYPES.some(b => b.type === t);

interface QtyEvent { herdId?: number; eventType: string; quantity?: number | null; eventDate: string; }

export const sumQty = (events: QtyEvent[], type: string, herdId?: number) =>
  events.reduce((t, e) =>
    e.eventType === type && (herdId == null || e.herdId === herdId) ? t + (e.quantity || 0) : t, 0);

/** Heads still alive: starting count less recorded deaths, never below zero. */
export const liveBirds = (startCount: number | null | undefined, events: QtyEvent[], herdId?: number) =>
  Math.max(0, (startCount ?? 0) - sumQty(events, BIRD_DEATH, herdId));
