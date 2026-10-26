'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StoreTabs from '@/components/store/StoreTabs';
import BillHistoryModal from '@/components/store/BillHistoryModal';
import ItemFilter, { ItemFilterValue, NO_FILTER, matchesItemFilter } from '@/components/store/ItemFilter';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import {
  StockRow, StoreFarmer, StoreSale, StorePaymentMode, FarmerAccount, rupees, qty, itemLabel, apiError, whatsappBillUrl,
  printBill, paymentLabel, daysAgo, loadShopDetails, StoreSupplier,
  cachedGet, DEFAULT_VILLAGE, phoneError, REWARD_NAME, rewardsHowTo,
} from '@/lib/store';
import {
  Minus, Plus, Search, Send, Trash2, UserPlus, X, CheckCircle2, Printer, Wallet, History, Pencil, Gem,
} from 'lucide-react';

/** redeem: this line is taken with the contact's diamonds instead of money. */
interface CartLine { row: StockRow; qty: number; price: number; redeem?: boolean; }

interface NewContact { name: string; phone: string; village: string; }
const blankContact = (name = '', phone = ''): NewContact => ({ name, phone, village: DEFAULT_VILLAGE });

export default function BillingPage() {
  const { showToast } = useNotification();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [itemQuery, setItemQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [farmerQuery, setFarmerQuery] = useState('');
  const [farmerResults, setFarmerResults] = useState<StoreFarmer[]>([]);
  const [farmer, setFarmer] = useState<StoreFarmer | null>(null);
  const [newFarmer, setNewFarmer] = useState<NewContact | null>(null);
  const [newFarmerError, setNewFarmerError] = useState<string | null>(null);

  const [account, setAccount] = useState<FarmerAccount | null>(null);
  const [payment, setPayment] = useState<{ amount: number | ''; mode: StorePaymentMode } | null>(null);

  const [discount, setDiscount] = useState(0);
  const [mode, setMode] = useState<StorePaymentMode>('CASH');
  const [paidNow, setPaidNow] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<StoreSale | null>(null);
  const [savedBalance, setSavedBalance] = useState<number | undefined>();
  const [savedCoins, setSavedCoins] = useState<number | undefined>();

  // Bill history. Only the owner account (user id 1) may edit or delete a bill that was already generated.
  const [showHistory, setShowHistory] = useState(false);
  const [canModify, setCanModify] = useState(false);
  const [editing, setEditing] = useState<StoreSale | null>(null);
  useEffect(() => {
    api.get('/store/sales/permissions').then((r) => setCanModify(!!r.data?.canModify)).catch(() => setCanModify(false));
  }, []);

  /**
   * Loads a bill into the cart so it can be changed and saved over itself. contents: an older
   * version of the same bill (from its change log) to put back instead of the current one.
   */
  const startEdit = (sale: StoreSale, contents: StoreSale = sale) => {
    setSaved(null);
    setEditing({ ...sale, saleDate: contents.saleDate });
    setShowHistory(false);
    setNewFarmer(null);
    setFarmer(contents.farmer ?? null);
    setFarmerQuery('');
    setDiscount(contents.discount || 0);
    setMode(contents.paymentMode);
    setPaidNow(contents.paymentMode === 'MIXED' ? contents.paidAmount : '');
    setCart(contents.lines.map((l) => {
      const row = stock.find((r) => r.item.id === l.item.id);
      // The current bill's own quantity goes back into stock when it is saved, so allow for it.
      const back = sale.lines.filter((x) => x.item.id === l.item.id).reduce((s, x) => s + x.qty, 0);
      const base: StockRow = row ?? { item: l.item, qtyOnHand: 0, stockValue: 0, lowStock: false };
      return { row: { ...base, qtyOnHand: base.qtyOnHand + back }, qty: l.qty, price: l.unitPrice, redeem: !!l.redeemed };
    }));
  };

  // Balance, diamonds and last visit for the picked contact; credit and diamonds need a contact.
  useEffect(() => {
    setAccount(null); setPayment(null);
    if (!farmer) {
      setMode((m) => (m === 'CREDIT' || m === 'MIXED' ? 'CASH' : m));
      setCart((c) => (c.some((l) => l.redeem) ? c.map((l) => ({ ...l, redeem: false })) : c));
      return;
    }
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

  // Diamonds. While editing a bill, what it earned and spent is given back before it is saved again.
  const coinsOf = (l: CartLine) => (l.row.item.rewardCoins ?? 0) * l.qty;
  const coinsUsed = cart.reduce((s, l) => s + (l.redeem ? coinsOf(l) : 0), 0);
  const sameContactAsEdited = !!editing && editing.farmer?.id === farmer?.id;
  const coinsAvailable = (account?.rewardCoins ?? 0)
    + (sameContactAsEdited ? (editing!.coinsRedeemed ?? 0) - (editing!.coinsEarned ?? 0) : 0);

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const rewardValue = cart.reduce((s, l) => s + (l.redeem ? l.qty * l.price : 0), 0);
  const total = Math.max(0, subtotal - discount - rewardValue);
  const paidOnBill = mode === 'CREDIT' ? 0 : mode === 'MIXED' ? Number(paidNow || 0) : total;
  const dueOnBill = Math.max(0, total - paidOnBill);

  const saveFarmer = async () => {
    if (!newFarmer) return;
    if (!newFarmer.name.trim()) { setNewFarmerError('Please enter the customer name'); return; }
    const phoneMsg = phoneError(newFarmer.phone);
    if (phoneMsg) { setNewFarmerError(phoneMsg); showToast(phoneMsg, 'error'); return; }
    try {
      const r = await api.post('/store/farmers', newFarmer);
      setFarmer(r.data);
      setNewFarmer(null);
      setNewFarmerError(null);
      setFarmerQuery('');
    } catch (err) {
      showToast(apiError(err, 'Could not save contact'), 'error');
    }
  };

  /** Clears everything for the next customer: items, contact (picked or half-typed), payment. */
  const reset = () => {
    setCart([]); setFarmer(null); setFarmerQuery(''); setFarmerResults([]); setNewFarmer(null); setNewFarmerError(null);
    setAccount(null); setPayment(null); setItemQuery('');
    setDiscount(0); setMode('CASH'); setPaidNow(''); setSaved(null); setSavedBalance(undefined); setSavedCoins(undefined); setEditing(null);
    loadStock();
  };

  const submit = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const body = {
        farmerId: farmer?.id,
        ...(editing && !farmer ? { customerName: editing.customerName, customerPhone: editing.customerPhone } : {}),
        ...(editing ? { saleDate: editing.saleDate } : {}),
        discount,
        paymentMode: mode,
        paidAmount: mode === 'MIXED' ? paidNow : undefined,
        lines: cart.map((l) => ({ itemId: l.row.item.id, qty: l.qty, unitPrice: l.price, redeem: !!l.redeem })),
      };
      const r = editing ? await api.put(`/store/sales/${editing.id}`, body) : await api.post('/store/sales', body);
      const sale: StoreSale = r.data;
      setSavedBalance(undefined); setSavedCoins(undefined);
      if (sale.farmer) {
        // Fresh balance and diamonds after this bill, for the receipt.
        api.get(`/store/farmers/${sale.farmer.id}/account`)
          .then((a) => { setSavedBalance(a.data.balance); setSavedCoins(a.data.rewardCoins); })
          .catch(() => {});
      }
      setSaved(sale);
      loadStock(); // so "Edit this bill" starts from the stock left after this bill
      showToast(`Bill ${sale.billNo} ${editing ? 'updated' : 'saved'}`, 'success');
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
        <div className="max-w-md mx-auto bg-white rounded-xl border border-border-custom p-5 shadow-sm">
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-brand mb-2" size={40} />
            <h2 className="text-lg font-bold text-text">Bill {saved.billNo}</h2>
            <p className="text-3xl font-bold text-text my-2">{rupees(saved.total)}</p>
            <p className="text-sm text-text3">{saved.customerName || 'Walk-in'} · {paymentLabel(saved.paymentMode)}</p>
          </div>

          {/* What was billed, so staff can check it with the customer. */}
          <ul className="mt-4 border-y border-border-custom divide-y divide-border-custom">
            {saved.lines.map((l) => (
              <li key={l.id} className="py-2 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-text break-words">{l.item.name}</p>
                  <p className="text-[12px] text-text3">
                    {qty(l.qty)} × {rupees(l.unitPrice)}{l.redeemed && <span className="text-brand font-bold"> · 💎 diamonds</span>}
                  </p>
                </div>
                <span className="font-bold text-text shrink-0">{rupees(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="text-sm space-y-0.5 mt-2">
            {(saved.discount > 0 || !!saved.rewardValue) && <div className="flex justify-between"><span className="text-text2">Subtotal</span><span>{rupees(saved.subtotal)}</span></div>}
            {saved.discount > 0 && <div className="flex justify-between"><span className="text-text2">Discount</span><span>-{rupees(saved.discount)}</span></div>}
            {!!saved.rewardValue && <div className="flex justify-between"><span className="text-text2">Paid with diamonds</span><span>-{rupees(saved.rewardValue)}</span></div>}
            {saved.total - saved.paidAmount > 0 && (
              <div className="flex justify-between"><span>Paid {rupees(saved.paidAmount)}</span><span className="text-danger font-bold">Due {rupees(saved.total - saved.paidAmount)}</span></div>
            )}
            {savedBalance != null && savedBalance > 0 && (
              <div className="flex justify-between text-text2"><span>Total outstanding</span><b>{rupees(savedBalance)}</b></div>
            )}
          </div>

          {saved.farmer && (
            <div className="mt-3 rounded-lg bg-[#EEF6FF] border border-[#CFE3FA] px-3 py-2 text-[12px] text-[#1E4E8C]">
              <p className="font-bold flex items-center gap-1"><Gem size={13} /> {REWARD_NAME}</p>
              <p>
                {saved.coinsEarned ? `Earned ${saved.coinsEarned} on this bill` : 'No diamonds earned on this bill'}
                {saved.coinsRedeemed ? ` · used ${saved.coinsRedeemed}` : ''}
                {savedCoins != null && <> · balance <b>{savedCoins}</b></>}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-5">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => printBill(saved, 'thermal', savedBalance, savedCoins)}
                className="flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-lg font-bold">
                <Printer size={18} /> Print (80mm)
              </button>
              <button onClick={() => printBill(saved, 'a5', savedBalance, savedCoins)}
                className="flex items-center justify-center gap-2 border border-brand text-brand py-3 rounded-lg font-bold">
                <Printer size={18} /> Print (A5)
              </button>
            </div>
            <a href={whatsappBillUrl(saved, savedBalance, savedCoins)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-lg font-bold">
              <Send size={18} /> Send on WhatsApp
            </a>
            <div className={`grid gap-2 ${canModify ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {canModify && (
                <button onClick={() => startEdit(saved)}
                  className="flex items-center justify-center gap-2 py-3 rounded-lg border border-border-custom font-bold text-text2">
                  <Pencil size={16} /> Edit this bill
                </button>
              )}
              <button onClick={reset} className="py-3 rounded-lg border border-border-custom font-bold text-text">New bill</button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const hasDraft = cart.length > 0 || !!farmer || !!newFarmer || farmerQuery.trim() !== '';

  return (
    <AppLayout>
      <StoreTabs action={
        <button onClick={() => setShowHistory(true)} title="Bill history" aria-label="Bill history"
          className="flex items-center gap-1.5 p-2.5 sm:px-3 sm:py-2 rounded-lg border border-border-custom bg-white text-sm font-bold text-text2 hover:border-brand hover:text-brand shrink-0">
          {/* Icon only on phones, to keep the top row on one line. */}
          <History size={16} /><span className="hidden sm:inline">History</span>
        </button>
      } />

      {editing && (
        <div className="flex items-center justify-between gap-2 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
          <span>Editing bill <b>{editing.billNo}</b>. Saving replaces it, redoes its stock and credit, and is recorded in its change log.</span>
          <button onClick={reset} className="text-amber-800 font-bold hover:underline shrink-0">Cancel edit</button>
        </div>
      )}
      {showHistory && <BillHistoryModal onClose={() => setShowHistory(false)} canModify={canModify} onEdit={startEdit} />}

      <div className="grid lg:grid-cols-[1fr_420px] gap-4">
        {/* Items */}
        <div className="min-w-0">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
              <input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Search item / ಹುಡುಕಿ"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
            </div>
            <ItemFilter value={filter} onChange={setFilter} suppliers={suppliers} resultCount={visibleItems.length} />
          </div>
          {/* Phones: two rows that scroll left and right, so the bill stays just below.
              Bigger screens: a normal grid. */}
          <div className="grid grid-rows-2 grid-flow-col auto-cols-[44%] overflow-x-auto snap-x pb-1 -mx-4 px-4 scroll-px-4
            sm:mx-0 sm:px-0 sm:pb-0 sm:grid-rows-none sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 xl:grid-cols-4 sm:overflow-visible gap-2">
            {visibleItems.map((r) => {
              const out = r.qtyOnHand <= 0;
              const n = inCart(r.item.id);
              const maxed = !out && n >= r.qtyOnHand;
              return (
                <button key={r.item.id} disabled={out || maxed} onClick={() => addItem(r)}
                  className={`snap-start text-left px-3 py-2 rounded-xl border shadow-sm transition-colors ${
                    out ? 'bg-surface2 border-border-custom opacity-50' : n > 0 ? 'bg-[#E8F5EE] border-brand' : 'bg-white border-border-custom hover:border-brand'
                  }`}>
                  <p className="font-bold text-text text-sm leading-tight">{itemLabel(r.item)}</p>
                  <p className="text-brand font-bold mt-1">{rupees(r.item.salePrice)}<span className="text-text3 font-normal text-[11px]"> /{r.item.unit}</span></p>
                  <p className={`text-[11px] ${r.lowStock ? 'text-danger' : 'text-text3'}`}>
                    {out ? 'Out of stock' : maxed ? `All ${qty(r.qtyOnHand)} in bill` : `Stock ${qty(r.qtyOnHand)}`}{n > 0 && !maxed && ` · In bill ${n}`}
                  </p>
                  {!!r.item.rewardCoins && <p className="text-[11px] text-[#1E4E8C] font-bold">💎 {r.item.rewardCoins} diamonds</p>}
                </button>
              );
            })}
            {visibleItems.length === 0 && <p className="text-sm text-text3 col-span-full">No items. Add items and stock first.</p>}
          </div>
        </div>

        {/* Bill */}
        <div className="bg-white rounded-xl border border-border-custom p-4 shadow-sm h-fit lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:flex lg:flex-col">
          {/* Customer */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold text-text3 uppercase tracking-wide">Customer</p>
            {!editing && hasDraft && (
              <button onClick={reset} className="flex items-center gap-1 text-[12px] font-bold text-text3 hover:text-danger">
                <X size={13} /> Clear bill
              </button>
            )}
          </div>
          {farmer ? (
            <div className="bg-surface2 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-text text-sm">{farmer.name}</p>
                  <p className="text-[12px] text-text3">{[farmer.phone || 'No phone', farmer.village].filter(Boolean).join(' · ')}</p>
                </div>
                <button onClick={() => setFarmer(null)} aria-label="Remove contact" className="text-text3 hover:text-danger"><X size={16} /></button>
              </div>
              {account && (
                <>
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
                  <p className="text-[12px] text-[#1E4E8C] mt-1" title={rewardsHowTo()}>
                    💎 <b>{coinsAvailable}</b> diamonds{coinsUsed > 0 && <> · using <b>{coinsUsed}</b> on this bill</>}
                  </p>
                </>
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
              <input value={newFarmer.name} autoFocus onChange={(e) => { setNewFarmer({ ...newFarmer, name: e.target.value }); setNewFarmerError(null); }}
                placeholder="Name (required)"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-bold placeholder:font-normal focus:outline-none ${
                  newFarmerError && !newFarmer.name.trim() ? 'border-danger bg-red-50 focus:border-danger' : 'border-border-custom focus:border-brand'}`} />
              <input value={newFarmer.phone} inputMode="tel" onChange={(e) => { setNewFarmer({ ...newFarmer, phone: e.target.value }); setNewFarmerError(null); }}
                placeholder="Phone (10 digits, optional)"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-brand ${newFarmerError && phoneError(newFarmer.phone) ? 'border-danger' : 'border-border-custom'}`} />
              {/* Village starts as the shop's village; the cross clears it to type another. */}
              <div className="relative">
                <input value={newFarmer.village} onChange={(e) => setNewFarmer({ ...newFarmer, village: e.target.value })} placeholder="Village"
                  className="w-full pl-3 pr-9 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
                {newFarmer.village && (
                  <button type="button" onClick={() => setNewFarmer({ ...newFarmer, village: '' })} aria-label="Clear village"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-text3 hover:text-danger"><X size={16} /></button>
                )}
              </div>
              {newFarmerError && <p className="text-[12px] text-danger font-semibold">{newFarmerError}</p>}
              <div className="flex gap-2">
                <button onClick={saveFarmer} className="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-bold">Save contact</button>
                <button onClick={() => { setNewFarmer(null); setNewFarmerError(null); }} className="px-3 py-2 border border-border-custom rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="relative mb-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-text3" size={16} />
                <input value={farmerQuery} onChange={(e) => setFarmerQuery(e.target.value)} placeholder="Search contact by phone or name (blank = walk-in)"
                  className="w-full pl-9 pr-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
              </div>
              <button onClick={() => setNewFarmer(/\d/.test(farmerQuery) ? blankContact('', farmerQuery) : blankContact(farmerQuery.trim()))}
                title="Add new contact" aria-label="Add new contact"
                className="shrink-0 px-2.5 rounded-lg border border-border-custom text-brand hover:border-brand"><UserPlus size={18} /></button>
              {farmerQuery.trim().length >= 2 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-border-custom rounded-lg shadow-lg max-h-56 overflow-auto">
                  {farmerResults.map((f) => (
                    <button key={f.id} onClick={() => { setFarmer(f); setFarmerQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-surface2 text-sm">
                      <span className="font-bold">{f.name}</span> <span className="text-text3">{[f.phone, f.village].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  <button onClick={() => setNewFarmer(/\d/.test(farmerQuery) ? blankContact('', farmerQuery) : blankContact(farmerQuery.trim()))}
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
            // Each line: full item name on top, then qty / rate / amount, so names are never cut off.
            // The list scrolls on big screens so totals and Save stay in view.
            <div className="mb-3 lg:flex-1 lg:min-h-0 lg:overflow-auto -mx-1 px-1">
              <p className="text-[11px] font-bold text-text3 uppercase tracking-wide pb-1 border-b border-border-custom">Items ({cart.length})</p>
              <ul className="divide-y divide-border-custom">
                {cart.map((l) => {
                  const coins = coinsOf(l);
                  const canRedeem = !!farmer && !!account && !!l.row.item.rewardCoins && Number.isInteger(l.qty);
                  const affordable = l.redeem || coinsUsed + coins <= coinsAvailable;
                  return (
                    <li key={l.row.item.id} className="py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-text text-[14px] leading-snug break-words min-w-0">{itemLabel(l.row.item)}</p>
                        <button onClick={() => updateLine(l.row.item.id, { qty: 0 })} title="Remove" aria-label={`Remove ${l.row.item.name}`}
                          className="text-text3 hover:text-danger shrink-0 p-1 -m-1"><Trash2 size={15} /></button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center">
                          <button onClick={() => updateLine(l.row.item.id, { qty: l.qty - 1 })} aria-label="Less"
                            className="w-8 h-8 rounded-l-md border border-border-custom flex items-center justify-center"><Minus size={14} /></button>
                          <input type="number" inputMode="decimal" value={l.qty} min={0}
                            onChange={(e) => updateLine(l.row.item.id, { qty: Math.min(Number(e.target.value), l.row.qtyOnHand) })}
                            className="w-11 h-8 text-center border-y border-border-custom text-[14px]" />
                          <button onClick={() => addItem(l.row)} disabled={l.qty >= l.row.qtyOnHand} aria-label="More"
                            title={l.qty >= l.row.qtyOnHand ? 'No more in stock' : undefined}
                            className="w-8 h-8 rounded-r-md border border-border-custom flex items-center justify-center disabled:opacity-30"><Plus size={14} /></button>
                        </div>
                        <span className="text-text3 text-[13px]">×</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 text-[13px]">₹</span>
                          <input type="number" inputMode="decimal" value={l.price} aria-label="Rate"
                            onChange={(e) => updateLine(l.row.item.id, { price: Number(e.target.value) })}
                            className="w-20 h-8 text-right border border-border-custom rounded-md pl-5 pr-1.5 text-[14px]" />
                        </div>
                        <span className={`ml-auto font-bold text-[14px] text-right ${l.redeem ? 'text-[#1E4E8C] line-through decoration-1' : 'text-text'}`}>
                          {rupees(l.qty * l.price)}
                        </span>
                      </div>
                      {canRedeem && (
                        <button onClick={() => updateLine(l.row.item.id, { redeem: !l.redeem })} disabled={!affordable}
                          title={affordable ? undefined : `Needs ${coins} diamonds; ${coinsAvailable - coinsUsed} left`}
                          className={`mt-1.5 text-[12px] font-bold px-2 py-1 rounded-md border disabled:opacity-40 ${
                            l.redeem ? 'bg-[#1E4E8C] text-white border-[#1E4E8C]' : 'border-[#CFE3FA] text-[#1E4E8C] bg-[#EEF6FF]'}`}>
                          💎 {l.redeem ? `Taken with ${coins} diamonds · undo` : `Take with ${coins} diamonds`}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2 text-sm border-t border-border-custom pt-3">
            <div className="flex justify-between"><span className="text-text2">Subtotal</span><span className="font-bold">{rupees(subtotal)}</span></div>
            {rewardValue > 0 && (
              <div className="flex justify-between text-[#1E4E8C]"><span>Paid with diamonds</span><span className="font-bold">-{rupees(rewardValue)}</span></div>
            )}
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
            {saving ? 'Saving…' : `${editing ? 'Update bill' : 'Save bill'} · ${rupees(total)}`}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
