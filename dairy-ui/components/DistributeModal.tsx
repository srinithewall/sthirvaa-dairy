'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { X, Plus, Trash2, ChevronDown, Check, Milk, Droplets } from 'lucide-react';
import api from '@/lib/api';

interface Customer {
  id: number;
  name: string;
  defaultRate: number;
}

interface DispatchRow {
  key: number;
  dispatchType: 'CUSTOMER' | 'WASTE' | 'OWN_USE';
  customerId: number | null;
  customerName: string;
  quantity: string;
  ratePerLitre: string;
}

interface DistributeModalProps {
  date: string;
  shift: string;
  totalProduced: number;
  existingRows?: DispatchRow[];
  onClose: () => void;
  onSave: () => void;
}

let keyCounter = 0;
const newKey = () => ++keyCounter;

export default function DistributeModal({
  date,
  shift,
  totalProduced,
  onClose,
  onSave,
}: DistributeModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data)).catch(() => {});
  }, []);

  // Pre-load existing dispatches for this date+shift (edit mode)
  useEffect(() => {
    api.get(`/milk-dispatch/by-date?date=${date}`).then(res => {
      const existing: any[] = res.data.filter((d: any) => d.shift === shift);
      if (existing.length > 0) {
        setRows(existing.map(d => ({
          key: newKey(),
          dispatchType: d.dispatchType as DispatchRow['dispatchType'],
          customerId: d.customer?.id ?? null,
          customerName: d.customer?.name ?? '',
          quantity: String(d.quantity),
          ratePerLitre: String(d.ratePerLitre),
        })));
      } else {
        // Start with one blank customer row
        setRows([{ key: newKey(), dispatchType: 'CUSTOMER', customerId: null, customerName: '', quantity: '', ratePerLitre: '45' }]);
      }
    }).catch(() => {
      setRows([{ key: newKey(), dispatchType: 'CUSTOMER', customerId: null, customerName: '', quantity: '', ratePerLitre: '45' }]);
    });
  }, [date, shift]);

  const handleCustomerChange = (key: number, customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    setRows(prev => prev.map(r => r.key === key
      ? { ...r, customerId, customerName: customer?.name ?? '', ratePerLitre: String(customer?.defaultRate ?? 45) }
      : r
    ));
  };

  const handleChange = (key: number, field: keyof DispatchRow, value: any) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const addCustomerRow = () => {
    setRows(prev => [...prev, { key: newKey(), dispatchType: 'CUSTOMER', customerId: null, customerName: '', quantity: '', ratePerLitre: '45' }]);
  };

  const addWasteRow = (type: 'WASTE' | 'OWN_USE') => {
    const alreadyExists = rows.some(r => r.dispatchType === type);
    if (!alreadyExists) {
      setRows(prev => [...prev, { key: newKey(), dispatchType: type, customerId: null, customerName: type === 'WASTE' ? 'Waste' : 'Own Use', quantity: '', ratePerLitre: '0' }]);
    }
  };

  const removeRow = (key: number) => {
    setRows(prev => prev.filter(r => r.key !== key));
  };

  const totalDispatched = useMemo(() =>
    rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0), [rows]);

  const remaining = +(totalProduced - totalDispatched).toFixed(2);
  const totalRevenue = useMemo(() =>
    rows.filter(r => r.dispatchType === 'CUSTOMER')
      .reduce((sum, r) => sum + (parseFloat(r.quantity) || 0) * (parseFloat(r.ratePerLitre) || 0), 0),
    [rows]
  );

  const handleSave = async () => {
    const payload = rows
      .filter(r => parseFloat(r.quantity) > 0)
      .map(r => ({
        date,
        shift,
        dispatchType: r.dispatchType,
        customerId: r.customerId ?? undefined,
        quantity: parseFloat(r.quantity),
        ratePerLitre: parseFloat(r.ratePerLitre) || 0,
      }));

    if (payload.length === 0) { alert('Enter at least one quantity.'); return; }

    setSaving(true);
    try {
      await api.post('/milk-dispatch/session', payload);
      setSuccess(true);
      setTimeout(() => { onSave(); onClose(); }, 2000);
    } catch (err: any) {
      alert(`Save failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-brand/20">
            <Check size={40} strokeWidth={4} />
          </div>
          <h2 className="text-2xl font-black text-text uppercase tracking-tight">Dispatched!</h2>
          <p className="text-text3 text-[14px] mt-2">
            <span className="text-brand font-black">{totalDispatched.toFixed(1)}L</span> dispatched.
          </p>
          <p className="text-text3 text-[13px] italic opacity-70 mt-1">
            ₹{totalRevenue.toFixed(0)} added to income ledger.
          </p>
        </div>
      </div>
    );
  }

  const remainingColor = remaining < 0 ? 'text-red-600 bg-red-50 border-red-200' : remaining === 0 ? 'text-brand bg-brand/5 border-brand/20' : 'text-amber-600 bg-amber-50 border-amber-200';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 max-h-[95vh]">

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)' }}>
          <div>
            <h2 className="text-[15px] font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Milk size={15} /> Distribute Milk — {shift} · {date}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Stats bar */}
        <div className="px-5 py-2.5 border-b border-border-custom bg-surface/50 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Droplets size={13} className="text-brand" />
            <span className="text-[10px] font-black text-text3 uppercase tracking-wider">Produced</span>
            <span className="text-[14px] font-black text-brand">{totalProduced.toFixed(1)}L</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-text3 uppercase tracking-wider">Dispatched</span>
            <span className="text-[14px] font-black text-text">{totalDispatched.toFixed(1)}L</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[12px] font-black ${remainingColor}`}>
            {remaining < 0 ? '⚠ Over by' : 'Remaining'}: {Math.abs(remaining).toFixed(1)}L
          </div>
          <div className="ml-auto text-right">
            <span className="text-[10px] font-black text-text3 uppercase">Revenue</span>
            <span className="text-[14px] font-black text-brand ml-2">₹{totalRevenue.toFixed(0)}</span>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
          {rows.map(row => (
            <div key={row.key} className={`rounded-xl border flex items-center gap-2 px-3 py-2.5 transition-all ${
              row.dispatchType === 'CUSTOMER' ? 'border-brand/20 bg-brand/3' :
              row.dispatchType === 'WASTE' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
            }`}>

              {/* Type badge */}
              {row.dispatchType !== 'CUSTOMER' ? (
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${
                  row.dispatchType === 'WASTE' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {row.dispatchType === 'WASTE' ? '🗑 Waste' : '🏠 Own Use'}
                </span>
              ) : (
                <div className="relative min-w-[140px]">
                  <select
                    value={row.customerId ?? ''}
                    onChange={e => handleCustomerChange(row.key, Number(e.target.value))}
                    className="w-full text-[11px] font-bold text-text border border-border-custom rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand appearance-none pr-5"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="absolute right-1.5 top-2 text-text3 pointer-events-none" />
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number" step="0.1" min="0"
                  value={row.quantity}
                  onChange={e => handleChange(row.key, 'quantity', e.target.value)}
                  placeholder="Qty (L)"
                  className="w-full text-center border border-border-custom rounded-lg px-2 py-1.5 text-[12px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <span className="text-[10px] text-text3 font-bold">L</span>
              </div>

              {/* Rate — only for customer rows */}
              {row.dispatchType === 'CUSTOMER' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text3 font-bold">₹</span>
                  <input
                    type="number" step="0.5" min="0"
                    value={row.ratePerLitre}
                    onChange={e => handleChange(row.key, 'ratePerLitre', e.target.value)}
                    placeholder="Rate"
                    className="w-16 text-center border border-border-custom rounded-lg px-2 py-1.5 text-[12px] font-bold text-text focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-[10px] text-text3 font-bold">/L</span>
                </div>
              )}

              {/* Row total */}
              {row.dispatchType === 'CUSTOMER' && (
                <span className="text-[11px] font-black text-brand min-w-[48px] text-right">
                  {((parseFloat(row.quantity) || 0) * (parseFloat(row.ratePerLitre) || 0) > 0)
                    ? `₹${((parseFloat(row.quantity) || 0) * (parseFloat(row.ratePerLitre) || 0)).toFixed(0)}`
                    : '—'}
                </span>
              )}

              <button onClick={() => removeRow(row.key)} className="text-text3 hover:text-red-500 transition-colors ml-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add row buttons */}
        <div className="px-5 py-2 border-t border-border-custom flex gap-2 flex-wrap bg-surface/30">
          <button onClick={addCustomerRow}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand/5 transition-all">
            <Plus size={11} /> Add Customer
          </button>
          <button onClick={() => addWasteRow('WASTE')}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-all">
            <Plus size={11} /> Waste
          </button>
          <button onClick={() => addWasteRow('OWN_USE')}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 transition-all">
            <Plus size={11} /> Own Use
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-custom bg-surface/20 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest border border-border-custom text-text3 hover:bg-white transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-2 py-3 px-10 rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg hover:opacity-95 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)' }}>
            {saving ? 'Saving…' : 'Save Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
