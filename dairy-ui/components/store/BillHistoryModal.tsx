'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Portal from '@/components/store/Portal';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { StoreSale, rupees, qty, apiError, printBill, paymentLabel } from '@/lib/store';
import { ChevronDown, ChevronRight, Pencil, Printer, RefreshCw, Trash2, X } from 'lucide-react';

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};

const niceDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props {
  onClose: () => void;
  /** True only for the owner account (user id 1); others can view and print but not change bills. */
  canModify: boolean;
  onEdit: (sale: StoreSale) => void;
}

export default function BillHistoryModal({ onClose, canModify, onEdit }: Props) {
  const { showToast, confirm } = useNotification();
  const [from, setFrom] = useState(daysBack(6));
  const [to, setTo] = useState(isoDate(new Date()));
  const [sales, setSales] = useState<StoreSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/store/sales', { params: { from, to } });
      setSales(r.data || []);
    } catch (err) {
      showToast(apiError(err, 'Could not load bills'), 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const remove = (sale: StoreSale) => {
    confirm(
      `Delete bill ${sale.billNo} (${rupees(sale.total)})? Its items go back into stock and any credit it added is removed. This can't be undone.`,
      async () => {
        try {
          await api.delete(`/store/sales/${sale.id}`);
          showToast(`Bill ${sale.billNo} deleted`, 'success');
          load();
        } catch (err) {
          showToast(apiError(err, 'Could not delete bill'), 'error');
        }
      },
      'danger',
    );
  };

  const q = query.trim().toLowerCase();
  const shown = q
    ? sales.filter(s => `${s.billNo} ${s.customerName || ''} ${s.customerPhone || ''}`.toLowerCase().includes(q))
    : sales;
  const grandTotal = shown.reduce((t, s) => t + s.total, 0);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom">
            <h2 className="font-bold text-text">Bill history</h2>
            <button onClick={onClose} aria-label="Close" className="text-text3 hover:text-text"><X size={20} /></button>
          </div>

          <div className="px-4 py-3 border-b border-border-custom space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="border border-border-custom rounded-lg px-2 py-1.5" />
              <span className="text-text3">to</span>
              <input type="date" value={to} min={from} max={isoDate(new Date())} onChange={e => setTo(e.target.value)} className="border border-border-custom rounded-lg px-2 py-1.5" />
              {([['Today', 0], ['7 days', 6], ['30 days', 29]] as const).map(([label, n]) => (
                <button key={label} onClick={() => { setFrom(daysBack(n)); setTo(isoDate(new Date())); }}
                  className="px-2.5 py-1.5 rounded-lg border border-border-custom text-[12px] font-bold text-text2 hover:bg-surface2">{label}</button>
              ))}
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bill no, name or phone"
              className="w-full border border-border-custom rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading bills...</div>
            ) : shown.length === 0 ? (
              <p className="text-center text-sm text-text3 py-10">No bills in this period.</p>
            ) : (
              <ul className="divide-y divide-border-custom">
                {shown.map(s => {
                  const due = s.total - s.paidAmount;
                  const open = openId === s.id;
                  return (
                    <li key={s.id} className="px-4 py-2.5">
                      <button onClick={() => setOpenId(open ? null : s.id)} className="w-full flex items-center gap-2 text-left">
                        {open ? <ChevronDown size={16} className="text-text3 shrink-0" /> : <ChevronRight size={16} className="text-text3 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text">{s.billNo} <span className="font-normal text-text3">· {niceDate(s.saleDate)}</span></p>
                          <p className="text-[12px] text-text3 truncate">{s.customerName || 'Walk-in'} · {paymentLabel(s.paymentMode)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-text">{rupees(s.total)}</p>
                          {due > 0 && <p className="text-[11px] font-bold text-danger">Due {rupees(due)}</p>}
                        </div>
                      </button>

                      {open && (
                        <div className="mt-2 ml-6">
                          <table className="w-full text-[12px]">
                            <thead><tr className="text-text3 text-left"><th className="font-bold">Item</th><th className="font-bold text-right">Qty</th><th className="font-bold text-right">Rate</th><th className="font-bold text-right">Amount</th></tr></thead>
                            <tbody>
                              {s.lines.map(l => (
                                <tr key={l.id}>
                                  <td className="py-0.5">{l.item.name}</td>
                                  <td className="text-right">{qty(l.qty)}</td>
                                  <td className="text-right">{rupees(l.unitPrice)}</td>
                                  <td className="text-right font-semibold">{rupees(l.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {s.discount > 0 && <p className="text-[12px] text-text2 mt-1">Discount {rupees(s.discount)}</p>}
                          {s.createdBy && <p className="text-[11px] text-text3 mt-1">Billed by {s.createdBy}</p>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button onClick={() => printBill(s, 'thermal') || showToast('Allow pop-ups to print', 'error')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-custom text-[12px] font-bold text-text2 hover:bg-surface2">
                              <Printer size={14} /> Print 80mm
                            </button>
                            <button onClick={() => printBill(s, 'a5') || showToast('Allow pop-ups to print', 'error')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-custom text-[12px] font-bold text-text2 hover:bg-surface2">
                              <Printer size={14} /> Print A5
                            </button>
                            {canModify && (
                              <>
                                <button onClick={() => onEdit(s)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand text-[12px] font-bold text-brand hover:bg-brand/5">
                                  <Pencil size={14} /> Edit
                                </button>
                                <button onClick={() => remove(s)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger text-[12px] font-bold text-danger hover:bg-danger/5">
                                  <Trash2 size={14} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-between px-4 py-2.5 border-t border-border-custom text-sm">
            <span className="text-text2">{shown.length} bill{shown.length === 1 ? '' : 's'}</span>
            <span className="font-bold text-text">{rupees(grandTotal)}</span>
          </div>
        </div>
      </div>
    </Portal>
  );
}
