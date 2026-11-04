'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { rupees } from '@/lib/bank';
import { ChevronDown, Edit2, Plus, Trash2, X } from 'lucide-react';
import AdvanceModal, { AdvanceEntry } from '@/components/bank/AdvanceModal';

interface StaffOption { id: number; name: string; salary?: number | null }
interface SalaryRule {
  staffId: number; staffName: string; type: 'FIXED' | 'DYNAMIC';
  fixedAmount?: number | null; sharePercent?: number | null;
  /** Salary the audit report shows every month, and the words that find their bank lines. */
  auditAmount?: number | null; bankName?: string | null;
}
/** The advance account up to a month: given and recovered (cuts + repayments) so far, and what is left. */
interface AdvanceTotals { upTo: string; given: number; repaid: number; cut: number; recovered: number; left: number; monthsLeft: number }
interface CalcRow extends SalaryRule { earned: number; advanceCut: number; advanceLeft: number; advance: AdvanceTotals; payable: number }
/** What the advance pop-up is open for: a new advance (any employee, or one), a repayment, or a change. */
interface AdvanceForm { staffId?: number; entry?: AdvanceEntry; type?: 'GIVEN' | 'REPAID'; owed?: number }
interface ScheduleRow { month: string; given: number; repaid: number; planned: number; cut: number; left: number }
interface Calc { month: string; milkReceived: number; expenses: number; profit: number; rows: CalcRow[] }

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (ym: string) => new Date(`${ym}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
const signed = (n: number) => `${n < 0 ? '−' : ''}${rupees(Math.abs(n))}`;
const input = 'w-full h-10 bg-surface2 border border-border-custom rounded-lg px-3 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-brand/30';
const label = 'block text-[11px] font-black text-text3 uppercase tracking-widest mb-1';

/**
 * Salary per employee: a fixed amount, or (dynamic) a share of the dairy's profit for the month,
 * milk payments received in the bank minus cattle expenses. An advance comes off in monthly cuts,
 * equal to start with and each month changeable (AdvanceModal).
 */
export default function SalaryRules({ onSaved, onError }: { onSaved: (message: string) => void; onError: (message: string) => void }) {
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [month, setMonth] = useState(thisMonth());
  const [calc, setCalc] = useState<Calc | null>(null);
  const [editing, setEditing] = useState<Partial<SalaryRule> | null>(null);
  /** Whose advance account is open. */
  const [openAdvance, setOpenAdvance] = useState<number | null>(null);
  const [advanceForm, setAdvanceForm] = useState<AdvanceForm | null>(null);
  /** Bumped after an advance is saved, so the open account reloads. */
  const [advanceVersion, setAdvanceVersion] = useState(0);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([
        api.get('/bank/salary-rules'),
        api.get('/bank/salary-rules/calculate', { params: { month } }),
      ]);
      setRules(r.data.rules);
      setStaff(r.data.staff);
      setCalc(c.data);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not load salary rules.');
    }
  };
  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (r: SalaryRule) => {
    if (!window.confirm(`Remove the salary rule for ${r.staffName}?`)) return;
    try {
      await api.delete(`/bank/salary-rules/${r.staffId}`);
      onSaved(`Salary rule for ${r.staffName} removed.`);
      load();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not remove the rule.');
    }
  };

  const rows = calc?.rows ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2 px-1">
        <div className="text-[12px] font-black text-text2 uppercase tracking-widest">Salary calculation ({rules.length})</div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)}
            className="h-9 bg-white border border-border-custom rounded-lg px-2 text-[12px] font-bold text-text2" aria-label="Month" />
          <button onClick={() => setAdvanceForm({})} disabled={rules.length === 0} title="Give an employee an advance"
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-white border border-border-custom text-text2 text-[12px] font-black disabled:opacity-40">
            <Plus size={14} /> ADVANCE
          </button>
          <button onClick={() => setEditing({ type: 'DYNAMIC', sharePercent: 50 })}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-brand text-white text-[12px] font-black">
            <Plus size={14} /> RULE
          </button>
        </div>
      </div>

      {calc && (
        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
          {([['Milk received', calc.milkReceived], ['Cattle expenses', calc.expenses], ['Profit', calc.profit]] as const).map(([name, v]) => (
            <div key={name} className="bg-white border border-border-custom rounded-lg px-2 py-2">
              <div className="text-[10px] font-black text-text3 uppercase tracking-widest">{name}</div>
              <div className={`text-[15px] font-black ${name === 'Profit' && v < 0 ? 'text-danger' : 'text-text'}`}>{signed(v)}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-radius-custom-lg border border-border-custom p-8 text-center text-text3 text-[13px]">
          No salary rules yet. Use <b>Add</b> to set a fixed salary, or a share of the dairy&apos;s profit, for an employee.
        </div>
      ) : (
        <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow divide-y divide-border-custom">
          {rows.map(r => (
            <React.Fragment key={r.staffId}>
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-black text-text text-[14px]">
                  {r.staffName}
                  <span className="ml-2 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface2 text-text2">{r.type === 'FIXED' ? 'Fixed' : 'Dynamic'}</span>
                </div>
                <div className="text-[12px] text-text3">
                  {r.type === 'FIXED' ? `${rupees(r.fixedAmount || 0)} a month` : `(Milk received − Expenses) × ${r.sharePercent}%`}
                  {r.auditAmount ? ` · audit report shows ${rupees(r.auditAmount)} a month` : ''}
                </div>
                <div className="text-[12px] text-text2 mt-1">
                  {monthLabel(month)}: {r.type === 'FIXED' ? 'Salary' : 'Share'} <b>{rupees(r.earned)}</b>
                  {r.advanceCut > 0 && <> − advance cut <b>{rupees(r.advanceCut)}</b></>}
                </div>
                {r.advance.given > 0 && (
                  <button onClick={() => setOpenAdvance(v => v === r.staffId ? null : r.staffId)}
                    className="mt-1.5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-text2 hover:text-text">
                    <span className="font-black text-text3 uppercase tracking-widest text-[10px]">Advance</span>
                    <span>given <b>{rupees(r.advance.given)}</b></span>
                    <span className="text-brand">recovered <b>{rupees(r.advance.recovered)}</b></span>
                    <span className="text-danger">left <b>{rupees(r.advance.left)}</b></span>
                    {r.advance.left > 0 && <span className="text-text3">· {r.advance.monthsLeft} more month{r.advance.monthsLeft === 1 ? '' : 's'}</span>}
                    <ChevronDown size={14} className={`transition-transform ${openAdvance === r.staffId ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 sm:text-right">
                <div>
                  <div className={`text-[18px] font-black ${r.payable < 0 ? 'text-danger' : 'text-brand'}`}>{signed(r.payable)}</div>
                  <div className="text-[10px] font-black text-text3 uppercase tracking-widest">{r.payable < 0 ? 'Owes the farm' : 'Payable'}</div>
                </div>
                <button title="Edit" onClick={() => setEditing(r)} className="p-2 rounded-lg text-text3 hover:text-brand hover:bg-surface2"><Edit2 size={16} /></button>
                <button title="Remove" onClick={() => remove(r)} className="p-2 rounded-lg text-text3 hover:text-danger hover:bg-surface2"><Trash2 size={16} /></button>
              </div>
              {r.advance.given === 0 && (
                <button onClick={() => setOpenAdvance(v => v === r.staffId ? null : r.staffId)}
                  className="sm:hidden text-[12px] text-brand font-bold text-left">Advance account</button>
              )}
              {r.advance.given === 0 && (
                <button onClick={() => setOpenAdvance(v => v === r.staffId ? null : r.staffId)}
                  className="hidden sm:inline text-[12px] text-brand font-bold">Advance account</button>
              )}
            </div>
            {openAdvance === r.staffId && (
              <AdvancePanel staffId={r.staffId} month={month} version={advanceVersion} onError={onError}
                onOpen={f => setAdvanceForm({ ...f, staffId: r.staffId })}
                onChanged={msg => { onSaved(msg); load(); }} />
            )}
            </React.Fragment>
          ))}
        </div>
      )}

      {advanceForm && (
        <AdvanceModal employees={rules.map(r => ({ id: r.staffId, name: r.staffName }))}
          staffId={advanceForm.staffId} entry={advanceForm.entry} type={advanceForm.type} owed={advanceForm.owed}
          onClose={() => setAdvanceForm(null)} onError={onError}
          onSaved={(msg, staffId) => {
            setAdvanceForm(null);
            setOpenAdvance(staffId);
            setAdvanceVersion(v => v + 1);
            onSaved(msg);
            load();
          }} />
      )}

      {editing && (
        <SalaryRuleModal rule={editing} staff={staff.filter(s => s.id === editing.staffId || !rules.some(r => r.staffId === s.id))}
          onClose={() => setEditing(null)} onError={onError}
          onSaved={msg => { setEditing(null); onSaved(msg); load(); }} />
      )}
    </div>
  );
}

function SalaryRuleModal({ rule, staff, onClose, onSaved, onError }: {
  rule: Partial<SalaryRule>; staff: StaffOption[]; onClose: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const isNew = rule.staffId == null;
  const [staffId, setStaffId] = useState<number | ''>(rule.staffId ?? '');
  const [type, setType] = useState<'FIXED' | 'DYNAMIC'>(rule.type || 'DYNAMIC');
  const [fixed, setFixed] = useState(String(rule.fixedAmount ?? staff.find(s => s.id === rule.staffId)?.salary ?? ''));
  const [share, setShare] = useState(String(rule.sharePercent ?? 50));
  const [auditAmount, setAuditAmount] = useState(rule.auditAmount ? String(rule.auditAmount) : '');
  const [bankName, setBankName] = useState(rule.bankName || '');
  const [saving, setSaving] = useState(false);

  const name = staff.find(s => s.id === staffId)?.name || rule.staffName;

  const save = async () => {
    if (staffId === '') return onError('Choose an employee');
    setSaving(true);
    try {
      await api.put(`/bank/salary-rules/${staffId}`, {
        type, fixedAmount: type === 'FIXED' ? fixed : null, sharePercent: type === 'DYNAMIC' ? share : null,
        auditAmount: auditAmount || null, bankName: bankName || null,
      });
      onSaved(`Salary rule for ${name} saved.`);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not save the rule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[20px] overflow-hidden shadow-2xl">
        <div className="px-5 py-4 bg-brand text-white flex items-center justify-between">
          <div className="font-extrabold uppercase tracking-widest">{isNew ? 'New salary rule' : name}</div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4">
          {isNew && (
            <div>
              <label className={label}>Employee</label>
              <select value={staffId} onChange={e => {
                const id = e.target.value ? Number(e.target.value) : '';
                setStaffId(id);
                const salary = staff.find(s => s.id === id)?.salary;
                if (salary && !fixed) setFixed(String(salary));
              }} className={input}>
                <option value="">Choose...</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={label}>Salary type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['FIXED', 'DYNAMIC'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`h-10 rounded-lg border text-[12px] font-black ${type === t ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                  {t === 'FIXED' ? 'Fixed' : 'Dynamic'}
                </button>
              ))}
            </div>
          </div>

          {type === 'FIXED' ? (
            <div>
              <label className={label}>Fixed salary per month (₹)</label>
              <input type="number" min="0" value={fixed} onChange={e => setFixed(e.target.value)} className={input} />
            </div>
          ) : (
            <div>
              <label className={label}>Share of profit (%)</label>
              <input type="number" min="1" max="100" value={share} onChange={e => setShare(e.target.value)} className={input} />
              <p className="text-[11px] text-text3 mt-1">
                (Milk received − Expenses) × {share || 0}%. Milk received is the society&apos;s payments credited to the bank in
                the month; expenses are the month&apos;s cattle expenses in the Digital Ledger. A loss month gives no share.
              </p>
            </div>
          )}

          <div className="border-t border-border-custom pt-4 space-y-3">
            <div>
              <label className={label}>Salary in the audit report (₹ a month, optional)</label>
              <input type="number" min="0" value={auditAmount} onChange={e => setAuditAmount(e.target.value)} className={input} placeholder="20000" />
              <p className="text-[11px] text-text3 mt-1">The audit package shows this as their salary every month, whatever the rule above works out to.</p>
            </div>
            {auditAmount && (
              <div>
                <label className={label}>Name in the bank narration</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} className={`${input} uppercase`} placeholder="LOKESH G" />
                <p className="text-[11px] text-text3 mt-1">Their bank transfers typed <b>Salary</b> then count as paying this salary, not as a second salary.</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-text3 border-t border-border-custom pt-3">
            Advances and repayments are kept in the employee&apos;s <b>Advance account</b>, under their name in the list.
          </p>

          <button onClick={save} disabled={saving || staffId === '' || (!!auditAmount && !bankName.trim())}
            className="w-full h-12 rounded-lg bg-brand text-white font-black disabled:opacity-40">
            {saving ? 'SAVING...' : 'SAVE RULE'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One employee's advance account: what was given and recovered, what is left, every advance and
 * repayment, and the month-by-month cuts. Months up to the selected one count as recovered.
 */
function AdvancePanel({ staffId, month, version, onOpen, onChanged, onError }: {
  staffId: number; month: string; version: number;
  onOpen: (form: AdvanceForm) => void; onChanged: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [data, setData] = useState<{ entries: AdvanceEntry[]; schedule: ScheduleRow[]; totals: AdvanceTotals } | null>(null);

  const load = async () => {
    try {
      setData((await api.get(`/bank/salary-rules/${staffId}/advances`, { params: { month } })).data);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not load the advance account.');
    }
  };
  useEffect(() => { load(); }, [staffId, month, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (e: AdvanceEntry) => {
    if (!window.confirm(`Delete this ${e.type === 'GIVEN' ? 'advance' : 'repayment'} of ${rupees(e.amount)}?`)) return;
    try {
      await api.delete(`/bank/salary-rules/${staffId}/advances/${e.id}`);
      await load();
      onChanged('Deleted.');
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not delete.');
    }
  };

  if (!data) return <div className="px-4 py-6 text-center text-text3 text-[12px] bg-surface2/40">Loading…</div>;
  const t = data.totals;
  const cell = 'px-2 py-1.5 text-right tabular-nums';

  return (
    <div className="bg-surface2/40 px-3 sm:px-4 py-4 space-y-4 border-t border-border-custom">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {([
          ['Given', t.given, 'text-text'],
          ['Recovered', t.recovered, 'text-brand'],
          ['Left', t.left, t.left > 0 ? 'text-danger' : 'text-brand'],
          ['Months to go', t.monthsLeft, 'text-text'],
        ] as const).map(([k, v, tone]) => (
          <div key={k} className="bg-white border border-border-custom rounded-lg px-2 py-2">
            <div className="text-[10px] font-black text-text3 uppercase tracking-widest">{k}</div>
            <div className={`text-[16px] font-black ${tone}`}>{k === 'Months to go' ? v : rupees(v)}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-text3 -mt-2">
        Up to {monthLabel(t.upTo)}. Recovered = salary cuts {rupees(t.cut)}{t.repaid ? ` + paid back ${rupees(t.repaid)}` : ''}.
      </p>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="text-[11px] font-black text-text2 uppercase tracking-widest mr-auto">Advances and repayments</div>
          <button onClick={() => onOpen({ type: 'GIVEN' })} className="h-8 px-3 rounded-lg bg-white border border-border-custom text-[11px] font-black text-text2">+ ADVANCE</button>
          <button onClick={() => onOpen({ type: 'REPAID', owed: t.left })} disabled={t.left <= 0}
            className="h-8 px-3 rounded-lg bg-white border border-border-custom text-[11px] font-black text-text2 disabled:opacity-40">+ REPAYMENT</button>
        </div>
        <div className="bg-white border border-border-custom rounded-lg divide-y divide-border-custom">
          {data.entries.length === 0 && <div className="px-3 py-4 text-center text-text3 text-[12px]">No advances yet.</div>}
          {data.entries.map(e => (
            <div key={e.id} className="px-3 py-2 flex items-center gap-3 text-[12px]">
              <span className="w-20 font-bold text-text2">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${e.type === 'GIVEN' ? 'bg-amber-100 text-amber-800' : 'bg-brand/10 text-brand'}`}>
                {e.type === 'GIVEN' ? 'ADVANCE' : 'REPAID'}
              </span>
              <span className="flex-1 min-w-0 text-text3 truncate">
                {e.type === 'GIVEN'
                  ? `${e.plan?.length ?? e.terms} months from ${monthLabel(e.startMonth!)}, ${e.monthlyCut != null ? `${rupees(e.monthlyCut)}/month` : 'cuts vary'}`
                  : 'paid back'}
                {e.mode ? ` · ${e.mode === 'CASH' ? 'cash' : 'bank'}` : ''}{e.note ? ` · ${e.note}` : ''}
              </span>
              <span className={`font-black ${e.type === 'GIVEN' ? 'text-danger' : 'text-brand'}`}>{e.type === 'GIVEN' ? '' : '−'}{rupees(e.amount)}</span>
              <button title="Change" aria-label="Change" onClick={() => onOpen({ entry: e, owed: t.left })} className="p-1 rounded text-text3 hover:text-brand"><Edit2 size={14} /></button>
              <button title="Delete" aria-label="Delete" onClick={() => remove(e)} className="p-1 rounded text-text3 hover:text-danger"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {data.schedule.length > 0 && (
        <div>
          <div className="text-[11px] font-black text-text2 uppercase tracking-widest mb-1.5">Month by month</div>
          <div className="bg-white border border-border-custom rounded-lg overflow-x-auto">
            <table className="w-full text-[12px] min-w-[480px]">
              <thead>
                <tr className="text-[10px] font-black text-text3 uppercase tracking-wider border-b border-border-custom">
                  <th className="px-2 py-1.5 text-left">Month</th><th className="px-2 py-1.5 text-right">Advance</th>
                  <th className="px-2 py-1.5 text-right">Paid back</th><th className="px-2 py-1.5 text-right">Salary cut</th>
                  <th className="px-2 py-1.5 text-right">Left</th><th className="px-2 py-1.5 text-left" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom">
                {data.schedule.map(r => {
                  const done = r.month <= t.upTo;
                  return (
                    <tr key={r.month} className={r.month === t.upTo ? 'bg-sky-50' : done ? '' : 'text-text3'}>
                      <td className="px-2 py-1.5 font-bold">{monthLabel(r.month)}</td>
                      <td className={cell}>{r.given ? rupees(r.given) : ''}</td>
                      <td className={cell}>{r.repaid ? rupees(r.repaid) : ''}</td>
                      <td className={cell}>{r.cut ? rupees(r.cut) : ''}</td>
                      <td className={`${cell} font-bold`}>{rupees(r.left)}</td>
                      <td className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider">
                        {r.month === t.upTo ? <span className="text-sky-700">this month</span> : done ? <span className="text-brand">done</span> : 'planned'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
