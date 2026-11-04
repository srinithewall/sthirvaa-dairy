'use client';

import React, { useMemo } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

export interface TrackerEntry { category: string; amount: number; date: string; type: 'EXPENSE' | 'INCOME' }
export interface TrackerMilkReceived { month: string; received: number }

/* Categorical slots in fixed order (validated: CVD-safe on the light surface); "Other" is neutral. */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const OTHER = '#c3c2b7';
const MILK = 'MILK_SALES';
const TEXT = '#52514e';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const shiftYm = (ym: string, by: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (ym: string) => new Date(`${ym}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

/**
 * The ledger's cost tracker: the last six months of expense against income (one line chart), where the
 * month's money went (pie of the top 5 categories) and how heavy the expense is against what came in.
 * Income received = milk payments that reached the bank + other income; the estimate uses the AMCS rate.
 */
export default function LedgerCostTracker({ entries, milkReceived, month }: {
  entries: TrackerEntry[]; milkReceived: TrackerMilkReceived[]; month: string;
}) {
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => shiftYm(month, i - 5)), [month]);

  const byMonth = useMemo(() => months.map(m => {
    const inMonth = entries.filter(e => e.date.startsWith(m));
    const expense = inMonth.filter(e => e.type === 'EXPENSE').reduce((t, e) => t + e.amount, 0);
    const other = inMonth.filter(e => e.type === 'INCOME' && e.category !== MILK).reduce((t, e) => t + e.amount, 0);
    const milkEst = inMonth.filter(e => e.type === 'INCOME' && e.category === MILK).reduce((t, e) => t + e.amount, 0);
    const received = other + milkReceived.filter(r => r.month === m).reduce((t, r) => t + r.received, 0);
    return { month: m, expense, estimated: other + milkEst, received };
  }), [entries, milkReceived, months]);

  const now = byMonth[5];
  const prev = byMonth[4];
  const pct = (b: { expense: number; received: number }) => b.received > 0 ? (b.expense / b.received) * 100 : null;
  const expensePct = pct(now);
  const prevPct = pct(prev);
  const change = prev.expense > 0 ? ((now.expense - prev.expense) / prev.expense) * 100 : null;

  const top = useMemo(() => {
    const totals: Record<string, number> = {};
    entries.filter(e => e.type === 'EXPENSE' && e.date.startsWith(month))
      .forEach(e => { totals[e.category.trim()] = (totals[e.category.trim()] || 0) + e.amount; });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const five = sorted.slice(0, 5).map(([name, value], i) => ({ name, value, color: SERIES[i] }));
    const rest = sorted.slice(5).reduce((t, [, v]) => t + v, 0);
    return rest > 0 ? [...five, { name: `Other (${sorted.length - 5})`, value: rest, color: OTHER }] : five;
  }, [entries, month]);

  const tile = 'bg-white border border-border-custom rounded-xl px-4 py-3 text-center';
  const tileLabel = 'text-[10px] font-black text-text3 uppercase tracking-[0.2em]';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={tile} title="Expense as a share of income received this month">
          <div className={tileLabel}>Expense %</div>
          <div className={`text-2xl font-black ${expensePct == null ? 'text-text3' : expensePct > 100 ? 'text-danger' : 'text-brand'}`}>
            {expensePct == null ? '—' : `${Math.round(expensePct)}%`}
          </div>
          <div className="text-[11px] text-text3">
            {expensePct == null ? 'no income received yet' : 'of income received'}
            {prevPct != null && ` · ${Math.round(prevPct)}% in ${monthLabel(prev.month)}`}
          </div>
        </div>
        <div className={tile}>
          <div className={tileLabel}>Expense vs last month</div>
          <div className={`text-2xl font-black ${change == null ? 'text-text3' : change > 0 ? 'text-danger' : 'text-brand'}`}>
            {change == null ? '—' : `${change > 0 ? '▲' : '▼'} ${Math.abs(Math.round(change))}%`}
          </div>
          <div className="text-[11px] text-text3">{rupees(now.expense)} vs {rupees(prev.expense)}</div>
        </div>
        <div className={tile}>
          <div className={tileLabel}>Avg monthly expense</div>
          <div className="text-2xl font-black text-text2">{rupees(byMonth.reduce((t, b) => t + b.expense, 0) / 6)}</div>
          <div className="text-[11px] text-text3">{monthLabel(months[0])} – {monthLabel(month)}</div>
        </div>
      </div>

      <div className="bg-white border border-border-custom rounded-radius-custom-lg p-4">
        <div className="text-[13px] font-black text-text">Expense and income, last 6 months</div>
        <div className="text-[11px] text-text3 mb-2">Income received is what reached the bank; the dashed line is the estimate at the milk rate.</div>
        <div className="h-[260px]">
          <Line
            data={{
              labels: byMonth.map(b => monthLabel(b.month)),
              datasets: [
                { label: 'Expense', data: byMonth.map(b => Math.round(b.expense)), borderColor: SERIES[1], backgroundColor: SERIES[1] },
                { label: 'Income received', data: byMonth.map(b => Math.round(b.received)), borderColor: SERIES[0], backgroundColor: SERIES[0] },
                { label: 'Est. income', data: byMonth.map(b => Math.round(b.estimated)), borderColor: SERIES[2], backgroundColor: SERIES[2], borderDash: [6, 4] },
              ].map(d => ({ ...d, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: '#ffffff', pointBorderWidth: 2, tension: 0.25 })),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, font: { size: 11 }, color: TEXT } },
                tooltip: { callbacks: { label: item => ` ${item.dataset.label}: ${rupees(item.raw as number)}` } },
              },
              scales: {
                x: { grid: { display: false }, ticks: { color: TEXT, font: { size: 11 } } },
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false },
                  ticks: { color: TEXT, font: { size: 11 }, callback: v => rupees(Number(v)) } },
              },
            }}
          />
        </div>
      </div>

      <div className="bg-white border border-border-custom rounded-radius-custom-lg p-4">
        <div className="text-[13px] font-black text-text">Top 5 expense categories · {new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        {top.length === 0 ? (
          <div className="py-10 text-center text-text3 text-[13px]">No expenses this month.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mt-2">
            <div className="h-[220px]">
              <Pie
                data={{
                  labels: top.map(t => t.name),
                  datasets: [{ data: top.map(t => Math.round(t.value)), backgroundColor: top.map(t => t.color), borderColor: '#ffffff', borderWidth: 2 }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: item => ` ${item.label}: ${rupees(item.raw as number)}` } },
                  },
                }}
              />
            </div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-border-custom">
                {top.map(t => (
                  <tr key={t.name}>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-2 text-text font-bold">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />{t.name}
                      </span>
                    </td>
                    <td className="py-2 text-right font-black text-text">{rupees(t.value)}</td>
                    <td className="py-2 pl-3 text-right text-text3 w-12">{now.expense > 0 ? `${Math.round((t.value / now.expense) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
