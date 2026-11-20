'use client';

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export interface TrackerEntry { category: string; amount: number; date: string; type: 'EXPENSE' | 'INCOME' }
export interface TrackerMilkReceived { month: string; received: number }

/* Categorical slots in fixed order (validated: CVD-safe on the light surface). */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
const MILK = 'MILK_SALES';
const TEXT = '#52514e';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const shiftYm = (ym: string, by: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (ym: string) => new Date(`${ym}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

/** Pass as `month` for every month on record instead of one. */
export const ALL_MONTHS = 'ALL';

/**
 * The cost tracker: the last six months of expense against income, as one line chart. With ALL_MONTHS
 * the line runs from the first month on record to this month. Where the money went is on the
 * Efficiency screen's Expenses tab.
 * Income received = milk payments that reached the bank + other income; the estimate uses the AMCS rate.
 * Months before the first milk payment in the bank feed have no bank record, so received = the estimate there.
 */
export default function LedgerCostTracker({ entries, milkReceived, month }: {
  entries: TrackerEntry[]; milkReceived: TrackerMilkReceived[]; month: string;
}) {
  const all = month === ALL_MONTHS;
  const months = useMemo(() => {
    if (!all) return Array.from({ length: 6 }, (_, i) => shiftYm(month, i - 5));
    const d = new Date();
    const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const first = entries.map(e => e.date.substring(0, 7)).sort()[0] ?? thisMonth;
    const out: string[] = [];
    for (let m = first; m <= thisMonth; m = shiftYm(m, 1)) out.push(m);
    return out;
  }, [all, month, entries]);

  // First month the bank feed has a milk payment for; earlier months fall back to the estimate.
  const bankFrom = useMemo(() => milkReceived.map(r => r.month).sort()[0] ?? null, [milkReceived]);

  const byMonth = useMemo(() => months.map(m => {
    const inMonth = entries.filter(e => e.date.startsWith(m));
    const expense = inMonth.filter(e => e.type === 'EXPENSE').reduce((t, e) => t + e.amount, 0);
    const other = inMonth.filter(e => e.type === 'INCOME' && e.category !== MILK).reduce((t, e) => t + e.amount, 0);
    const milkEst = inMonth.filter(e => e.type === 'INCOME' && e.category === MILK).reduce((t, e) => t + e.amount, 0);
    const received = bankFrom == null || m < bankFrom ? other + milkEst
      : other + milkReceived.filter(r => r.month === m).reduce((t, r) => t + r.received, 0);
    return { month: m, expense, estimated: other + milkEst, received };
  }), [entries, milkReceived, months, bankFrom]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-border-custom rounded-radius-custom-lg p-4">
        <div className="text-[13px] font-black text-text mb-2">Expense and income, {all ? `${months.length} months` : 'last 6 months'}</div>
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
    </div>
  );
}
