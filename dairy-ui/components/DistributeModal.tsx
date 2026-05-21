'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Trash2, ChevronDown, Check, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

interface Customer { id: number; name: string; defaultRate: number; }

interface DispatchRow {
  key: number;
  dispatchType: 'CUSTOMER' | 'WASTE' | 'OWN_USE';
  customerId: number | null;
  quantity: string;
  ratePerLitre: string;
}

interface DistributeModalProps {
  date: string;
  shift: string;
  totalProduced: number;
  onClose: () => void;
  onSave: () => void;
}

let _k = 0;
const nk = () => ++_k;

// ─── Stepper input for mobile-friendly number entry ───────────────────────────
function StepperInput({
  label, value, onChange, prefix, suffix, step = 1, min = 0,
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; step?: number; min?: number;
}) {
  const num = parseFloat(value) || 0;
  const dec = step < 1 ? 1 : 0;

  const increment = () => onChange((num + step).toFixed(dec));
  const decrement = () => onChange(Math.max(min, num - step).toFixed(dec));

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); decrement(); }}
          className="w-10 h-11 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-brand hover:bg-brand/5 active:bg-brand/10 transition-colors flex-shrink-0 select-none"
        >
          −
        </button>
        <div className="relative flex-1">
          {prefix && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 pointer-events-none">{prefix}</span>
          )}
          <input
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="0"
            className={`w-full h-11 text-center text-[15px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-brand bg-transparent ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-5' : ''}`}
          />
          {suffix && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 pointer-events-none">{suffix}</span>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); increment(); }}
          className="w-10 h-11 flex items-center justify-center text-xl font-bold text-gray-400 hover:text-brand hover:bg-brand/5 active:bg-brand/10 transition-colors flex-shrink-0 select-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function DistributeModal({ date, shift, totalProduced, onClose, onSave }: DistributeModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const { showToast } = useNotification();

  useEffect(() => {
    api.get('/customers').then(r => {
      const list: Customer[] = r.data;
      setCustomers(list);
      if (list.length > 0) {
        setRows(prev => prev.map(row =>
          row.dispatchType === 'CUSTOMER' && row.customerId === null
            ? { ...row, customerId: list[0].id, ratePerLitre: String(list[0].defaultRate ?? 45) }
            : row
        ));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/milk-dispatch/by-date?date=${date}`).then(r => {
      const all: any[] = r.data;
      const existing = shift === 'COMBINED' ? all : all.filter(d => d.shift === shift);
      if (existing.length > 0) {
        setRows(existing.map(d => ({
          key: nk(),
          dispatchType: d.dispatchType as DispatchRow['dispatchType'],
          customerId: d.customer?.id ?? null,
          quantity: String(d.quantity),
          ratePerLitre: String(d.ratePerLitre ?? 0),
        })));
      } else {
        // Default to first customer — will be patched by customers useEffect if not yet loaded
        setRows(prev => {
          const firstCust = customers[0];
          return [{ key: nk(), dispatchType: 'CUSTOMER', customerId: firstCust?.id ?? null, quantity: '', ratePerLitre: String(firstCust?.defaultRate ?? 45) }];
        });
      }
    }).catch(() => {
      const firstCust = customers[0];
      setRows([{ key: nk(), dispatchType: 'CUSTOMER', customerId: firstCust?.id ?? null, quantity: '', ratePerLitre: String(firstCust?.defaultRate ?? 45) }]);
    });
  }, [date, shift]);

  const setRow = (key: number, patch: Partial<DispatchRow>) =>
    setRows(p => p.map(r => r.key === key ? { ...r, ...patch } : r));

  const onCustomer = (key: number, id: number) => {
    const c = customers.find(x => x.id === id);
    setRow(key, { customerId: id, ratePerLitre: String(c?.defaultRate ?? 45) });
  };

  const addCust = () => {
    const firstCust = customers[0];
    setRows(p => [...p, {
      key: nk(),
      dispatchType: 'CUSTOMER',
      customerId: firstCust?.id ?? null,
      quantity: '',
      ratePerLitre: String(firstCust?.defaultRate ?? 45),
    }]);
  };
  const addSpecial = (type: 'WASTE' | 'OWN_USE') => {
    if (!rows.some(r => r.dispatchType === type))
      setRows(p => [...p, { key: nk(), dispatchType: type, customerId: null, quantity: '', ratePerLitre: '0' }]);
  };
  const del = (key: number) => setRows(p => p.filter(r => r.key !== key));

  const totalDispatched = useMemo(() =>
    rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0), [rows]);

  const totalRevenue = useMemo(() =>
    rows.filter(r => r.dispatchType === 'CUSTOMER')
      .reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.ratePerLitre) || 0), 0), [rows]);

  const remaining = +(totalProduced - totalDispatched).toFixed(2);
  const pct = Math.min(100, totalProduced > 0 ? (totalDispatched / totalProduced) * 100 : 0);
  const overAllocated = remaining < 0;

  const handleSave = async () => {
    const payload = rows
      .filter(r => parseFloat(r.quantity) > 0)
      .map(r => ({
        date, shift,
        dispatchType: r.dispatchType,
        customerId: r.customerId ?? undefined,
        quantity: parseFloat(r.quantity),
        ratePerLitre: parseFloat(r.ratePerLitre) || 0,
      }));
    if (!payload.length) { showToast('Enter at least one quantity.', 'warning'); return; }
    if (overAllocated) { showToast('Over-allocated! Please fix quantities.', 'error'); return; }
    const missingCustomer = payload.some(p => p.dispatchType === 'CUSTOMER' && !p.customerId);
    if (missingCustomer) { showToast('Please select a customer for all dispatch rows.', 'warning'); return; }
    setSaving(true);
    try {
      await api.post('/milk-dispatch/session', payload);
      setSuccess(true);
      setTimeout(() => { onSave(); onClose(); }, 1800);
    } catch (e: any) {
      showToast(e.response?.data?.message || e.message, 'error');
    } finally { setSaving(false); }
  };

  if (success) return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-10 max-w-xs w-full text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-brand/10 border-4 border-brand/20 text-brand flex items-center justify-center mx-auto mb-4">
          <Check size={32} strokeWidth={3} />
        </div>
        <h2 className="text-xl font-black text-text uppercase">Dispatched!</h2>
        <p className="text-sm text-text3 mt-1">{totalDispatched.toFixed(1)}L distributed — ₹{totalRevenue.toFixed(0)} added to ledger.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }} className="px-5 pt-5 pb-4 text-white flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-[17px] font-bold m-0">Distribute Milk</h2>
              <p className="text-[12px] opacity-70 mt-0.5">{shift.charAt(0)+shift.slice(1).toLowerCase()} • {date}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Produced', value: `${totalProduced.toFixed(1)}L`, color: 'text-white' },
              { label: 'Dispatched', value: `${totalDispatched.toFixed(1)}L`, color: 'text-white' },
              { label: 'Remaining', value: `${Math.abs(remaining).toFixed(1)}L`, color: overAllocated ? 'text-red-300' : 'text-amber-300' },
              { label: 'Revenue', value: `₹${totalRevenue.toFixed(0)}`, color: 'text-emerald-300' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider opacity-60 mb-0.5">{s.label}</div>
                <div className={`text-[13px] font-black ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tracker bar ── */}
        <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${overAllocated ? 'bg-red-500' : 'bg-brand'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">
              {totalDispatched.toFixed(1)}L / {totalProduced.toFixed(1)}L
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            Available: <span className={`font-semibold ${overAllocated ? 'text-red-500' : 'text-brand'}`}>{Math.max(0, remaining).toFixed(1)}L</span>
            {overAllocated && <span className="text-red-500 font-bold ml-2">⚠ Over-allocated!</span>}
          </p>
        </div>

        {/* ── Rows ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {rows.map(row => {
            const qty = parseFloat(row.quantity) || 0;
            const rate = parseFloat(row.ratePerLitre) || 0;
            const total = qty * rate;
            const isCust = row.dispatchType === 'CUSTOMER';
            const isWaste = row.dispatchType === 'WASTE';

            return (
              <div
                key={row.key}
                className={`rounded-2xl p-4 ${
                  isCust
                    ? 'bg-white border border-gray-200 shadow-sm'
                    : isWaste
                    ? 'border-2 border-dashed border-red-300 bg-red-50'
                    : 'border-2 border-dashed border-amber-300 bg-amber-50'
                }`}
              >
                {/* Row header: label + delete button aligned to top */}
                <div className="flex items-start justify-between mb-2">
                  <label className={`text-[10px] font-bold uppercase tracking-wider pt-0.5 ${
                    isCust ? 'text-gray-400' : isWaste ? 'text-red-400' : 'text-amber-500'
                  }`}>
                    {isCust ? 'Customer' : isWaste ? '🗑 Waste' : '🏠 Own Use'}
                  </label>
                  <button
                    onClick={() => del(row.key)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Customer dropdown — full width */}
                {isCust && (
                  <div className="relative mb-3">
                    <select
                      value={row.customerId ?? ''}
                      onChange={e => onCustomer(row.key, Number(e.target.value))}
                      className="w-full text-[14px] font-semibold border border-gray-200 rounded-xl px-3 py-2.5 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand pr-8"
                    >
                      <option value="">Select customer…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}

                {/* Qty + Rate inputs — side by side on all screens */}
                <div className={`grid gap-3 ${isCust ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <StepperInput
                    label="Qty (Litres)"
                    value={row.quantity}
                    onChange={v => setRow(row.key, { quantity: v })}
                    suffix="L"
                    step={0.5}
                  />

                  {isCust && (
                    <StepperInput
                      label="Rate / Litre"
                      value={row.ratePerLitre}
                      onChange={v => setRow(row.key, { ratePerLitre: v })}
                      prefix="₹"
                      step={5}
                    />
                  )}
                </div>

                {/* Total row for customer */}
                {isCust && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Total</span>
                    <span className={`text-[16px] font-black ${total > 0 ? 'text-brand' : 'text-gray-300'}`}>
                      {total > 0 ? `₹${total.toFixed(0)}` : '—'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Add Buttons ── */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 flex-wrap bg-gray-50/80 flex-shrink-0">
          <button onClick={addCust}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-brand text-brand hover:bg-brand hover:text-white transition-all">
            <Plus size={12} /> Add Customer
          </button>
          <button onClick={() => addSpecial('WASTE')}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-red-400 text-red-500 hover:bg-red-50 transition-all">
            <Plus size={12} /> Waste
          </button>
          <button onClick={() => addSpecial('OWN_USE')}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 transition-all">
            <Plus size={12} /> Own Use
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-400 font-semibold text-[14px] hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || overAllocated}
            className="flex-[2] py-3.5 rounded-xl text-white font-black text-[14px] hover:opacity-95 disabled:opacity-40 transition-all tracking-wide"
            style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }}>
            {saving ? 'Saving…' : 'Save Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
