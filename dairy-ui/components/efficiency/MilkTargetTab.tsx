'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import { EffCow, EffReport, litres, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, PctBar, Sub, TableWrap, TD, TH } from './ui';

type SortKey = 'dim' | 'avg' | 'target' | 'efficiency';
const SORT_VALUE: Record<SortKey, (c: EffCow) => number> = {
  dim: c => c.dim ?? Infinity,
  avg: c => c.milkTarget!.avgPerDay,
  target: c => c.milkTarget!.targetPerDay,
  efficiency: c => c.milkTarget!.efficiency,
};

/** Today's target, with ✎ to set it from the farm's own judgement of the cow. */
function TargetCell({ c, onChanged }: { c: EffCow; onChanged: () => void }) {
  const m = c.milkTarget!;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > 80) { setErr('0–80 L'); return; }
    try {
      await api.patch(`/reports/efficiency/cows/${c.id}/target`, { litres: n });
      setEditing(false);
      onChanged();
    } catch {
      setErr('Could not save');
    }
  };
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input type="number" inputMode="decimal" autoFocus value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-14 px-1.5 py-0.5 text-xs border border-slate-300 rounded-md" aria-label={`Today's milk target for ${c.name}`} />
        <button type="button" onClick={save} className="px-1.5 py-0.5 text-[11px] font-bold rounded-md bg-slate-800 text-white">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="px-1 text-[11px] text-slate-500">✕</button>
        {err && <span className="text-[11px] text-red-600">{err}</span>}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap">
      {litres(m.targetPerDay)}
      <button type="button" onClick={() => { setValue(String(Math.round(m.targetPerDay))); setErr(''); setEditing(true); }}
        className={`ml-1 text-xs ${m.targetSet ? 'text-text' : 'text-slate-400'} hover:text-text`}
        title={m.targetSet ? 'Set by you - follows her lactation from here. Tap to change' : 'Breed estimate - tap to set her target'}
        aria-label={`Set ${c.name}'s milk target`}>✎</button>
    </span>
  );
}

export default function MilkTargetTab({ report, onChanged }: { report: EffReport; onChanged: () => void }) {
  const s = summarise(report).milk;
  const { rules } = report;
  // Days in milk first (same order as the other screens); a column header sorts by it, again to flip.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'dim', desc: false });
  const cows = report.cows.filter(c => c.milkTarget).sort((a, b) => {
    const d = SORT_VALUE[sort.key](a) - SORT_VALUE[sort.key](b);
    return sort.desc ? -d : d;
  });
  const sortBy = (key: SortKey) => setSort(cur => cur.key === key ? { key, desc: !cur.desc } : { key, desc: key !== 'dim' });
  const Head = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <th className={`${TH} ${className}`}>
      <button type="button" onClick={() => sortBy(k)} className="uppercase tracking-wider font-bold hover:text-text">
        {label}{sort.key === k ? (sort.desc ? ' ▼' : ' ▲') : ''}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Avg milk per day · 365 day cycle" value={litres(s.cyclePerDay, 1)}
          sub={rules.farmCycleDays ? `calving every ${rules.farmCycleDays} days · ${rules.farmDryDays} dry days` : `${s.cycleCows} cows, dry days included`} />
        <Kpi label="Herd efficiency" value={s.efficiency != null ? `${Math.round(s.efficiency)}%` : '—'}
          sub={`${litres(s.avg, 1)} of ${litres(s.target)} a day`} tone={s.efficiency != null ? toneOf(s.efficiency) : undefined} />
        <Kpi label="Can gain per cow" value={`${litres(s.lostPerCowPerDay, 1)} / day`} sub={`${litres(s.lostPerCowPerDay * 30)} a month`} />
        <Kpi label="Herd can gain" value={`${litres(s.lostPerDay * 30)} / month`} sub={`${litres(s.lostPerDay, 1)} a day`}
          tone={s.lostPerDay > 0 ? 'poor' : undefined} />
      </KpiRow>

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <Head k="dim" label="Cow" /><Head k="avg" label="Avg / day" /><Head k="target" label="Target" />
              <Head k="efficiency" label="Efficiency" className="w-[28%]" /><th className={`${TH} text-right`}>Can gain</th>
            </tr>
          </thead>
          <tbody>
            {cows.map(c => {
              const m = c.milkTarget!;
              return (
                <tr key={c.id}>
                  <td className={TD}><div className="font-bold text-text">{c.name}</div>{c.dim != null && <Sub>day {c.dim} of lactation</Sub>}</td>
                  <td className={TD}>{litres(m.avgPerDay, 1)}</td>
                  <td className={TD}><TargetCell c={c} onChanged={onChanged} /></td>
                  <td className={TD}><PctBar pct={m.efficiency} /></td>
                  <td className={`${TD} text-right`}>{litres(m.lostPerDay, 1)} / day<Sub>{litres(m.lostPerDay * 30)} / month</Sub></td>
                </tr>
              );
            })}
            {cows.length > 0 && (
              <tr className="font-black">
                <td className={TD}>Total</td><td className={TD}>{litres(s.avg, 1)}</td><td className={TD}>{litres(s.target)}</td>
                <td className={TD}>{s.efficiency != null && <PctBar pct={s.efficiency} />}</td>
                <td className={`${TD} text-right`}>{litres(s.lostPerDay, 1)} / day<Sub>{litres(s.lostPerDay * 30)} / month</Sub></td>
              </tr>
            )}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
