'use client';

import React, { useState } from 'react';
import Portal from '@/components/store/Portal';
import { StoreItem, StoreItemCategory, StoreSupplier, CATEGORIES, categoryLabel, brandMatches } from '@/lib/store';
import { SlidersHorizontal, X } from 'lucide-react';

export interface ItemFilterValue { supplierId: number | ''; type: StoreItemCategory | ''; }
export const NO_FILTER: ItemFilterValue = { supplierId: '', type: '' };

/** True when the item matches the supplier (linked, or brand like their name) and type filters. */
export function matchesItemFilter(item: StoreItem, f: ItemFilterValue, suppliers: StoreSupplier[]): boolean {
  const supplier = suppliers.find((s) => s.id === f.supplierId);
  return (!supplier || !!item.supplierIds?.includes(supplier.id) || brandMatches(item.brand, supplier.name))
    && (!f.type || item.category === f.type);
}

/** Filter icon button (with active-count badge) that opens the supplier/type filter popup. */
export default function ItemFilter({ value, onChange, suppliers, resultCount, noun = 'item' }: {
  value: ItemFilterValue; onChange: (v: ItemFilterValue) => void; suppliers: StoreSupplier[]; resultCount: number;
  /** What the results are called on the Show button, e.g. 'item' or 'bill'. */
  noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const count = (value.supplierId !== '' ? 1 : 0) + (value.type !== '' ? 1 : 0);
  const chip = (on: boolean) =>
    `px-3 py-1 rounded-full text-[12px] font-semibold border ${on ? 'bg-brand text-white border-brand' : 'border-border-custom text-text2'}`;

  return (
    <>
      <button onClick={() => setOpen(true)} title={`Filter ${noun}s`} aria-label={`Filter ${noun}s`}
        className={`relative px-3 rounded-lg border ${open || count ? 'border-brand text-brand bg-[#E8F5EE]' : 'border-border-custom text-text2 bg-white'}`}>
        <SlidersHorizontal size={16} />
        {count > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">{count}</span>}
      </button>
      {open && (
        <Portal>
          <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Filter {noun}s</h2>
                <button onClick={() => setOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-full text-[11px] font-bold text-text3 uppercase tracking-wide">Supplier</span>
                {[{ id: '' as const, name: 'All' }, ...suppliers].map((s) => (
                  <button key={s.id} onClick={() => onChange({ ...value, supplierId: s.id })} className={chip(value.supplierId === s.id)}>{s.name}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-full text-[11px] font-bold text-text3 uppercase tracking-wide">Type</span>
                {(['', ...CATEGORIES] as (StoreItemCategory | '')[]).map((c) => (
                  <button key={c || 'all'} onClick={() => onChange({ ...value, type: c })} className={chip(value.type === c)}>
                    {c ? categoryLabel(c) : 'All'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => onChange(NO_FILTER)} disabled={count === 0}
                  className="py-2.5 rounded-lg border border-border-custom font-bold text-sm text-text2 disabled:opacity-40">Clear</button>
                <button onClick={() => setOpen(false)} className="py-2.5 rounded-lg bg-brand text-white font-bold text-sm">
                  Show {resultCount} {noun}{resultCount === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
