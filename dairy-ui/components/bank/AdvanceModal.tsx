'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { rupees } from '@/lib/bank';
import { Plus, Trash2, X } from 'lucide-react';

export interface PlanCut { month: string; amount: number }
export interface AdvanceEntry {
  id: number; date: string; type: 'GIVEN' | 'REPAID'; amount: number; terms?: number | null; startMonth?: string | null;
  mode?: 'CASH' | 'BANK' | null; note?: string | null; monthlyCut?: number | null; plan?: PlanCut[];
}

const nextMonth = (ym: string, n = 1) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const today = () => new Date().toISOString().slice(0, 10);

/** Equal cuts of amount over `months` from start, the last taking what is left - as the server does. */
export function evenPlan(amount: number, months: number, start: string): PlanCut[] {
  if (!(amount > 0) || !(months > 0) || !start) return [];
  const total = Math.round(amount);
  const each = Math.round(total / months);
  return Array.from({ length: months }, (_, i) => ({
    month: nextMonth(start, i),
    amount: i === months - 1 ? total - each * (months - 1) : each,
  }));
}

const field = 'w-full h-10 bg-surface2 border border-border-custom rounded-lg px-3 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60';
const label = 'block text-[10px] font-black text-text3 uppercase tracking-widest mb-1';

/**
 * Add or change an advance (and how it is cut back, month by month) or a repayment. The cuts
 * start as equal amounts; any month can be changed, added or removed, as long as they add up to
 * the advance.
 */
export default function AdvanceModal({ employees, staffId: fixedStaff, entry, type: startType = 'GIVEN', owed, onClose, onSaved, onError }: {
  employees: { id: number; name: string }[];
  /** Fixed employee (from their advance account, or when changing an entry). */
  staffId?: number;
  /** The entry being changed; none for a new one. */
  entry?: AdvanceEntry;
  type?: 'GIVEN' | 'REPAID';
  /** What they owe now, for a repayment. */
  owed?: number;
  onClose: () => void;
  onSaved: (message: string, staffId: number) => void;
  onError: (message: string) => void;
}) {
  const editing = !!entry;
  const [staffId, setStaffId] = useState<number | ''>(fixedStaff ?? (employees.length === 1 ? employees[0].id : ''));
  const [type, setType] = useState<'GIVEN' | 'REPAID'>(entry?.type ?? startType);
  const [date, setDate] = useState(entry?.date ?? today());
  const [amount, setAmount] = useState(entry ? String(Math.round(entry.amount)) : '');
  const [mode, setMode] = useState<'CASH' | 'BANK'>(entry?.mode ?? 'CASH');
  const [note, setNote] = useState(entry?.note ?? '');
  const firstPlan = entry?.plan ?? [];
  const [start, setStart] = useState(firstPlan[0]?.month ?? entry?.startMonth ?? (entry?.date ?? today()).slice(0, 7));
  const [months, setMonths] = useState(String(firstPlan.length || entry?.terms || ''));
  const [plan, setPlan] = useState<PlanCut[]>(firstPlan);
  /** Once a cut is changed by hand, amount / start / months no longer redo the plan by themselves. */
  const [handEdited, setHandEdited] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fresh plan from amount, first month and months, until a cut is changed by hand.
  useEffect(() => {
    if (type !== 'GIVEN' || handEdited) return;
    setPlan(evenPlan(Number(amount), Number(months), start));
  }, [amount, months, start, type, handEdited]);

  const total = Math.round(Number(amount) || 0);
  const planned = useMemo(() => plan.reduce((a, c) => a + (Number(c.amount) || 0), 0), [plan]);
  const diff = total - planned;
  const name = employees.find(e => e.id === staffId)?.name ?? '';

  const setCut = (i: number, value: string) => {
    setHandEdited(true);
    setPlan(p => p.map((c, j) => j === i ? { ...c, amount: value === '' ? 0 : Math.max(0, Math.round(Number(value))) } : c));
  };
  const addMonth = () => {
    setHandEdited(true);
    setPlan(p => [...p, { month: p.length ? nextMonth(p[p.length - 1].month) : start, amount: Math.max(0, diff) }]);
    setMonths(String(plan.length + 1));
  };
  const removeMonth = (i: number) => {
    setHandEdited(true);
    setPlan(p => p.filter((_, j) => j !== i));
    setMonths(String(plan.length - 1));
  };
  const spreadEvenly = () => {
    setHandEdited(false);
    setPlan(evenPlan(total, Number(months) || plan.length, start));
  };
  /** Put what is left (or too much) into the months after the last one changed: keeps the earlier cuts. */
  const fixLast = () => {
    if (!plan.length) return;
    setHandEdited(true);
    setPlan(p => p.map((c, j) => j === p.length - 1 ? { ...c, amount: Math.max(0, c.amount + diff) } : c));
  };

  const firstCutBeforeGiven = type === 'GIVEN' && plan.some(c => c.amount > 0 && c.month < date.slice(0, 7));
  const tooMuchRepaid = type === 'REPAID' && owed != null && total > owed + (editing && entry?.type === 'REPAID' ? Math.round(entry.amount) : 0);
  const canSave = staffId !== '' && total > 0 && !!date && !saving
    && (type === 'REPAID' ? !tooMuchRepaid : plan.length > 0 && diff === 0 && !firstCutBeforeGiven);

  const save = async () => {
    if (staffId === '') return;
    setSaving(true);
    const body = type === 'GIVEN'
      ? { type, date, amount: total, mode, note, plan }
      : { type, date, amount: total, mode, note };
    try {
      if (editing) await api.put(`/bank/salary-rules/${staffId}/advances/${entry!.id}`, body);
      else await api.post(`/bank/salary-rules/${staffId}/advances`, body);
      onSaved(editing
        ? `${type === 'GIVEN' ? 'Advance' : 'Repayment'} for ${name} updated.`
        : type === 'GIVEN' ? `Advance of ${rupees(total)} added for ${name}.` : `Repayment of ${rupees(total)} recorded for ${name}.`, staffId);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? 'Change advance' : 'New advance'}>
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-[20px] overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 bg-brand text-white flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0 font-extrabold uppercase tracking-widest text-[13px] truncate">
            {editing ? `Change ${type === 'GIVEN' ? 'advance' : 'repayment'}` : type === 'GIVEN' ? 'New advance' : 'Repayment'}
            {name && fixedStaff ? ` · ${name}` : ''}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-3">
          {!fixedStaff && (
            <div>
              <label className={label}>Employee</label>
              <select value={staffId} onChange={e => setStaffId(e.target.value ? Number(e.target.value) : '')} className={field}>
                <option value="">Choose…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <p className="text-[11px] text-text3 mt-1">Employees with a salary rule; the cuts come off that salary.</p>
            </div>
          )}

          {!editing && (
            <div className="grid grid-cols-2 gap-2">
              {(['GIVEN', 'REPAID'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`h-10 rounded-lg border text-[12px] font-black ${type === t ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                  {t === 'GIVEN' ? 'Advance given' : 'Paid back'}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>{type === 'GIVEN' ? 'Given on' : 'Paid on'}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Amount (₹)</label>
              <input type="number" min="1" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Paid in</label>
              <select value={mode} onChange={e => setMode(e.target.value as 'CASH' | 'BANK')} className={field}>
                <option value="CASH">Cash</option><option value="BANK">Bank</option>
              </select>
            </div>
            <div>
              <label className={label}>Note</label>
              <input value={note} onChange={e => setNote(e.target.value)} className={field} />
            </div>
          </div>
          {type === 'REPAID' && owed != null && (
            <p className={`text-[12px] ${tooMuchRepaid ? 'text-danger' : 'text-text3'}`}>
              {tooMuchRepaid ? 'More than is owed. ' : ''}Owed now {rupees(owed + (editing && entry?.type === 'REPAID' ? Math.round(entry.amount) : 0))}.
            </p>
          )}

          {type === 'GIVEN' && (
            <div className="border-t border-border-custom pt-3">
              <div className="text-[11px] font-black text-text2 uppercase tracking-widest mb-2">Monthly cuts</div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className={label}>First cut</label>
                  <input type="month" value={start} onChange={e => {
                    const v = e.target.value; if (!v) return;
                    setStart(v);
                    // keep each cut, move them all to start from the new month
                    if (handEdited) setPlan(p => p.map((c, i) => ({ ...c, month: nextMonth(v, i) })));
                  }} className={field} />
                </div>
                <div>
                  <label className={label}>Months</label>
                  <input type="number" min="1" max="120" inputMode="numeric" value={months}
                    onChange={e => setMonths(e.target.value)} className={field} />
                </div>
                <button type="button" onClick={spreadEvenly} disabled={!(total > 0) || !(Number(months) > 0)}
                  title="Equal cuts over the months" className="h-10 px-3 rounded-lg border border-border-custom text-[11px] font-black text-text2 disabled:opacity-40">
                  EVEN
                </button>
              </div>

              {plan.length > 0 && (
                <div className="mt-3 border border-border-custom rounded-lg overflow-hidden">
                  <div className="max-h-[38vh] sm:max-h-[300px] overflow-y-auto divide-y divide-border-custom">
                    {plan.map((c, i) => (
                      <div key={c.month} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="w-6 text-[11px] text-text3 tabular-nums">{i + 1}</span>
                        <span className="flex-1 text-[13px] font-bold text-text">{monthLabel(c.month)}</span>
                        <input type="number" min="0" inputMode="numeric" value={c.amount} aria-label={`Cut for ${monthLabel(c.month)}`}
                          onChange={e => setCut(i, e.target.value)}
                          className="w-28 h-9 bg-surface2 border border-border-custom rounded-lg px-2 text-right text-[13px] font-bold tabular-nums" />
                        <button onClick={() => removeMonth(i)} title="Remove this month" aria-label={`Remove ${monthLabel(c.month)}`}
                          className="p-1.5 rounded text-text3 hover:text-danger"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className={`px-3 py-2 flex flex-wrap items-center gap-2 text-[12px] border-t border-border-custom ${diff === 0 ? 'bg-brand/5' : 'bg-amber-50'}`}>
                    <span className="font-black text-text">Total {rupees(planned)}</span>
                    {diff === 0
                      ? <span className="text-brand font-bold">= advance ✓</span>
                      : <span className="text-amber-800 font-bold">{diff > 0 ? `${rupees(diff)} still to plan` : `${rupees(-diff)} too much`}</span>}
                    <span className="ml-auto flex gap-1.5">
                      {diff !== 0 && (
                        <button onClick={fixLast} className="h-8 px-2.5 rounded-lg bg-white border border-border-custom text-[11px] font-black text-text2">
                          {diff > 0 ? 'ADD TO LAST' : 'TAKE FROM LAST'}
                        </button>
                      )}
                      <button onClick={addMonth} className="h-8 px-2.5 rounded-lg bg-white border border-border-custom text-[11px] font-black text-text2 inline-flex items-center gap-1">
                        <Plus size={12} /> MONTH
                      </button>
                    </span>
                  </div>
                </div>
              )}
              {firstCutBeforeGiven && <p className="text-[12px] text-danger mt-2">A cut is before the month the advance was given.</p>}
              <p className="text-[11px] text-text3 mt-2">
                A month&apos;s cut comes off that month&apos;s salary, paid early the next month. Set 0 to skip a month.
              </p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border-custom flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="h-11 px-4 rounded-lg border border-border-custom text-text2 text-[12px] font-black">CANCEL</button>
          <button onClick={save} disabled={!canSave}
            className="flex-1 h-11 rounded-lg bg-brand text-white text-[13px] font-black disabled:opacity-40">
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
