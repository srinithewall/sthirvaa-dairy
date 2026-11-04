'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { rupees } from '@/lib/bank';
import { ChevronDown, Eye, IndianRupee, Receipt, X } from 'lucide-react';

/** Salaries are worked out from this month on. */
export const FIRST_SALARY_MONTH = '2026-09';

interface ExpenseLine {
  id: number;
  date: string;
  category: string | null;
  description: string | null;
  amount: number;
  paidBy: string | null;
}

interface SalaryMonth {
  month: string;
  /** Cattle income booked in the app for the month, as the Digital Ledger's Est. Income card. */
  estIncome: number;
  expenses: number;
  expenseLines: ExpenseLine[];
  profit: number;
  earned: number;
  advanceGiven: number;
  advanceRepaid: number;
  advanceCut: number;
  advanceLeft: number;
  payable: number;
  paidByBank: number;
  balance: number;
  /** The month the salary is paid in (the next one). */
  payMonth: string;
  /** Still running: an estimate, not in the totals. */
  current: boolean;
}

interface Breakdown {
  staffName: string;
  type: 'FIXED' | 'DYNAMIC';
  fixedAmount: number | null;
  sharePercent: number | null;
  bankName: string | null;
  months: SalaryMonth[];
  totals: { upTo: string | null; earned: number; advanceCut: number; payable: number; paidByBank: number; balance: number; advanceLeft: number };
}

/** Rupees with a proper minus sign in front: −₹3,556. */
const signed = (n: number) => (Math.round(n) < 0 ? '−' : '') + rupees(Math.abs(n));

const shortDate = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const monthShort = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long' }).slice(0, 3);

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/**
 * Pop-up: how an employee's salary comes out each month from September, on the farm's records -
 * Est. Income minus cattle expenses, their share, the advance cut - and what the bank shows was paid.
 * The cards at the top are for one month, picked above them (last finished month to start with).
 */
export default function SalaryBreakdown({ staffId, onClose }: { staffId: number; onClose: () => void }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [error, setError] = useState('');
  /** The month whose expenses are open in the second pop-up. */
  const [expensesOf, setExpensesOf] = useState<SalaryMonth | null>(null);
  /** The month the cards at the top are for. */
  const [cardMonth, setCardMonth] = useState<string | null>(null);
  const expensesOpen = useRef(false);
  expensesOpen.current = expensesOf != null;

  useEffect(() => {
    api.get(`/bank/salary-rules/${staffId}/breakdown`, { params: { from: FIRST_SALARY_MONTH } })
      .then(res => {
        const d: Breakdown = res.data;
        setData(d);
        // Newest first: the last finished month, or the running one if none has finished yet.
        setCardMonth((d.months.find(m => !m.current) ?? d.months[0])?.month ?? null);
      })
      .catch(err => setError(err?.response?.data?.message || 'Could not work out the salary.'));
  }, [staffId]);

  useEffect(() => {
    // Escape closes the expense list first, then the salary pop-up.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (expensesOpen.current) setExpensesOf(null); else onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const rule = !data ? '' : data.type === 'FIXED'
    ? `Fixed ${rupees(data.fixedAmount ?? 0)} a month`
    : `${data.sharePercent}% of (Est. Income − expenses)`;

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Salary breakdown">
      <div className="bg-surface2 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-[20px] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="bg-white px-4 py-3 border-b border-border-custom flex items-center gap-2 flex-shrink-0">
          <IndianRupee size={16} className="text-brand flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-black uppercase tracking-widest text-text2 truncate">
              Salary{data ? ` · ${data.staffName}` : ''}
            </div>
            {rule && <div className="text-[11px] text-text3 truncate">{rule}</div>}
          </div>
          <button onClick={onClose} title="Close" aria-label="Close"
            className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-surface2"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-2.5">
          {error && <div className="p-6 text-center text-[13px] text-danger">{error}</div>}
          {!data && !error && <div className="p-6 text-center text-[13px] text-text3">Working it out…</div>}
          {data && <>
            <MonthCards data={data} month={cardMonth} onMonth={setCardMonth} />
            {data.months.map(m => <MonthCard key={m.month} m={m} data={data} onShowExpenses={() => setExpensesOf(m)} />)}
            <p className="text-[11px] text-text3 px-1 pb-1 leading-relaxed">
              From the farm&apos;s records: Est. Income (cattle income booked in the app, as on the Digital Ledger) and the
                cattle expenses there (poultry and unaccounted ones left out).
                {' '}A month&apos;s salary is paid early the next month; the advance cut comes off that payment.
              {data.bankName ? ` Paid by bank: transfers booked as salary to ${data.bankName}.` : ' Set their bank name on the salary rule (Bank → Rules) to see bank payments.'}
            </p>
          </>}
        </div>
      </div>
      {expensesOf && <ExpenseList m={expensesOf} onClose={() => setExpensesOf(null)} />}
    </div>,
    document.body,
  );
}

/** Second pop-up: every expense that made up the month's expenses - description, amount, who paid. */
function ExpenseList({ m, onClose }: { m: SalaryMonth; onClose: () => void }) {
  const byPayer = new Map<string, number>();
  for (const e of m.expenseLines) byPayer.set(e.paidBy || 'Not set', (byPayer.get(e.paidBy || 'Not set') ?? 0) + e.amount);
  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center sm:p-4 bg-black/50"
      onClick={e => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label={`Expenses for ${monthName(m.month)}`}>
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-xl sm:rounded-[20px] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border-custom flex items-center gap-2 flex-shrink-0">
          <Receipt size={16} className="text-danger flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-black uppercase tracking-widest text-text2 truncate">Expenses · {monthName(m.month)}</div>
            <div className="text-[11px] text-text3">{m.expenseLines.length} {m.expenseLines.length === 1 ? 'entry' : 'entries'} · {rupees(m.expenses)}</div>
          </div>
          <button onClick={onClose} title="Close" aria-label="Close the expense list"
            className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-surface2"><X size={20} /></button>
        </div>

        {byPayer.size > 0 && (
          <div className="px-4 py-2 border-b border-border-custom bg-surface2/60 flex flex-wrap gap-x-3 gap-y-1 text-[11px] flex-shrink-0">
            <span className="font-black uppercase tracking-widest text-text3">Paid by</span>
            {[...byPayer.entries()].sort((a, b) => b[1] - a[1]).map(([who, amt]) => (
              <span key={who} className="text-text2"><b className="text-text">{who}</b> {rupees(amt)}</span>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 min-h-0">
          {m.expenseLines.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-text3">No expenses in the ledger this month.</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-border-custom,#e5e7eb)]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-text3">
                  <th className="text-left font-black px-3 sm:px-4 py-2">Description</th>
                  <th className="text-right font-black px-2 py-2">Amount</th>
                  <th className="text-left font-black px-3 sm:px-4 py-2">Paid by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom">
                {m.expenseLines.map(e => (
                  <tr key={e.id} className="align-top">
                    <td className="px-3 sm:px-4 py-2">
                      <div className="font-bold text-text break-words">{e.description || e.category || '—'}</div>
                      <div className="text-[11px] text-text3">{shortDate(e.date)}{e.category && e.description ? ` · ${e.category}` : ''}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-black tabular-nums text-danger whitespace-nowrap">{rupees(e.amount)}</td>
                    <td className="px-3 sm:px-4 py-2 text-text2 break-words">{e.paidBy || <span className="text-text3">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0">
                <tr className="bg-danger/10 text-danger">
                  <td className="px-3 sm:px-4 py-2.5 font-black">Total</td>
                  <td className="px-2 py-2.5 text-right font-black tabular-nums whitespace-nowrap">{rupees(m.expenses)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/** The cards at the top: one month's salary, cut, payable, bank payment, balance and advance left. */
function MonthCards({ data, month, onMonth }: { data: Breakdown; month: string | null; onMonth: (m: string) => void }) {
  const m = data.months.find(x => x.month === month);
  if (!m) return null;
  const cell = (label: string, value: string, tone = 'text-text') => (
    <div className="bg-white rounded-lg border border-border-custom px-2.5 py-2 min-w-0">
      <div className="text-[9px] font-black uppercase tracking-widest text-text3 truncate">{label}</div>
      <div className={`text-[14px] font-black tabular-nums truncate ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div>
      <div className="flex justify-end pb-1.5">
        <select value={m.month} onChange={e => onMonth(e.target.value)} aria-label="Month for the cards"
          className="h-8 bg-white border border-border-custom rounded-lg px-2 text-[12px] font-bold text-text2">
          {data.months.map(x => <option key={x.month} value={x.month}>{monthName(x.month)}{x.current ? ' (estimate)' : ''}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {cell('Salary', rupees(m.earned), 'text-brand')}
        {cell('Advance cut', rupees(m.advanceCut))}
        {cell('Payable', signed(m.payable))}
        {cell('Paid by bank', rupees(m.paidByBank))}
        {cell(m.balance > 0 ? 'Still to pay' : m.balance < 0 ? 'Paid extra' : 'Settled', rupees(Math.abs(m.balance)), m.balance > 0 ? 'text-amber-700' : 'text-text')}
        {cell('Advance left', rupees(m.advanceLeft), m.advanceLeft > 0 ? 'text-danger' : 'text-text')}
      </div>
    </div>
  );
}

function MonthCard({ m, data, onShowExpenses }: { m: SalaryMonth; data: Breakdown; onShowExpenses: () => void }) {
  const [open, setOpen] = useState(m.current);
  const dynamic = data.type === 'DYNAMIC';
  const line = (label: React.ReactNode, value: React.ReactNode, cls = '') => (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${cls}`}>
      <span className="text-text2 min-w-0">{label}</span>
      <span className="tabular-nums font-bold text-right flex-shrink-0">{value}</span>
    </div>
  );
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${m.current ? 'border-brand/40' : 'border-border-custom'}`}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left">
        <ChevronDown size={15} className={`text-text3 flex-shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="flex-1 min-w-0 text-[13px] font-black text-text truncate">
          {monthName(m.month)}
          {m.current && <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 align-middle">estimate</span>}
          <span className="block text-[10px] font-bold text-text3">{m.current ? 'so far · ' : ''}paid in {monthName(m.payMonth)}</span>
        </span>
        <span className="text-right">
          <span className={`block text-[14px] font-black tabular-nums ${m.payable < 0 ? 'text-danger' : 'text-brand'}`}>{m.current ? rupees(Math.max(0, m.payable)) : m.payable < 0 ? `owes ${rupees(-m.payable)}` : rupees(m.payable)}</span>
          {m.paidByBank > 0 && <span className="block text-[10px] text-text3 tabular-nums">paid {rupees(m.paidByBank)} in {monthShort(m.payMonth)}</span>}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-[12px] border-t border-border-custom/60 pt-1.5">
          {dynamic ? <>
            {line('Est. Income', rupees(m.estIncome))}
            {line(
              <span className="inline-flex items-center gap-1">− Expenses
                <button onClick={onShowExpenses} title="See the expenses" aria-label={`See the expenses for ${monthName(m.month)}`}
                  className="p-1 -my-1 rounded-md text-brand hover:bg-brand/10"><Eye size={14} /></button>
              </span>, rupees(m.expenses))}
            {line(m.profit < 0 ? '= Loss' : '= Profit', signed(m.profit), `border-t border-dashed border-border-custom ${m.profit < 0 ? 'text-danger' : ''}`)}
            {line(m.profit < 0 ? 'Share (no share on a loss)' : `× ${data.sharePercent}% share`, rupees(m.earned), 'text-brand')}
          </> : line('Fixed salary', rupees(m.earned), 'text-brand')}
          {m.advanceGiven > 0 && line('Debt', rupees(m.advanceGiven), 'text-text3')}
          {m.advanceRepaid > 0 && line('Advance repaid this month', rupees(m.advanceRepaid), 'text-text3')}
          {(m.advanceCut > 0 || m.advanceLeft > 0) && line(
            <>− Advance cut <span className="text-text3">(from {monthShort(m.payMonth)} pay · left {rupees(m.advanceLeft)})</span></>, rupees(m.advanceCut))}
          {line(m.current ? `= Estimate so far` : m.payable < 0 ? '= Owes the farm' : `= To pay in ${monthShort(m.payMonth)}`,
            m.current ? signed(m.payable) : rupees(Math.abs(m.payable)),
            `border-t border-dashed border-border-custom font-black ${m.payable < 0 ? 'text-danger' : 'text-text'}`)}
          {!m.current && line(`Paid by bank in ${monthShort(m.payMonth)}`, rupees(m.paidByBank))}
          {!m.current && (m.payable > 0 || m.paidByBank > 0) ? line(
            m.balance > 0 ? 'Still to pay' : m.balance < 0 ? 'Paid extra' : 'Settled',
            m.balance === 0 ? '✓' : rupees(Math.abs(m.balance)),
            `font-black ${m.balance > 0 ? 'text-amber-700' : m.balance < 0 ? 'text-text2' : 'text-brand'}`) : null}
        </div>
      )}
    </div>
  );
}
