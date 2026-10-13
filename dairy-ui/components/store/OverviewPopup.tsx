'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import Portal from '@/components/store/Portal';
import {
  StoreDashboard, StoreSale, ShopDetails, rupees, qty, todayIso, whatsappBillUrl, printBill, apiError,
  loadShopDetails, saveShopDetails, canManageStore, currentRole,
} from '@/lib/store';
import { AlertTriangle, CalendarClock, Printer, Send, Store, X } from 'lucide-react';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-border-custom p-4 shadow-sm">
      <p className="text-[11px] font-bold text-text3 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-text mt-1">{value}</p>
      {sub && <p className="text-[12px] text-text3 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Shop overview (today's sales, low stock, expiring, today's bills) shown as a popup from the tab row. */
export default function OverviewPopup({ onClose }: { onClose: () => void }) {
  const { showToast } = useNotification();
  const [data, setData] = useState<StoreDashboard | null>(null);
  const [bills, setBills] = useState<StoreSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [shop, setShop] = useState<ShopDetails | null>(null); // non-null while the edit form is open

  const saveShop = async () => {
    if (!shop) return;
    try {
      await saveShopDetails(shop);
      showToast('Shop details saved — they will print on bills', 'success');
      setShop(null);
    } catch (err) {
      showToast(apiError(err, 'Could not save shop details'), 'error');
    }
  };

  useEffect(() => {
    setIsOwner(canManageStore(currentRole()));
    loadShopDetails();
    const today = todayIso();
    Promise.all([api.get('/store/dashboard'), api.get('/store/sales', { params: { from: today, to: today } })])
      .then(([d, s]) => {
        setData(d.data);
        setBills(s.data);
      })
      .catch((err) => showToast(apiError(err, 'Failed to load store data'), 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div className="bg-surface w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 max-h-[92vh] overflow-auto bg-[#F4F7F5]"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold">Shop overview · today</h2>
            <div className="flex items-center gap-2">
              {isOwner && (
                <button onClick={async () => setShop(await loadShopDetails())}
                  className="flex items-center gap-2 border border-border-custom bg-white text-text2 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap hover:border-brand">
                  <Store size={15} /> Shop details
                </button>
              )}
              <button onClick={onClose} title="Close"><X size={20} /></button>
            </div>
          </div>

      {shop && (
        <Portal>
          <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">Shop details</h2>
                <button onClick={() => setShop(null)}><X size={20} /></button>
              </div>
              <p className="text-[12px] text-text3 mb-4">Printed at the top of every bill.</p>
              <div className="space-y-3">
                {([['address', 'Address', 'e.g. Main Road, Halasahalli, Karnataka 562xxx'],
                  ['phone', 'Phone', 'e.g. 98450 12345'],
                  ['gstin', 'GSTIN', '15 characters, e.g. 29ABCDE1234F1Z5']] as const).map(([k, l, ph]) => (
                  <label key={k} className="block">
                    <span className="block text-xs font-bold text-text2 uppercase tracking-wide mb-1">{l}</span>
                    {k === 'address' ? (
                      <textarea rows={2} value={shop[k]} placeholder={ph} onChange={(e) => setShop({ ...shop, [k]: e.target.value })}
                        className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
                    ) : (
                      <input value={shop[k]} placeholder={ph} onChange={(e) => setShop({ ...shop, [k]: e.target.value })}
                        className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
                    )}
                  </label>
                ))}
                {shop.gstin.trim() !== '' && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(shop.gstin.trim()) && (
                  <p className="text-[12px] text-danger">GSTIN should be 15 characters (2 digits + 13 letters/digits).</p>
                )}
              </div>
              <button onClick={saveShop} className="w-full mt-5 bg-brand text-white py-3 rounded-lg font-bold">Save</button>
            </div>
          </div>
        </Portal>
      )}

      {loading || !data ? (
        <p className="text-text3 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat label="Today's sales" value={rupees(data.salesTotal)} sub={`${data.billCount} bills`} />
            <Stat label="Today's margin" value={rupees(data.grossMargin)}
              sub={['CASH', 'UPI'].map((m) => `${m} ${rupees(data.byPaymentMode[m as 'CASH' | 'UPI'])}`).join(' · ')} />
            <Stat label="This month" value={rupees(data.monthSales)} sub={`Margin ${rupees(data.monthMargin)}`} />
            <Stat label="Stock value (cost)" value={rupees(data.stockValue)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-white rounded-xl border border-border-custom p-4 shadow-sm">
              <h2 className="font-bold text-text flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-danger" /> Low stock</h2>
              {data.lowStock.length === 0 ? (
                <p className="text-sm text-text3">All items above reorder level.</p>
              ) : (
                <ul className="divide-y divide-border-custom">
                  {data.lowStock.map((r) => (
                    <li key={r.item.id} className="py-2 flex justify-between text-sm">
                      <span className="font-semibold text-text">{r.item.name}</span>
                      <span className="text-danger font-bold">{qty(r.qtyOnHand)} {r.item.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl border border-border-custom p-4 shadow-sm">
              <h2 className="font-bold text-text flex items-center gap-2 mb-3"><CalendarClock size={16} className="text-amber-600" /> Expiring in 30 days</h2>
              {data.expiring.length === 0 ? (
                <p className="text-sm text-text3">Nothing expiring soon.</p>
              ) : (
                <ul className="divide-y divide-border-custom">
                  {data.expiring.map((b) => (
                    <li key={b.batchId} className="py-2 flex justify-between text-sm">
                      <span className="font-semibold text-text">{b.itemName} <span className="text-text3 font-normal">({qty(b.qtyRemaining)})</span></span>
                      <span className={b.daysLeft < 0 ? 'text-danger font-bold' : 'text-amber-700 font-bold'}>
                        {b.daysLeft < 0 ? `Expired ${-b.daysLeft}d ago` : `${b.daysLeft} days`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border-custom shadow-sm">
            <h2 className="font-bold text-text p-4 pb-2">Today&apos;s bills</h2>
            {bills.length === 0 ? (
              <p className="text-sm text-text3 px-4 pb-4">No bills yet today.</p>
            ) : (
              <ul className="divide-y divide-border-custom">
                {bills.map((b) => (
                  <li key={b.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-bold text-text">{b.billNo} · {b.customerName || 'Walk-in'}</p>
                      <p className="text-text3 text-[12px]">{b.lines.map((l) => `${l.item.name} × ${qty(l.qty)}`).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-text">{rupees(b.total)}</span>
                      <button onClick={() => printBill(b)} title="Print bill" className="p-1.5 text-text3 hover:text-brand">
                        <Printer size={16} />
                      </button>
                      <a href={whatsappBillUrl(b)} target="_blank" rel="noreferrer" title="Send on WhatsApp" className="p-1.5 text-text3 hover:text-brand">
                        <Send size={16} />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
        </div>
      </div>
    </Portal>
  );
}
