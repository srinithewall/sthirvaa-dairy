'use client';

import React, { useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  BankTxn, LineType, TYPE_LABEL, TYPES_IN, TYPES_OUT, FIXED_CATEGORY as FIXED, rupees, categoryLabel, partyOf,
  kindForType, typeFromBooking, categoryOptions,
} from '@/lib/bank';
import { AlertCircle, Check, CheckCheck, Link2, MoreHorizontal, Pencil, Repeat, Sparkles } from 'lucide-react';

interface Category { id: number; name: string; type: 'EXPENSE' | 'INCOME' }

function typeOf(t: BankTxn): LineType | '' {
  if (t.status === 'IGNORED') return 'IGNORE';
  if (t.status === 'UNMAPPED') return '';
  return typeFromBooking(t.direction, t.kind, t.category);
}

const dayMonth = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

type Filter = 'ALL' | 'OPEN' | 'OUT' | 'IN';

/**
 * The month's bank lines laid out like the statement - withdrawal, deposit, running balance - with
 * the type and category chosen in the row itself. Anything else about a line (note, cattle or
 * poultry, unmapping) is under its "more" button.
 */
export default function StatementTable({ txns, categories, onUpdated, onReload, onMore, onError }: {
  txns: BankTxn[];
  categories: Category[];
  onUpdated: (t: BankTxn) => void;
  onReload: (message?: string) => void;
  onMore: (t: BankTxn) => void;
  onError: (message: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  /** A type picked that still needs a category before the line can be saved. */
  const [draft, setDraft] = useState<Record<number, LineType>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  const rows = useMemo(() => [...txns].sort((a, b) => a.txnDate.localeCompare(b.txnDate) || a.id - b.id), [txns]);
  const open = (t: BankTxn) => t.status === 'UNMAPPED' || t.status === 'SUGGESTED';
  const shown = rows.filter(t => filter === 'ALL' ? true : filter === 'OPEN' ? open(t)
    : filter === 'OUT' ? t.direction === 'DEBIT' : t.direction === 'CREDIT');
  const suggested = rows.filter(t => t.status === 'SUGGESTED');

  const first = rows.find(t => t.balance != null);
  const opening = first ? first.balance! - (first.direction === 'CREDIT' ? first.amount : -first.amount) : null;
  const closing = [...rows].reverse().find(t => t.balance != null)?.balance ?? null;
  const totalOut = rows.filter(t => t.direction === 'DEBIT').reduce((a, t) => a + t.amount, 0);
  const totalIn = rows.filter(t => t.direction === 'CREDIT').reduce((a, t) => a + t.amount, 0);
  const openCount = rows.filter(open).length;

  const names = (type: 'EXPENSE' | 'INCOME') =>
    [...new Set(categories.filter(c => c.type === type).map(c => c.name))].sort((a, b) => a.localeCompare(b));
  const expenseNames = useMemo(() => names('EXPENSE'), [categories]); // eslint-disable-line react-hooks/exhaustive-deps
  const incomeNames = useMemo(() => names('INCOME'), [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionsFor = (type: LineType | '', current?: string | null) => categoryOptions(type, expenseNames, incomeNames, current);

  const save = async (t: BankTxn, type: LineType, category: string | null, remember = false) => {
    setSaving(s => ({ ...s, [t.id]: true }));
    try {
      const kind = kindForType(type);
      const res = await api.put(`/bank/transactions/${t.id}`, {
        kind, category, segment: t.segment || 'CATTLE', note: t.note, remember, pattern: remember ? t.counterparty : null,
      });
      setDraft(d => { const n = { ...d }; delete n[t.id]; return n; });
      if (remember || res.data.alsoMapped) {
        onReload(res.data.alsoMapped ? `Saved, and ${res.data.alsoMapped} more line(s) from ${t.counterparty} done the same way.` : 'Saved as a rule.');
      } else {
        onUpdated(res.data.transaction);
      }
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not save this line.');
    } finally {
      setSaving(s => ({ ...s, [t.id]: false }));
    }
  };

  const pickType = (t: BankTxn, type: LineType) => {
    if (type === 'IGNORE') return save(t, type, null);
    if (FIXED[type]) return save(t, type, FIXED[type]!);
    const options = optionsFor(type, typeOf(t) === type ? t.category : null);
    // A line already of this type keeps its category; a type with one obvious category saves at once.
    if (typeOf(t) === type && t.category) return save(t, type, t.category);
    if (type === 'SOLD' || type === 'SALARY' || type === 'BANK_CHARGES') return save(t, type, options[0]);
    setDraft(d => ({ ...d, [t.id]: type }));
  };

  const approve = async (ids: number[]) => {
    try {
      const res = await api.post('/bank/transactions/approve', ids);
      onReload(`${res.data.approved} line(s) confirmed.`);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not confirm.');
    }
  };

  const status = (t: BankTxn) => {
    if (t.status === 'UNMAPPED' || draft[t.id]) {
      return <span title={draft[t.id] ? 'Choose a category to save' : t.matchReason || 'Needs your choice'}><AlertCircle size={16} className="text-amber-600" /></span>;
    }
    if (t.status === 'SUGGESTED') {
      return (
        <button onClick={() => approve([t.id])} title={`Suggested (${t.matchReason || 'keyword'}). Click to confirm.`}
          className="p-1 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white"><Check size={14} /></button>
      );
    }
    if (t.ruleId && !t.employee) return <span title={t.matchReason || 'Set by a rule'}><CheckCheck size={16} className="text-brand" /></span>;
    if (t.matchReason?.startsWith('Matches')) return <span title={t.matchReason}><Link2 size={16} className="text-brand" /></span>;
    return <span title={t.matchReason || 'Set by you'}><Pencil size={14} className="text-text3" /></span>;
  };

  const select = 'w-full h-8 text-[12px] bg-white border border-border-custom rounded-md px-1.5 disabled:bg-surface2/60 disabled:text-text3';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2 text-[12px] text-text3">
        <span>{rows.length} line{rows.length === 1 ? '' : 's'}{openCount ? ` · ${openCount} need a type` : ''}</span>
        {suggested.length > 0 && (
          <button onClick={() => approve(suggested.map(t => t.id))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 text-white font-black text-[11px]">
            <Sparkles size={12} /> CONFIRM {suggested.length} SUGGESTED
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5">
          Show
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)} className="h-8 text-[12px] bg-white border border-border-custom rounded-md px-1.5">
            <option value="ALL">All lines</option>
            <option value="OPEN">Needs review ({openCount})</option>
            <option value="OUT">Withdrawals</option>
            <option value="IN">Deposits</option>
          </select>
        </label>
      </div>

      <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow overflow-x-auto">
        <table className="w-full text-[12px] min-w-[860px] table-fixed">
          <colgroup>
            <col className="w-[62px]" /><col /><col className="w-[92px]" /><col className="w-[92px]" /><col className="w-[96px]" />
            <col className="w-[132px]" /><col className="w-[150px]" /><col className="w-[34px]" /><col className="w-[34px]" />
          </colgroup>
          <thead>
            <tr className="text-[10px] font-black text-text3 uppercase tracking-wider border-b border-border-custom bg-surface2/50">
              <th className="text-left px-2 py-2">Date</th>
              <th className="text-left px-2 py-2">Description</th>
              <th className="text-right px-2 py-2">Withdrawal</th>
              <th className="text-right px-2 py-2">Deposit</th>
              <th className="text-right px-2 py-2">Balance</th>
              <th className="text-left px-2 py-2">Type</th>
              <th className="text-left px-2 py-2">Category</th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom">
            {filter === 'ALL' && opening != null && (
              <tr className="text-text3">
                <td className="px-2 py-2" /><td className="px-2 py-2">Opening balance</td><td /><td />
                <td className="px-2 py-2 text-right tabular-nums">{rupees(opening)}</td><td colSpan={4} />
              </tr>
            )}
            {shown.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-10 text-center text-text3 font-bold">
                {rows.length === 0 ? 'No bank lines in this period. Fetch or import a statement.' : 'Nothing to show.'}
              </td></tr>
            )}
            {shown.map(t => {
              const credit = t.direction === 'CREDIT';
              const type = draft[t.id] || typeOf(t);
              const fixed = type && FIXED[type as LineType];
              const options = optionsFor(type, t.category);
              const needsCategory = !!draft[t.id];
              const userSet = t.status === 'MAPPED' && !t.ruleId && !t.matchReason?.startsWith('Matches') && !t.employee;
              return (
                <tr key={t.id} className={open(t) || needsCategory ? 'bg-amber-50/70' : t.status === 'IGNORED' ? 'text-text3' : ''}>
                  <td className="px-2 py-2 font-bold text-text2 whitespace-nowrap">{dayMonth(t.txnDate)}</td>
                  <td className="px-2 py-2 min-w-0">
                    <div className="font-bold text-text truncate" title={partyOf(t)}>
                      {partyOf(t)}
                      {t.employee && <span className="ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface2 text-text2" title="Employee rule: always asked">employee</span>}
                    </div>
                    <div className="text-[11px] text-text3 truncate" title={t.narration || ''}>
                      {[t.mode, t.narration].filter(Boolean).join(' · ')}{t.note ? ` · ${t.note}` : ''}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-danger font-bold">{credit ? '' : rupees(t.amount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand font-bold">{credit ? rupees(t.amount) : ''}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text2">{t.balance != null ? rupees(t.balance) : ''}</td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Type for ${partyOf(t)} on ${dayMonth(t.txnDate)}`} disabled={saving[t.id]}
                      value={type} onChange={e => pickType(t, e.target.value as LineType)} className={select}>
                      {!type && <option value="">Choose…</option>}
                      {(credit ? TYPES_IN : TYPES_OUT).map(k => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    {type === 'IGNORE' || !type ? (
                      <select disabled className={select}><option>—</option></select>
                    ) : fixed ? (
                      <select disabled className={select}><option>{type === 'ADVANCE' ? 'Staff advance' : 'Staff paid cash'}</option></select>
                    ) : (
                      <select aria-label={`Category for ${partyOf(t)} on ${dayMonth(t.txnDate)}`} disabled={saving[t.id]}
                        value={needsCategory ? '' : t.category || ''} onChange={e => e.target.value && save(t, type as LineType, e.target.value)}
                        className={`${select} ${needsCategory ? 'border-amber-500 ring-1 ring-amber-400' : ''}`}>
                        {(needsCategory || !t.category) && <option value="">Choose…</option>}
                        {options.map(n => <option key={n} value={n}>{categoryLabel(n)}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {saving[t.id] ? <span className="inline-block w-3.5 h-3.5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" /> : status(t)}
                  </td>
                  <td className="px-1 py-2 text-center">
                    {userSet && t.counterparty && type && type !== 'IGNORE' ? (
                      <div className="flex flex-col items-center gap-1">
                        <button title={`Always do this for ${t.counterparty}`} onClick={() => save(t, type as LineType, fixed ? FIXED[type as LineType]! : t.category || null, true)}
                          className="p-1 rounded-md text-text3 hover:text-brand hover:bg-surface2"><Repeat size={13} /></button>
                        <button title="Note, cattle or poultry, unmap" onClick={() => onMore(t)}
                          className="p-1 rounded-md text-text3 hover:text-text hover:bg-surface2"><MoreHorizontal size={14} /></button>
                      </div>
                    ) : (
                      <button title="Note, cattle or poultry, unmap" onClick={() => onMore(t)}
                        className="p-1 rounded-md text-text3 hover:text-text hover:bg-surface2"><MoreHorizontal size={14} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filter === 'ALL' && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border-custom bg-surface2/50 font-black text-text">
                <td className="px-2 py-2" /><td className="px-2 py-2">Totals · closing balance</td>
                <td className="px-2 py-2 text-right tabular-nums text-danger">{rupees(totalOut)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-brand">{rupees(totalIn)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{closing != null ? rupees(closing) : ''}</td>
                <td colSpan={4} className="px-2 py-2 text-[11px] font-bold text-amber-700">{openCount ? `${openCount} line(s) need a type` : ''}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-text3">
        <span className="inline-flex items-center gap-1"><CheckCheck size={13} className="text-brand" /> set by a rule</span>
        <span className="inline-flex items-center gap-1"><Link2 size={13} className="text-brand" /> matches a ledger entry</span>
        <span className="inline-flex items-center gap-1"><Pencil size={12} /> set by you</span>
        <span className="inline-flex items-center gap-1"><Check size={13} className="text-sky-700" /> suggested, click to confirm</span>
        <span className="inline-flex items-center gap-1"><AlertCircle size={13} className="text-amber-600" /> needs your choice</span>
        <span className="inline-flex items-center gap-1"><Repeat size={12} /> do the same for this party from now on</span>
      </div>
    </div>
  );
}
