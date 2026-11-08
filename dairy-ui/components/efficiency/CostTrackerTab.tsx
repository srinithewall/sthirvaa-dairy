'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import LedgerCostTracker, { ALL_MONTHS, TrackerEntry, TrackerMilkReceived } from '@/components/LedgerCostTracker';

type Segment = 'CATTLE' | 'POULTRY';
const POULTRY_TYPES = ['CHICKEN', 'DUCK', 'FISH', 'QUAIL'];

interface Entry extends TrackerEntry { segment?: string; herdId?: number | null; unaccounted?: boolean }

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = (m: string) => new Date(`${m}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/**
 * The cost tracker that used to open from the Digital Ledger: six months of expense against income
 * and the month's top expense categories. Same data and rules as the ledger (segment, unaccounted).
 */
export default function CostTrackerTab() {
  // Opens on last month, a full month.
  const lastMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ym(d); })();
  const [month, setMonth] = useState(lastMonth);
  const [segment, setSegment] = useState<Segment | 'ALL'>('CATTLE');
  const [history, setHistory] = useState<Entry[]>([]);
  const [milkReceived, setMilkReceived] = useState<TrackerMilkReceived[]>([]);
  const [poultryHerdIds, setPoultryHerdIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([api.get('/expenses'), api.get('/income'), api.get('/income/milk-received'), api.get('/herds')])
      .then(([exp, inc, milk, herds]) => {
        const expenses = exp.status === 'fulfilled' ? exp.value.data : [];
        const income = inc.status === 'fulfilled' ? inc.value.data : [];
        setHistory([
          ...expenses.map((e: any) => ({ ...e, type: 'EXPENSE' as const })),
          ...income.map((i: any) => ({ ...i, type: 'INCOME' as const })),
        ]);
        setMilkReceived(milk.status === 'fulfilled' && Array.isArray(milk.value.data) ? milk.value.data : []);
        const herdList = herds.status === 'fulfilled' ? (herds.value.data.herds || herds.value.data) : [];
        setPoultryHerdIds(new Set((Array.isArray(herdList) ? herdList : [])
          .filter((h: any) => POULTRY_TYPES.includes(h.animalType)).map((h: any) => h.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  const entries = useMemo(() => {
    // Same rule as the ledger: tagged segment first, else the Poultry category or a poultry batch.
    const segmentOf = (h: Entry): Segment =>
      h.segment === 'POULTRY' || h.segment === 'CATTLE' ? h.segment
        : h.category === 'Poultry' || (h.herdId != null && poultryHerdIds.has(h.herdId)) ? 'POULTRY' : 'CATTLE';
    return history.filter(h => !h.unaccounted && (segment === 'ALL' || segmentOf(h) === segment));
  }, [history, segment, poultryHerdIds]);
  const months = useMemo(() => Array.from(new Set([lastMonth, ym(new Date()), ...history.map(h => h.date.substring(0, 7))])).sort().reverse(),
    [history, lastMonth]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Cost tracker month"
          className="bg-white border border-border-custom text-text text-sm font-bold rounded-lg px-3 py-2">
          <option value={ALL_MONTHS}>All months</option>
          {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
        </select>
        <select value={segment} onChange={e => setSegment(e.target.value as Segment | 'ALL')} aria-label="Cattle or poultry"
          className="bg-white border border-border-custom text-text text-sm font-bold rounded-lg px-3 py-2">
          <option value="CATTLE">Cattle</option><option value="POULTRY">Poultry</option><option value="ALL">Cattle and poultry</option>
        </select>
      </div>
      {loading
        ? <div className="py-16 text-center text-text3 text-[13px]">Loading…</div>
        : <LedgerCostTracker entries={entries} milkReceived={segment === 'POULTRY' ? [] : milkReceived} month={month} />}
    </div>
  );
}
