'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gauge, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { EffReport, litres, rupees, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow } from '@/components/efficiency/ui';
import ReproductionTab from '@/components/efficiency/ReproductionTab';
import MilkTargetTab from '@/components/efficiency/MilkTargetTab';
import LactationTab from '@/components/efficiency/LactationTab';
import ExpensesTab from '@/components/efficiency/ExpensesTab';
import CostTrackerTab from '@/components/efficiency/CostTrackerTab';
import EmpReport from '@/components/EmpReport';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'reproduction', label: 'Reproduction' },
  { key: 'milk', label: 'Milk target' },
  { key: 'lactation', label: 'Lactation' },
  { key: 'emp', label: 'Milk forecast (EMP)' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'costs', label: 'Cost tracker' },
] as const;
type TabKey = typeof TABS[number]['key'];

function Overview({ report, expenseTotal }: { report: EffReport; expenseTotal: number | null }) {
  const s = summarise(report);
  const flagged = report.cows.filter(c => c.flags.length > 0);
  // Lowest share of target first.
  const milkCows = report.cows.filter(c => c.yieldCheck).sort((a, b) => a.yieldCheck!.pct - b.yieldCheck!.pct);
  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Calving efficiency" value={s.repro.efficiency != null ? `${Math.round(s.repro.efficiency)}%` : '—'}
          sub={s.repro.cows ? `${Math.round(s.repro.avgInterval)}-day avg interval · 100% = 365` : undefined}
          tone={s.repro.efficiency != null ? toneOf(s.repro.efficiency) : undefined} />
        <Kpi label="Milk target efficiency" value={s.milk.efficiency != null ? `${Math.round(s.milk.efficiency)}%` : '—'}
          sub={`${litres(s.milk.avg, 1)} of ${litres(s.milk.target)} a day`} tone={s.milk.efficiency != null ? toneOf(s.milk.efficiency) : undefined} />
        <Kpi label="Avg milk per day · 365 day cycle" value={litres(s.milk.cyclePerDay, 1)}
          sub={`dry days included${report.milkPerDay.last7Avg != null ? ` · last ${report.milkPerDay.days} days ${litres(report.milkPerDay.last7Avg, 1)}` : ''}`} />
        <Kpi label="Total expenses" value={expenseTotal != null ? rupees(expenseTotal) : '…'} sub="all time, incl. unaccounted" />
      </KpiRow>

      {milkCows.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3 text-[11px] font-bold text-text3 uppercase tracking-wide">
            <div className="flex-1 text-[13px] font-black text-text normal-case tracking-normal flex items-center gap-2">
              <Gauge size={16} className="text-brand" /> Milk vs target · last 7 days
            </div>
            <div className="w-28 text-right">Avg / target</div>
            <div className="w-20 text-right">vs 2 wk</div>
          </div>
          <div className="space-y-2.5">
            {milkCows.map(c => {
              const y = c.yieldCheck!;
              return (
                <div key={c.id} className="flex items-center gap-3 text-[12px]">
                  <div className="w-24 font-bold text-text truncate">{c.name}</div>
                  <div className="flex-1 h-2 rounded-full bg-surface2 overflow-hidden">
                    <div className={`h-full rounded-full ${y.pct >= 90 ? 'bg-green-300' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, y.pct)}%` }} />
                  </div>
                  <div className="w-28 text-right font-bold text-text2 tabular-nums">{litres(y.last7, 1)} / {litres(y.target)}</div>
                  <div className={`w-20 text-right font-black tabular-nums flex items-center justify-end gap-0.5 ${y.change == null ? 'text-text3' : y.change > 0 ? 'text-brand' : y.change < 0 ? 'text-danger' : 'text-text3'}`}
                    title={y.before != null ? `${litres(y.before, 1)} a day two weeks ago` : undefined}>
                    {y.change == null ? '—' : <>{y.change > 0 ? <TrendingUp size={13} /> : y.change < 0 ? <TrendingDown size={13} /> : null}{y.change > 0 ? '+' : ''}{y.change.toFixed(1)} L</>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {flagged.length > 0 && (
        <Card className="p-4">
          <div className="text-[13px] font-black text-text flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warn" /> Records to check
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {flagged.flatMap(c => c.flags.map((f, i) => (
              <li key={`${c.id}-${i}`}><span className="font-bold text-text">{c.name}:</span> <span className="text-text2">{f}</span></li>
            )))}
          </ul>
        </Card>
      )}

    </div>
  );
}

function EfficiencyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: TabKey = (TABS.find(t => t.key === params.get('tab'))?.key) ?? 'overview';
  const [report, setReport] = useState<EffReport | null>(null);
  const [expenseTotal, setExpenseTotal] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadReport = () =>
    api.get('/reports/efficiency').then(r => setReport(r.data)).catch(() => setError("Couldn't load the efficiency report. Try again."));

  useEffect(() => {
    loadReport();
    const today = new Date().toISOString().slice(0, 10);
    // Same figure as the Expenses tab opens on: all time, unaccounted expenses included.
    api.get('/reports/costs', { params: { from: '2000-01-01', to: today, segment: 'ALL', includeUnaccounted: true } })
      .then(r => setExpenseTotal((r.data.entries || []).reduce((t: number, e: any) => t + e.amount, 0)))
      .catch(() => setExpenseTotal(null));
  }, []);

  const go = (t: TabKey) => router.replace(t === 'overview' ? '/efficiency' : `/efficiency?tab=${t}`, { scroll: false });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-10 px-1">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight uppercase flex items-center gap-2 sm:gap-3">
            <Gauge size={22} className="text-brand" /> Efficiency
          </h1>
          <p className="text-[13px] text-text3 mt-1 font-medium">One calf a year, milk against target, and where the money goes.</p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1" role="tablist">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-black whitespace-nowrap border transition-colors ${tab === t.key ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom hover:border-brand'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* The milk forecast, expenses and the cost tracker load their own data. */}
        {tab === 'emp' ? <EmpReport />
          : tab === 'expenses' ? <ExpensesTab />
          : tab === 'costs' ? <CostTrackerTab />
          : error ? <div className="py-16 text-center text-danger text-[13px]">{error}</div>
          : !report ? <div className="py-16 text-center text-text3 text-[13px]">Loading…</div>
          : tab === 'reproduction' ? <ReproductionTab report={report} />
          : tab === 'milk' ? <MilkTargetTab report={report} onChanged={loadReport} />
          : tab === 'lactation' ? <LactationTab report={report} />
          : <Overview report={report} expenseTotal={expenseTotal} />}
      </div>
    </AppLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EfficiencyPage />
    </Suspense>
  );
}
