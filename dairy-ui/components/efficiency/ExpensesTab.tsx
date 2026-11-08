'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import api from '@/lib/api';
import { rupees, shortDate } from '@/lib/efficiency';
import { Card } from './ui';

ChartJS.register(ArcElement, Tooltip);

interface CostEntry { id: number; date: string; category: string; group: string; amount: number; segment: string }
interface IncomeEntry { date: string; category: string; amount: number; segment?: string | null }

/** Ledger income categories as people say them; MILK_SALES is the milk distributed to customers. */
const incomeLabel = (c: string) => (c === 'MILK_SALES' || c.trim().toLowerCase() === 'milk' ? 'Milk sales' : c.trim());
interface CostGroup { key: string; label: string }

/* One colour per cost group, fixed so a group keeps its colour whatever the range. */
const GROUP_COLOR: Record<string, string> = {
  FEED: '#2a78d6', INFRA: '#008300', LABOUR: '#eda100', VET: '#eb6834',
  DEATHS: '#e34948', TRANSPORT: '#6250d6', ANIMALS: '#e87ba4', OTHER: '#c3c2b7',
};

type Preset = 'ALL' | 'MONTH' | '3M' | 'FY' | 'CUSTOM';
const ALL_FROM = '2000-01-01';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  const today = iso(now);
  if (p === 'MONTH') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), today];
  if (p === '3M') return [iso(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())), today];
  // Indian financial year: 1 April.
  if (p === 'FY') return [iso(new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1)), today];
  return [ALL_FROM, today];
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'ALL', label: 'All time' }, { key: 'MONTH', label: 'This month' }, { key: '3M', label: 'Last 3 months' },
  { key: 'FY', label: 'This financial year' }, { key: 'CUSTOM', label: 'Custom' },
];

export default function ExpensesTab() {
  const [preset, setPreset] = useState<Preset>('ALL');
  const [[from, to], setRange] = useState<[string, string]>(presetRange('ALL'));
  const [segment, setSegment] = useState<'ALL' | 'CATTLE' | 'POULTRY'>('ALL');
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [groups, setGroups] = useState<CostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [income, setIncome] = useState<IncomeEntry[] | null>(null);

  // Revenue = ledger income, as the dashboard counts it; filtered here by the same range and segment.
  useEffect(() => {
    api.get('/income').then(res => setIncome(Array.isArray(res.data) ? res.data : [])).catch(() => setIncome([]));
  }, []);

  const rangeError = !from || !to ? 'Pick both dates' : from > to ? 'From must be on or before To' : '';

  useEffect(() => {
    if (rangeError) return;
    let live = true;
    setLoading(true);
    setError('');
    api.get('/reports/costs', { params: { from, to, segment } })
      .then(res => { if (live) { setEntries(res.data.entries || []); setGroups(res.data.groups || []); } })
      .catch(() => { if (live) setError("Couldn't load expenses. Try again."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [from, to, segment, rangeError]);

  // Types taken out of the total and the pie by clicking them (nothing is deleted); kept across ranges.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const slices = useMemo(() => groups
    .map(g => ({ ...g, value: entries.filter(e => e.group === g.key).reduce((t, e) => t + e.amount, 0), count: entries.filter(e => e.group === g.key).length }))
    .filter(g => g.value > 0)
    .sort((a, b) => b.value - a.value), [entries, groups]);
  const shown = slices.filter(s => !hidden.has(s.key));
  const removed = slices.filter(s => hidden.has(s.key));
  const total = shown.reduce((t, s) => t + s.value, 0);
  const entryCount = shown.reduce((t, s) => t + s.count, 0);

  const revenue = useMemo(() => {
    if (!income) return null;
    // Same rule as the ledger: tagged segment, else the Poultry category, else cattle.
    const seg = (i: IncomeEntry) => (i.segment === 'POULTRY' || i.segment === 'CATTLE' ? i.segment : i.category === 'Poultry' ? 'POULTRY' : 'CATTLE');
    const inRange = income.filter(i => i.date >= from && i.date <= to && (segment === 'ALL' || seg(i) === segment));
    const byCat: Record<string, number> = {};
    inRange.forEach(i => { const k = incomeLabel(i.category); byCat[k] = (byCat[k] || 0) + (i.amount || 0); });
    return {
      total: inRange.reduce((t, i) => t + (i.amount || 0), 0),
      parts: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    };
  }, [income, from, to, segment]);

  // "All time" shows the span the ledger actually covers, not the 2000 sentinel.
  const shownFrom = preset === 'ALL' && entries.length ? entries.map(e => e.date).sort()[0] : from;

  const pick = (p: Preset) => {
    setPreset(p);
    if (p !== 'CUSTOM') setRange(presetRange(p));
    else if (from === ALL_FROM) setRange([entries.map(e => e.date).sort()[0] ?? presetRange('FY')[0], to]);
  };
  const setDate = (which: 0 | 1, v: string) => { setPreset('CUSTOM'); setRange(which === 0 ? [v, to] : [from, v]); };

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => pick(p.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${preset === p.key ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom hover:border-brand'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[13px] text-text2">
        <label className="flex items-center gap-2">From
          <input type="date" value={from === ALL_FROM ? shownFrom : from} max={to} onChange={e => setDate(0, e.target.value)}
            className="bg-white border border-border-custom rounded-lg px-2.5 py-1.5 text-[13px] font-semibold" />
        </label>
        <label className="flex items-center gap-2">to
          <input type="date" value={to} min={from === ALL_FROM ? undefined : from} onChange={e => setDate(1, e.target.value)}
            className="bg-white border border-border-custom rounded-lg px-2.5 py-1.5 text-[13px] font-semibold" />
        </label>
        <select value={segment} onChange={e => setSegment(e.target.value as typeof segment)} aria-label="Cattle or poultry"
          className="bg-white border border-border-custom rounded-lg px-2.5 py-1.5 text-[13px] font-semibold">
          <option value="ALL">Cattle and poultry</option><option value="CATTLE">Cattle</option><option value="POULTRY">Poultry</option>
        </select>
        {rangeError && <span className="text-danger text-[13px] font-bold">{rangeError}</span>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-4">
        <span className="text-[12px] font-bold text-text3 uppercase tracking-wider">Total expenses</span>
        <span className="text-[26px] font-black text-text">{loading ? '…' : rupees(total)}</span>
        {!loading && <span className="text-[12px] text-text3">{shortDate(shownFrom, true)} – {shortDate(to, true)} · {entryCount} entries</span>}
      </div>
      {!loading && removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-text2">
          <span>Leaving out {removed.map(s => s.label).join(', ')} ({rupees(removed.reduce((t, s) => t + s.value, 0))})</span>
          <button type="button" onClick={() => setHidden(new Set())} className="font-bold text-brand underline underline-offset-2">Show all</button>
        </div>
      )}

      {!loading && !rangeError && revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <div className="bg-[#E8F5EE] rounded-lg px-3 py-2.5 min-w-0">
            <div className="text-[11px] font-bold text-brand uppercase tracking-wider">Revenue</div>
            <div className="text-[18px] font-black text-brand">{rupees(revenue.total)}</div>
            <div className="text-[11px] text-text2 truncate" title={revenue.parts.map(([k, v]) => `${k} ${rupees(v)}`).join(' · ')}>
              {revenue.parts.length ? revenue.parts.map(([k, v]) => `${k} ${rupees(v)}`).join(' · ') : 'no income in this range'}
            </div>
          </div>
          <div className="bg-[#FDEAEA] rounded-lg px-3 py-2.5 min-w-0">
            <div className="text-[11px] font-bold text-danger uppercase tracking-wider">Expenses</div>
            <div className="text-[18px] font-black text-danger">{rupees(total)}</div>
            <div className="text-[11px] text-text2">{removed.length ? 'types shown only' : 'all types'}</div>
          </div>
          <div className="bg-surface2 rounded-lg px-3 py-2.5 min-w-0">
            <div className="text-[11px] font-bold text-text3 uppercase tracking-wider">Net (revenue − expenses)</div>
            <div className={`text-[18px] font-black ${revenue.total - total >= 0 ? 'text-brand' : 'text-danger'}`}>{rupees(revenue.total - total)}</div>
            <div className="text-[11px] text-text2">
              {revenue.total > 0 ? `expenses are ${Math.round((100 * total) / revenue.total)}% of revenue` : '—'}
            </div>
          </div>
        </div>
      )}

      {error ? <div className="py-10 text-center text-danger text-[13px]">{error}</div>
        : !loading && slices.length === 0 ? <div className="py-10 text-center text-text3 text-[13px]">No expenses in this range.</div>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-center mt-3">
            <div className="relative h-[230px]">
              <Doughnut
                data={{ labels: shown.map(s => s.label), datasets: [{ data: shown.map(s => Math.round(s.value)), backgroundColor: shown.map(s => GROUP_COLOR[s.key] ?? '#c3c2b7'), borderColor: '#ffffff', borderWidth: 2 }] }}
                options={{ responsive: true, maintainAspectRatio: false, cutout: '62%',
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: i => ` ${i.label}: ${rupees(i.raw as number)}` } } } }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-text3">Total</span>
                <span className="text-[15px] font-black text-text">{rupees(total)}</span>
              </div>
            </div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-border-custom">
                {slices.map(s => {
                  const off = hidden.has(s.key);
                  return (
                    <tr key={s.key} onClick={() => toggle(s.key)} className="cursor-pointer hover:bg-surface2"
                      title={off ? 'Add back to the total' : 'Leave out of the total'}>
                      <td className="py-2 pr-2">
                        <button type="button" aria-pressed={!off} onClick={e => { e.stopPropagation(); toggle(s.key); }}
                          className={`flex items-center gap-2 font-bold text-left ${off ? 'text-text3 line-through' : 'text-text'}`}>
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={off ? { border: `1.5px solid ${GROUP_COLOR[s.key] ?? '#c3c2b7'}` } : { background: GROUP_COLOR[s.key] ?? '#c3c2b7' }} />
                          {s.label}
                        </button>
                      </td>
                      <td className={`py-2 text-right font-black ${off ? 'text-text3 line-through' : 'text-text'}`}>{rupees(s.value)}</td>
                      <td className="py-2 pl-3 text-right text-text3 w-12">{off ? 'off' : total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-2 font-black text-text">Total{removed.length > 0 ? ' shown' : ''}</td>
                  <td className="py-2 text-right font-black text-text">{rupees(total)}</td>
                  <td className="py-2 pl-3 text-right text-text3">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      <p className="text-[12px] text-text3 mt-3">
        Click a type to leave it out of the total and the pie; click again to add it back. Nothing is deleted from the ledger.
        Revenue is the ledger&apos;s income, as on the dashboard; milk sales are counted at the rate entered when the milk was distributed.
        From the Digital Ledger, sorted into cost groups by category name. Deaths include cattle written off in the ledger and poultry deaths at cost per bird.
      </p>
    </Card>
  );
}
