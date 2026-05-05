'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Trash2, ChevronDown, Check } from 'lucide-react';
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
      // Auto-select first customer for any CUSTOMER rows that have no customer yet
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
        setRows([{ key: nk(), dispatchType: 'CUSTOMER', customerId: null, quantity: '', ratePerLitre: '45' }]);
      }
    }).catch(() => {
      setRows([{ key: nk(), dispatchType: 'CUSTOMER', customerId: null, quantity: '', ratePerLitre: '45' }]);
    });
  }, [date, shift]);

  const setRow = (key: number, patch: Partial<DispatchRow>) =>
    setRows(p => p.map(r => r.key === key ? { ...r, ...patch } : r));

  const onCustomer = (key: number, id: number) => {
    const c = customers.find(x => x.id === id);
    setRow(key, { customerId: id, ratePerLitre: String(c?.defaultRate ?? 45) });
  };

  const addCust = () => setRows(p => [...p, { key: nk(), dispatchType: 'CUSTOMER', customerId: null, quantity: '', ratePerLitre: '45' }]);

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }} className="px-6 py-5 text-white">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-[17px] font-semibold m-0">Distribute Milk</h2>
              <p className="text-[13px] opacity-80 mt-0.5">{shift.charAt(0)+shift.slice(1).toLowerCase()} • {date}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none"><X size={20} /></button>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-4 gap-3 text-[13px]">
            {[
              { label: 'Produced', value: `${totalProduced.toFixed(1)}L`, hl: false },
              { label: 'Dispatched', value: `${totalDispatched.toFixed(1)}L`, hl: false },
              { label: 'Remaining', value: `${Math.abs(remaining).toFixed(1)}L${overAllocated?' OVER':''}`, hl: true },
              { label: 'Revenue', value: `₹${totalRevenue.toFixed(0)}`, hl: false },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[11px] opacity-75 mb-1">{s.label}</div>
                <div className={`text-[16px] font-semibold ${s.hl ? (overAllocated ? 'text-red-300' : 'text-amber-300') : ''}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tracker bar ── */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${overAllocated ? 'bg-red-500' : 'bg-brand'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap">{totalDispatched.toFixed(1)}L of {totalProduced.toFixed(1)}L</span>
          </div>
          <p className="text-[12px] text-gray-400">Available for dispatch: {Math.max(0, remaining).toFixed(1)}L</p>
        </div>

        {/* ── Rows ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {rows.map(row => {
            const qty = parseFloat(row.quantity) || 0;
            const rate = parseFloat(row.ratePerLitre) || 0;
            const total = qty * rate;
            const isCust = row.dispatchType === 'CUSTOMER';
            const isWaste = row.dispatchType === 'WASTE';

            return (
              <div
                key={row.key}
                className={`rounded-xl px-4 py-3 grid gap-3 items-end ${
                  isCust
                    ? 'bg-gray-50 border border-gray-200'
                    : isWaste
                    ? 'border-2 border-dashed border-red-300 bg-red-50'
                    : 'border-2 border-dashed border-amber-300 bg-amber-50'
                }`}
                style={{ gridTemplateColumns: isCust ? '2fr 1fr 1fr 1fr auto' : '2fr 1fr 1fr 1fr auto' }}
              >
                {/* Col 1: Customer selector or label */}
                <div>
                  {isCust ? (
                    <>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Customer</label>
                      <div className="relative">
                        <select
                          value={row.customerId ?? ''}
                          onChange={e => onCustomer(row.key, Number(e.target.value))}
                          className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white appearance-none focus:outline-none focus:ring-1 focus:ring-brand pr-7"
                        >
                          <option value="">Select customer…</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                      </div>
                    </>
                  ) : (
                    <div className={`text-[12px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1.5 ${
                      isWaste ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'
                    }`}>
                      {isWaste ? '🗑 Waste' : '🏠 Own Use'}
                    </div>
                  )}
                </div>

                {/* Col 2: Quantity */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Qty (L)</label>
                  <div className="relative">
                    <input
                      type="number" min="0" step="0.1"
                      value={row.quantity}
                      onChange={e => setRow(row.key, { quantity: e.target.value })}
                      placeholder="0"
                      className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[11px] text-gray-400">L</span>
                  </div>
                </div>

                {/* Col 3: Rate */}
                {isCust ? (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Rate/L</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-[11px] text-gray-400">₹</span>
                      <input
                        type="number" min="0" step="0.5"
                        value={row.ratePerLitre}
                        onChange={e => setRow(row.key, { ratePerLitre: e.target.value })}
                        className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 pl-5 focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <span className="absolute right-2 top-2.5 text-[10px] text-gray-400">/L</span>
                    </div>
                  </div>
                ) : <div />}

                {/* Col 4: Total */}
                {isCust ? (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Total</label>
                    <div className={`px-3 py-2 text-[13px] font-semibold ${total > 0 ? 'text-brand' : 'text-gray-300'}`}>
                      {total > 0 ? `₹${total.toFixed(0)}` : '—'}
                    </div>
                  </div>
                ) : <div />}

                {/* Delete */}
                <button onClick={() => del(row.key)} className="pb-2 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Add Buttons ── */}
        <div className="px-6 py-3 border-t border-gray-100 flex gap-2 flex-wrap bg-gray-50/50">
          <button onClick={addCust}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-brand text-brand hover:bg-brand hover:text-white transition-all">
            + Add Customer
          </button>
          <button onClick={() => addSpecial('WASTE')}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-red-400 text-red-500 hover:bg-red-50 transition-all">
            + Waste
          </button>
          <button onClick={() => addSpecial('OWN_USE')}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 transition-all">
            + Own Use
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-400 font-semibold text-[14px] hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || overAllocated}
            className="flex-[1.5] py-3 rounded-xl text-white font-semibold text-[14px] hover:opacity-95 disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }}>
            {saving ? 'Saving…' : 'Save Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
