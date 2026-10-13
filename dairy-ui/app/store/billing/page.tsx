'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StoreTabs from '@/components/store/StoreTabs';
import Portal from '@/components/store/Portal';
import ItemFilter, { ItemFilterValue, NO_FILTER, matchesItemFilter } from '@/components/store/ItemFilter';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import {
  StockRow, StoreFarmer, StoreSale, StorePaymentMode, FarmerAccount, rupees, qty, itemLabel, apiError, whatsappBillUrl,
  printBill, paymentLabel, daysAgo, loadShopDetails, StoreSupplier, StoreItemCategory, CATEGORIES, categoryLabel,
  cachedGet, brandMatches,
} from '@/lib/store';
import { Minus, Plus, Search, Send, Trash2, UserPlus, X, CheckCircle2, Printer, Wallet, SlidersHorizontal } from 'lucide-react';

interface CartLine { row: StockRow; qty: number; price: number; }

export default function BillingPage() {
  const { showToast } = useNotification();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [itemQuery, setItemQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [farmerQuery, setFarmerQuery] = useState('');
  const [farmerResults, setFarmerResults] = useState<StoreFarmer[]>([]);
  const [farmer, setFarmer] = useState<StoreFarmer | null>(null);
  const [newFarmer, setNewFarmer] = useState<{ name: string; phone: string; village: string } | null>(null);

  const [account, setAccount] = useState<FarmerAccount | null>(null);
  const [payment, setPayment] = useState<{ amount: number | ''; mode: StorePaymentMode } | null>(null);

  const [discount, setDiscount] = useState(0);
  const [mode, setMode] = useState<StorePaymentMode>('CASH');
  const [paidNow, setPaidNow] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<StoreSale | null>(null);
  const [savedBalance, setSavedBalance] = useState<number | undefined>();

  // Balance and last visit for the picked farmer; credit options need a farmer.
  useEffect(() => {
    setAccount(null); setPayment(null);
    if (!farmer) { setMode((m) => (m === 'CREDIT' || m === 'MIXED' ? 'CASH' : m)); return; }
    api.get(`/store/farmers/${farmer.id}/account`).then((r) => setAccount(r.data)).catch(() => {});
  }, [farmer]);

  const receivePayment = async () => {
    if (!farmer || !payment || !payment.amount) return;
    try {
      const r = await api.post(`/store/farmers/${farmer.id}/payments`, { amount: payment.amount, paymentMode: payment.mode });
      setAccount(r.data);
      setPayment(null);
      showToast(`Received ${rupees(Number(payment.amount))} from ${farmer.name}`, 'success');
    } catch (err) {
      showToast(apiError(err, 'Could not record payment'), 'error');
    }
  };

  const loadStock = () =>
    api.get('/store/stock').then((r) => setStock(r.data)).catch((err) => showToast(apiError(err, 'Failed to load items'), 'error'));

  // Item filters: supplier and type (category).
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [filter, setFilter] = useState<ItemFilterValue>(NO_FILTER);

  useEffect(() => {
    loadStock(); loadShopDetails();
    cachedGet<StoreSupplier[]>('/store/suppliers').then(setSuppliers).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (farmerQuery.trim().length < 2) { setFarmerResults([]); return; }
    const t = setTimeout(() => {
      api.get('/store/farmers', { params: { q: farmerQuery } }).then((r) => setFarmerResults(r.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [farmerQuery]);

  const visibleItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return stock.filter((r) =>
      (!q || r.item.name.toLowerCase().includes(q) || (r.item.kannadaName || '').includes(itemQuery.trim()))
      && matchesItemFilter(r.item, filter, suppliers));
  }, [stock, itemQuery, suppliers, filter]);

  const inCart = (id: number) => cart.find((c) => c.row.item.id === id)?.qty ?? 0;

  // Items already at their stock limit are disabled, so this message is a fallback; show it at most
  // once every few seconds so repeated taps don't stack up toasts.
  const lastStockToast = React.useRef(0);
  const addItem = (row: StockRow) => {
    if (inCart(row.item.id) + 1 > row.qtyOnHand) {
      if (Date.now() - lastStockToast.current > 3000) {
        lastStockToast.current = Date.now();
        showToast(`Only ${qty(row.qtyOnHand)} ${row.item.unit} of ${row.item.name} in stock`, 'error');
      }
      return;
    }
    setCart((c) => {
      const existing = c.find((l) => l.row.item.id === row.item.id);
      if (existing) return c.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { row, qty: 1, price: row.item.salePrice }];
    });
  };

  const updateLine = (id: number, patch: Partial<CartLine>) =>
    setCart((c) => c.map((l) => (l.row.item.id === id ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const total = Math.max(0, subtotal - discount);
  const paidOnBill = mode === 'CREDIT' ? 0 : mode === 'MIXED' ? Number(paidNow || 0) : total;
  const dueOnBill = Math.max(0, total - paidOnBill);

  const saveFarmer = async () => {
    if (!newFarmer) return;
    try {
      const r = await api.post('/store/farmers', newFarmer);
      setFarmer(r.data);
      setNewFarmer(null);
      setFarmerQuery('');
    } catch (err) {
      showToast(apiError(err, 'Could not save contact'), 'error');
    }
  };

  const reset = () => {
    setCart([]); setFarmer(null); setFarmerQuery(''); setDiscount(0); setMode('CASH'); setPaidNow(''); setSaved(null); setSavedBalance(undefined);
    loadStock();
  };

  const submit = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const r = await api.post('/store/sales', {
        farmerId: farmer?.id,
        discount,
        paymentMode: mode,
        paidAmount: mode === 'MIXED' ? paidNow : undefined,
        lines: cart.map((l) => ({ itemId: l.row.item.id, qty: l.qty, unitPrice: l.price })),
      });
      setSaved(r.data);
      setSavedBalance(account ? account.balance + (r.data.total - r.data.paidAmount) : undefined);
      showToast(`Bill ${r.data.billNo} saved`, 'success');
    } catch (err) {
      showToast(apiError(err, 'Could not save bill'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <AppLayout>
        <StoreTabs />
        <div className="max-w-md mx-auto bg-white rounded-xl border border-border-custom p-6 shadow-sm text-center">
          <CheckCircle2 className="mx-auto text-brand mb-2" size={40} />
          <h2 className="text-lg font-bold text-text">Bill {saved.billNo}</h2>
          <p className="text-3xl font-bold text-text my-2">{rupees(saved.total)}</p>
          <p className="text-sm text-text3">{saved.customerName || 'Walk-in'} · {paymentLabel(saved.paymentMode)}</p>
          {saved.total - saved.paidAmount > 0 && (
            <p className="text-sm mt-1">Paid {rupees(saved.paidAmount)} · <span className="text-danger font-bold">Due {rupees(saved.total - saved.paidAmount)}</span></p>
          )}
          {savedBalance != null && savedBalance > 0 && (
            <p className="text-sm text-text2 mt-1">Total outstanding: <b>{rupees(savedBalance)}</b></p>
          )}
          <div className="flex flex-col gap-2 mt-5">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => printBill(saved, 'thermal', savedBalance) || showToast('Allow pop-ups to print', 'error')}
                className="flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-bold">
                <Printer size={18} /> Print (80mm)
              </button>
              <button onClick={() => printBill(saved, 'a5', savedBalance) || showToast('Allow pop-ups to print', 'error')}
                className="flex items-center justify-center gap-2 border border-brand text-brand py-3 rounded-lg font-bold">
                <Printer size={18} /> Print (A5)
              </button>
            </div>
            <a href={whatsappBillUrl(saved, savedBalance)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-lg font-bold">
              <Send size={18} /> Send on WhatsApp
            </a>
            <button onClick={reset} className="py-3 rounded-lg border border-border-custom font-bold text-text">New bill</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <StoreTabs />

      <div className="grid lg:grid-cols-[1fr_420px] gap-4">
        {/* Items */}
        <div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
              <input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Search item / ಹುಡುಕಿ"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
            </div>
            <ItemFilter value={filter} onChange={setFilter} suppliers={suppliers} resultCount={visibleItems.length} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {visibleItems.map((r) => {
              const out = r.qtyOnHand <= 0;
              const n = inCart(r.item.id);
              const maxed = !out && n >= r.qtyOnHand;
              return (
                <button key={r.item.id} disabled={out || maxed} onClick={() => addItem(r)}
                  className={`text-left px-3 py-2 rounded-xl border shadow-sm transition-colors ${
                    out ? 'bg-surface2 border-border-custom opacity-50' : n > 0 ? 'bg-[#E8F5EE] border-brand' : 'bg-white border-border-custom hover:border-brand'
                  }`}>
                  <p className="font-bold text-text text-sm leading-tight">{itemLabel(r.item)}</p>
                  <p className="text-brand font-bold mt-1">{rupees(r.item.salePrice)}<span className="text-text3 font-normal text-[11px]"> /{r.item.unit}</span></p>
                  <p className={`text-[11px] ${r.lowStock ? 'text-danger' : 'text-text3'}`}>
                    {out ? 'Out of stock' : maxed ? `All ${qty(r.qtyOnHand)} in bill` : `Stock ${qty(r.qtyOnHand)}`}{n > 0 && !maxed && ` · In bill ${n}`}
                  </p>
                </button>
              );
            })}
            {visibleItems.length === 0 && <p className="text-sm text-text3 col-span-full">No items. Add items and stock first.</p>}
          </div>
        </div>

        {/* Bill */}
        <div className="bg-white rounded-xl border border-border-custom p-4 shadow-sm h-fit lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:flex lg:flex-col">
          {/* Customer */}
          <p className="text-[11px] font-bold text-text3 uppercase tracking-wide mb-1">Customer</p>
          {farmer ? (
            <div className="bg-surface2 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-text text-sm">{farmer.name}</p>
                  <p className="text-[12px] text-text3">{farmer.phone}{farmer.village && ` · ${farmer.village}`}</p>
                </div>
                <button onClick={() => setFarmer(null)} className="text-text3 hover:text-danger"><X size={16} /></button>
              </div>
              {account && (
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border-custom text-[12px]">
                  <span>
                    {account.balance > 0
                      ? <span className="text-danger font-bold">Owes {rupees(account.balance)}</span>
                      : <span className="text-brand font-bold">No dues</span>}
                    <span className="text-text3"> · {account.lastVisit ? `last visit ${daysAgo(account.lastVisit)}` : 'first visit'}</span>
                  </span>
                  {account.balance > 0 && !payment && (
                    <button onClick={() => setPayment({ amount: '', mode: 'CASH' })} className="flex items-center gap-1 text-brand font-bold">
                      <Wallet size={13} /> Receive payment
                    </button>
                  )}
                </div>
              )}
              {payment && account && (
                <div className="flex items-center gap-1.5 mt-2">
                  <input type="number" inputMode="decimal" autoFocus placeholder={`Max ${Math.round(account.balance)}`} value={payment.amount}
                    onChange={(e) => setPayment({ ...payment, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-24 h-8 px-2 border border-border-custom rounded-md text-sm text-right" />
                  {(['CASH', 'UPI'] as StorePaymentMode[]).map((m) => (
                    <button key={m} onClick={() => setPayment({ ...payment, mode: m })}
                      className={`h-8 px-2 rounded-md border text-[12px] font-bold ${payment.mode === m ? 'bg-brand text-white border-brand' : 'border-border-custom text-text2 bg-white'}`}>
                      {paymentLabel(m)}
                    </button>
                  ))}
                  <button onClick={receivePayment} disabled={!payment.amount} className="h-8 px-3 rounded-md bg-brand text-white text-[12px] font-bold disabled:opacity-50">Save</button>
                  <button onClick={() => setPayment(null)} className="text-text3"><X size={14} /></button>
                </div>
              )}
            </div>
          ) : newFarmer ? (
            <div className="space-y-2 mb-3">
              {(['name', 'phone', 'village'] as const).map((f) => (
                <input key={f} value={newFarmer[f]} onChange={(e) => setNewFarmer({ ...newFarmer, [f]: e.target.value })}
                  placeholder={f === 'name' ? 'Name' : f === 'phone' ? 'Phone (10 digits)' : 'Village'}
                  inputMode={f === 'phone' ? 'tel' : undefined}
                  className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
              ))}
              <div className="flex gap-2">
                <button onClick={saveFarmer} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-bold">Save contact</button>
                <button onClick={() => setNewFarmer(null)} className="px-3 py-2 border border-border-custom rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 text-text3" size={16} />
              <input value={farmerQuery} onChange={(e) => setFarmerQuery(e.target.value)} placeholder="Search contact by phone or name (blank = walk-in)"
                className="w-full pl-9 pr-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
              {farmerQuery.trim().length >= 2 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border-custom rounded-lg shadow-lg max-h-56 overflow-auto">
                  {farmerResults.map((f) => (
                    <button key={f.id} onClick={() => { setFarmer(f); setFarmerQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface2 text-sm">
                      <span className="font-bold">{f.name}</span> <span className="text-text3">{f.phone}</span>
                    </button>
                  ))}
                  <button onClick={() => setNewFarmer({ name: /\d/.test(farmerQuery) ? '' : farmerQuery, phone: /\d/.test(farmerQuery) ? farmerQuery : '', village: '' })}
                    className="w-full text-left px-3 py-2 hover:bg-surface2 text-sm text-brand font-bold flex items-center gap-2">
                    <UserPlus size={14} /> Add new contact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lines */}
          {cart.length === 0 ? (
            <p className="text-sm text-text3 py-6 text-center">Tap items to add them to the bill</p>
          ) : (
            // One compact row per line; the list scrolls so totals and Save stay in view.
            <div className="mb-3 lg:flex-1 lg:min-h-0 lg:overflow-auto -mx-1 px-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[10px] font-bold text-text3 uppercase tracking-wide pb-1 border-b border-border-custom">
                <span>Item ({cart.length})</span><span className="w-[88px] text-center">Qty</span><span className="w-16 text-right">Rate ₹</span><span className="w-[72px] text-right">Amount</span>
              </div>
              <ul className="divide-y divide-border-custom">
                {cart.map((l) => (
                  <li key={l.row.item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-1.5 group">
                    <div className="min-w-0 flex items-center gap-1">
                      <button onClick={() => updateLine(l.row.item.id, { qty: 0 })} title="Remove" className="text-text3 hover:text-danger shrink-0"><Trash2 size={13} /></button>
                      <p className="font-semibold text-text text-[13px] truncate" title={l.row.item.name}>{l.row.item.name}</p>
                    </div>
                    <div className="flex items-center w-[88px]">
                      <button onClick={() => updateLine(l.row.item.id, { qty: l.qty - 1 })} className="w-6 h-7 rounded-l-md border border-border-custom flex items-center justify-center"><Minus size={12} /></button>
                      <input type="number" inputMode="decimal" value={l.qty} min={0}
                        onChange={(e) => updateLine(l.row.item.id, { qty: Math.min(Number(e.target.value), l.row.qtyOnHand) })}
                        className="w-9 h-7 text-center border-y border-border-custom text-[13px]" />
                      <button onClick={() => addItem(l.row)} disabled={l.qty >= l.row.qtyOnHand} title={l.qty >= l.row.qtyOnHand ? 'No more in stock' : undefined}
                        className="w-6 h-7 rounded-r-md border border-border-custom flex items-center justify-center disabled:opacity-30"><Plus size={12} /></button>
                    </div>
                    <input type="number" inputMode="decimal" value={l.price}
                      onChange={(e) => updateLine(l.row.item.id, { price: Number(e.target.value) })}
                      className="w-16 h-7 text-right border border-border-custom rounded-md px-1.5 text-[13px]" />
                    <span className="font-bold text-text text-[13px] w-[72px] text-right">{rupees(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 text-sm border-t border-border-custom pt-3">
            <div className="flex justify-between"><span className="text-text2">Subtotal</span><span className="font-bold">{rupees(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-text2">Discount</span>
              <input type="number" inputMode="decimal" value={discount} min={0}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-24 h-8 text-right border border-border-custom rounded-lg px-2" />
            </div>
            <div className="flex justify-between text-lg"><span className="font-bold">Total</span><span className="font-bold text-brand">{rupees(total)}</span></div>
          </div>

          {/* Pay later / Part paid put the unpaid amount on the farmer's account, so they need a farmer. */}
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {(['CASH', 'UPI', 'CREDIT', 'MIXED'] as StorePaymentMode[]).map((m) => {
              const needsFarmer = (m === 'CREDIT' || m === 'MIXED') && !farmer;
              return (
                <button key={m} onClick={() => setMode(m)} disabled={needsFarmer}
                  title={needsFarmer ? 'Pick a contact first' : undefined}
                  className={`py-2 rounded-lg border font-bold text-[12px] disabled:opacity-40 ${mode === m ? 'bg-brand text-white border-brand' : 'border-border-custom text-text2'}`}>
                  {paymentLabel(m)}
                </button>
              );
            })}
          </div>
          {!farmer && <p className="text-[11px] text-text3 mt-1">Pick a contact to allow Pay later / Part paid.</p>}
          {mode === 'MIXED' && (
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-text2">Paid now ₹</span>
              <input type="number" inputMode="decimal" autoFocus value={paidNow} placeholder="0"
                onChange={(e) => setPaidNow(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-24 h-8 text-right border border-border-custom rounded-lg px-2" />
            </div>
          )}
          {dueOnBill > 0 && cart.length > 0 && (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px]">
              <div className="flex justify-between"><span>Due on this bill</span><b className="text-danger">{rupees(dueOnBill)}</b></div>
              {account && (
                <div className="flex justify-between"><span>Total outstanding after</span><b>{rupees(account.balance + dueOnBill)}</b></div>
              )}
            </div>
          )}
          <div className="mb-3" />

          <button onClick={submit}
            disabled={saving || cart.length === 0 || (mode === 'MIXED' && (paidOnBill <= 0 || paidOnBill >= total))}
            className="w-full bg-brand text-white py-3 rounded-lg font-bold disabled:opacity-50">
            {saving ? 'Saving…' : `Save bill · ${rupees(total)}`}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
