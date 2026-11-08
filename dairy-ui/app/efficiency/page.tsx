'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gauge, AlertTriangle, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { EffReport, litres, monthsDays, rupees, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow } from '@/components/efficiency/ui';
import ReproductionTab from '@/components/efficiency/ReproductionTab';
import MilkTargetTab from '@/components/efficiency/MilkTargetTab';
import LactationTab from '@/components/efficiency/LactationTab';
import ExpensesTab from '@/components/efficiency/ExpensesTab';
import CostTrackerTab from '@/components/efficiency/CostTrackerTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'reproduction', label: 'Reproduction' },
  { key: 'milk', label: 'Milk target' },
  { key: 'lactation', label: 'Lactation' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'costs', label: 'Cost tracker' },
] as const;
type TabKey = typeof TABS[number]['key'];

function Overview({ report, expenseTotal, go }: { report: EffReport; expenseTotal: number | null; go: (t: TabKey) => void }) {
  const s = summarise(report);
  const flagged = report.cows.filter(c => c.flags.length > 0);
  const rows: { tab: TabKey; title: string; line: string }[] = [
    { tab: 'reproduction', title: 'Reproduction', line: s.repro.cows
        ? `${monthsDays(s.repro.avgDaysOpen)} open on average (target ${monthsDays(report.rules.targetDaysOpen)}) · ${litres(s.repro.milkLost)} of milk a year lost to late calving`
        : 'No cows to score yet' },
    { tab: 'milk', title: 'Milk target', line: `${litres(s.milk.lostPerDay, 1)} a day below target · ${rupees(s.milk.lostPerDay * 30 * report.milkRate)} a month` },
    { tab: 'lactation', title: 'Lactation', line: `On course for ${litres(s.lactation.projected)} of ${litres(s.lactation.estimate)} this lactation` },
  ];
  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Calving efficiency" value={s.repro.efficiency != null ? `${Math.round(s.repro.efficiency)}%` : '—'}
          sub={s.repro.cows ? `${Math.round(s.repro.avgInterval)}-day avg interval · 100% = 365` : undefined}
          tone={s.repro.efficiency != null ? toneOf(s.repro.efficiency) : undefined} />
        <Kpi label="Milk target efficiency" value={s.milk.efficiency != null ? `${Math.round(s.milk.efficiency)}%` : '—'}
          sub={`${litres(s.milk.avg, 1)} of ${litres(s.milk.target)} a day`} tone={s.milk.efficiency != null ? toneOf(s.milk.efficiency) : undefined} />
        <Kpi label="Milk per day · full cycle" value={litres(s.milk.cyclePerDay, 1)}
          sub={`dry days included${report.milkPerDay.last7Avg != null ? ` · last ${report.milkPerDay.days} days ${litres(report.milkPerDay.last7Avg, 1)}` : ''}`} />
        <Kpi label="Total expenses" value={expenseTotal != null ? rupees(expenseTotal) : '…'} sub="all time, incl. unaccounted" />
      </KpiRow>

      <Card className="divide-y divide-border-custom">
        {rows.map(r => (
          <button key={r.tab} type="button" onClick={() => go(r.tab)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-black text-text">{r.title}</div>
              <div className="text-[12px] text-text3">{r.line}</div>
            </div>
            <ChevronRight size={16} className="text-text3 flex-shrink-0" />
          </button>
        ))}
      </Card>

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

  useEffect(() => {
    api.get('/reports/efficiency').then(r => setReport(r.data)).catch(() => setError("Couldn't load the efficiency report. Try again."));
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

        {/* Expenses and the cost tracker load their own data from the ledger. */}
        {tab === 'expenses' ? <ExpensesTab />
          : tab === 'costs' ? <CostTrackerTab />
          : error ? <div className="py-16 text-center text-danger text-[13px]">{error}</div>
          : !report ? <div className="py-16 text-center text-text3 text-[13px]">Loading…</div>
          : tab === 'reproduction' ? <ReproductionTab report={report} />
          : tab === 'milk' ? <MilkTargetTab report={report} />
          : tab === 'lactation' ? <LactationTab report={report} />
          : <Overview report={report} expenseTotal={expenseTotal} go={go} />}
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
