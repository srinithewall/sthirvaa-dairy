'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Portal from '@/components/store/Portal';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { StoreSale, StoreSaleAudit, rupees, qty, apiError, printBill, paymentLabel } from '@/lib/store';
import { ChevronDown, ChevronRight, History, Pencil, Printer, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};

const niceDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const niceTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

const ACTION_LABEL: Record<StoreSaleAudit['action'], string> = { CREATED: 'Created', EDITED: 'Edited', DELETED: 'Deleted' };

const parseSnapshot = (a: StoreSaleAudit): StoreSale | null => {
  try { return a.snapshot ? JSON.parse(a.snapshot) : null; } catch { return null; }
};

interface Props {
  onClose: () => void;
  /** True only for the owner account (user id 1); others can view and print but not change bills. */
  canModify: boolean;
  /** contents: an older version of the bill, from its change log, to load instead of the current one. */
  onEdit: (sale: StoreSale, contents?: StoreSale) => void;
}

export default function BillHistoryModal({ onClose, canModify, onEdit }: Props) {
  const { showToast, confirm } = useNotification();
  const [from, setFrom] = useState(daysBack(6));
  const [to, setTo] = useState(isoDate(new Date()));
  const [sales, setSales] = useState<StoreSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'bills' | 'deleted'>('bills');
  const [deleted, setDeleted] = useState<StoreSaleAudit[]>([]);
  // Change log of the open bill.
  const [log, setLog] = useState<{ saleId: number; entries: StoreSaleAudit[] } | null>(null);

  const loadLog = async (saleId: number) => {
    if (log?.saleId === saleId) { setLog(null); return; }
    try {
      const r = await api.get(`/store/sales/${saleId}/audit`);
      setLog({ saleId, entries: r.data || [] });
    } catch (err) {
      showToast(apiError(err, 'Could not load the change log'), 'error');
    }
  };

  const revert = (current: StoreSale, entry: StoreSaleAudit) => {
    const old = parseSnapshot(entry);
    if (!old) return;
    confirm(
      `Load bill ${current.billNo} as it was before the change on ${niceTime(entry.createdAt)} (${rupees(old.total)})? `
        + 'Check it, then press Update bill to save it back. The change is recorded in the log.',
      () => onEdit(current, old),
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        api.get('/store/sales', { params: { from, to } }),
        api.get('/store/sales/deleted', { params: { from, to } }).catch(() => ({ data: [] })),
      ]);
      setSales(r.data || []);
      setDeleted(d.data || []);
    } catch (err) {
      showToast(apiError(err, 'Could not load bills'), 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const remove = (sale: StoreSale) => {
    confirm(
      `Delete bill ${sale.billNo} (${rupees(sale.total)})? Its items go back into stock and any credit and diamonds it added are removed. A copy stays under Deleted.`,
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
  const shownDeleted = q
    ? deleted.filter(a => `${a.billNo} ${parseSnapshot(a)?.customerName || ''}`.toLowerCase().includes(q))
    : deleted;

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
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bill no, name or phone"
                className="flex-1 min-w-0 border border-border-custom rounded-lg px-3 py-2 text-sm" />
              <div className="inline-flex rounded-lg border border-border-custom p-0.5 text-[12px] font-bold shrink-0">
                {([['bills', 'Bills'], ['deleted', `Deleted${deleted.length ? ` (${deleted.length})` : ''}`]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-2.5 py-1.5 rounded-md ${view === v ? 'bg-brand text-white' : 'text-text2'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading bills...</div>
            ) : view === 'deleted' ? (
              shownDeleted.length === 0 ? (
                <p className="text-center text-sm text-text3 py-10">No bills deleted in this period.</p>
              ) : (
                <ul className="divide-y divide-border-custom">
                  {shownDeleted.map(a => {
                    const old = parseSnapshot(a);
                    return (
                      <li key={a.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-text"><span className="line-through decoration-danger">{a.billNo}</span>
                              {old && <span className="font-normal text-text3"> · {niceDate(old.saleDate)}</span>}</p>
                            <p className="text-[12px] text-text3">{old?.customerName || 'Walk-in'}{old && ` · ${paymentLabel(old.paymentMode)}`}</p>
                            <p className="text-[11px] text-danger mt-0.5">Deleted {niceTime(a.createdAt)}{a.createdBy && ` by ${a.createdBy}`}</p>
                          </div>
                          <p className="font-bold text-sm text-text3 shrink-0">{rupees(a.totalBefore)}</p>
                        </div>
                        {old && (
                          <p className="text-[12px] text-text2 mt-1">{old.lines.map(l => `${l.item.name} ×${qty(l.qty)}`).join(', ')}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )
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
                          {!!s.rewardValue && <p className="text-[12px] text-text2 mt-1">Paid with diamonds {rupees(s.rewardValue)} ({s.coinsRedeemed} 💎)</p>}
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
                            <button onClick={() => loadLog(s.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-custom text-[12px] font-bold text-text2 hover:bg-surface2">
                              <History size={14} /> Change log
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
                          {log?.saleId === s.id && (
                            <div className="mt-2 border border-border-custom rounded-lg overflow-hidden">
                              <p className="px-3 py-1.5 text-[11px] font-bold text-text3 uppercase tracking-wide bg-surface2">Change log</p>
                              {log.entries.length === 0 ? (
                                <p className="px-3 py-2 text-[12px] text-text3">No changes recorded. (Bills saved before the log was added have no entries.)</p>
                              ) : (
                                <ul className="divide-y divide-border-custom text-[12px]">
                                  {log.entries.map(a => (
                                    <li key={a.id} className="px-3 py-2">
                                      <div className="flex justify-between gap-2">
                                        <span><b>{ACTION_LABEL[a.action]}</b> · {niceTime(a.createdAt)}{a.createdBy && ` · ${a.createdBy}`}</span>
                                        {a.action === 'EDITED' && a.totalBefore != null && a.totalAfter != null && a.totalBefore !== a.totalAfter && (
                                          <span className="shrink-0">{rupees(a.totalBefore)} → <b>{rupees(a.totalAfter)}</b></span>
                                        )}
                                      </div>
                                      {a.action === 'EDITED' && a.changes && <p className="text-text2 mt-0.5">{a.changes}</p>}
                                      {canModify && a.action === 'EDITED' && a.snapshot && (
                                        <button onClick={() => revert(s, a)}
                                          className="mt-1 flex items-center gap-1 text-brand font-bold hover:underline">
                                          <RotateCcw size={12} /> Put back the bill as it was before this change
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-between px-4 py-2.5 border-t border-border-custom text-sm">
            {view === 'bills' ? (
              <>
                <span className="text-text2">{shown.length} bill{shown.length === 1 ? '' : 's'}</span>
                <span className="font-bold text-text">{rupees(grandTotal)}</span>
              </>
            ) : (
              <span className="text-text2">{shownDeleted.length} deleted bill{shownDeleted.length === 1 ? '' : 's'} (by date deleted)</span>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
