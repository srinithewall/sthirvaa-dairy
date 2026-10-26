'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StoreTabs from '@/components/store/StoreTabs';
import Portal from '@/components/store/Portal';
import Combobox from '@/components/store/Combobox';
import ItemFilter, { ItemFilterValue, NO_FILTER } from '@/components/store/ItemFilter';
import ConfirmDialog from '@/components/store/ConfirmDialog';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import {
  StoreItem, StorePurchase, StoreSupplier, StoreUnit, StoreItemCategory, CATEGORIES, categoryLabel, UNITS, packLabel, rupees, qty, todayIso, apiError, cachedGet, clearStoreCache, brandMatches, currentRole,
} from '@/lib/store';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

// Supplier and item are typed: an existing name is picked, an unknown name is created on save.
// Selling price and margin % are linked (change one, the other follows): 10% by default, 5% minimum.
// Expiry defaults to 6 months after the bill date and can be changed per line.
const DEFAULT_MARGIN = 10;
const MIN_MARGIN = 5;
const EXPIRY_MONTHS = 6;
// Qty, cost and selling price are at most 4 digits; margin is 0–999.9.
const MAX_AMOUNT = 9999;
const MAX_MARGIN = 999.9;
/** Typed value as a number, '' when cleared, or null to reject the keystroke (negative or over max). */
const upTo = (v: string, max: number): number | '' | null => {
  if (v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) || n < 0 || n > max ? null : n;
};

interface Line {
  itemName: string; newBrand: string; newUnitSize: number | ''; newUnit: StoreUnit; newCategory: StoreItemCategory;
  qty: number | ''; unitCost: number | ''; margin: number | ''; salePrice: number | '';
  expiryDate: string; expiryEdited: boolean; batchNo?: string;
}

const addMonths = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const blankLine = (billDate: string): Line => ({
  itemName: '', newBrand: '', newUnitSize: '', newUnit: 'BAG', newCategory: 'FEED',
  qty: '', unitCost: '', margin: DEFAULT_MARGIN, salePrice: '',
  expiryDate: addMonths(billDate, EXPIRY_MONTHS), expiryEdited: false,
});
const priceFrom = (cost: number | '', margin: number | ''): number | '' =>
  cost === '' || margin === '' ? '' : Math.round(Number(cost) * (1 + Number(margin) / 100));
const marginFrom = (cost: number | '', price: number | ''): number | '' =>
  cost === '' || price === '' || Number(cost) <= 0 ? '' : Math.round((Number(price) / Number(cost) - 1) * 1000) / 10;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function StorePurchasesPage() {
  const { showToast } = useNotification();
  const [purchases, setPurchases] = useState<StorePurchase[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StorePurchase | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(todayIso());
  const [paid, setPaid] = useState<number | ''>('');
  const [lines, setLines] = useState<Line[]>([blankLine(todayIso())]);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => setIsAdmin(currentRole() === 'ADMIN'), []);

  // Typed supplier → existing supplier (if the name matches) or a new one.
  const supplier = suppliers.find((s) => sameName(s.name, supplierName));
  const isNewSupplier = !supplier && supplierName.trim() !== '';
  // Suggestions list only this supplier's products: linked to them, or brand matching their name.
  const supplierItems = supplier
    ? items.filter((it) => it.supplierIds?.includes(supplier.id) || brandMatches(it.brand, supplier.name))
    : [];
  // The item dropdown: the picked supplier's products, or every product when no supplier is picked yet.
  const itemChoices = supplier ? supplierItems : isNewSupplier ? [] : items;
  // Any existing item can still be matched by its exact name, so names never get duplicated.
  const itemFor = (name: string) => items.find((it) => sameName(it.name, name));

  const load = () =>
    Promise.all([api.get('/store/purchases'), cachedGet<StoreItem[]>('/store/items'), cachedGet<StoreSupplier[]>('/store/suppliers')])
      .then(([p, i, s]) => {
        setPurchases(p.data); setItems(i); setSuppliers(s);
        return i;
      })
      .catch((err) => { showToast(apiError(err, 'Failed to load purchases'), 'error'); return [] as StoreItem[]; });

  useEffect(() => {
    load().then((loaded) => {
      // Opened from Stock's "+ Stock In" link: start a bill with that item on it.
      const itemId = Number(new URLSearchParams(window.location.search).get('item'));
      const item = loaded.find((it) => it.id === itemId);
      if (item) {
        setLines([{ ...blankLine(todayIso()), itemName: item.name }]);
        setOpen(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bill list search and filter: supplier = the bill's supplier, type = bill has an item of that type.
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilterValue>(NO_FILTER);
  const visiblePurchases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchases.filter((p) =>
      (!q || (p.billNo ?? '').toLowerCase().includes(q) || (p.supplier?.name ?? '').toLowerCase().includes(q)
        || p.lines.some((l) => l.item.name.toLowerCase().includes(q)))
      && (filter.supplierId === '' || p.supplier?.id === filter.supplierId)
      && (filter.type === '' || p.lines.some((l) => l.item.category === filter.type)));
  }, [purchases, query, filter]);

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unitCost || 0), 0);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const changeDate = (d: string) => {
    setDate(d);
    // Default expiries follow the bill date; ones typed by hand are kept.
    setLines((ls) => ls.map((l) => (l.expiryEdited ? l : { ...l, expiryDate: addMonths(d, EXPIRY_MONTHS) })));
  };

  const reset = () => {
    setEditing(null); setSupplierName(''); setBillNo(''); setDate(todayIso()); setPaid(''); setLines([blankLine(todayIso())]);
  };

  const [deleting, setDeleting] = useState<StorePurchase | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const deleteBill = (p: StorePurchase) => setDeleting(p);
  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/store/purchases/${deleting.id}`);
      clearStoreCache();
      showToast('Bill deleted', 'success');
      setDeleting(null);
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not delete bill'), 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  const startEdit = (p: StorePurchase) => {
    setEditing(p);
    setSupplierName(p.supplier?.name ?? ''); setBillNo(p.billNo ?? ''); setDate(p.purchaseDate);
    setPaid(p.paid < p.total ? p.paid : '');
    setLines(p.lines.map((l) => ({
      ...blankLine(p.purchaseDate), itemName: l.item.name, qty: l.qty, unitCost: l.unitCost, batchNo: l.batchNo,
      expiryDate: l.expiryDate ?? addMonths(p.purchaseDate, EXPIRY_MONTHS), expiryEdited: true,
      salePrice: l.item.salePrice, margin: marginFrom(l.unitCost, l.item.salePrice),
    })));
    setOpen(true);
  };

  const save = async () => {
    const valid = lines.filter((l) => l.itemName.trim() && Number(l.qty) > 0 && l.unitCost !== '');
    if (valid.length === 0) { showToast('Add at least one item with quantity and cost', 'error'); return; }
    const lowMargin = valid.find((l) => l.salePrice === '' || Number(l.salePrice) < Number(l.unitCost) * (1 + MIN_MARGIN / 100));
    if (lowMargin) {
      showToast(`${lowMargin.itemName}: margin must be at least ${MIN_MARGIN}% (sell at ${rupees(Math.ceil(Number(lowMargin.unitCost) * (1 + MIN_MARGIN / 100)))} or more)`, 'error');
      return;
    }
    setSaving(true);
    try {
      let sid = supplier?.id;
      if (!sid && isNewSupplier) {
        sid = (await api.post('/store/suppliers', { name: supplierName.trim() })).data.id;
      }
      const body = {
        supplierId: sid,
        billNo: billNo || undefined,
        purchaseDate: date,
        paid: paid === '' ? undefined : paid,
        notes: editing?.notes,
        lines: valid.map((l) => {
          const existing = itemFor(l.itemName);
          return {
            itemId: existing?.id,
            newItem: existing ? undefined : {
              name: l.itemName.trim(), brand: l.newBrand.trim() || undefined, unitSize: l.newUnitSize || undefined, unit: l.newUnit, category: l.newCategory,
            },
            qty: l.qty, unitCost: l.unitCost, salePrice: l.salePrice, batchNo: l.batchNo, expiryDate: l.expiryDate || undefined,
          };
        }),
      };
      if (editing) await api.put(`/store/purchases/${editing.id}`, body);
      else await api.post('/store/purchases', body);
      // Saving may create items/suppliers and links the supplier to these items.
      clearStoreCache();
      showToast(editing ? 'Bill updated' : 'Stock added', 'success');
      setOpen(false);
      reset();
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not save purchase'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const label = 'block text-xs font-bold text-text2 uppercase tracking-wide mb-1';
  const input = 'w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand bg-white';
  const num = 'w-full px-2 py-2 border border-border-custom rounded-lg text-sm text-right focus:outline-none focus:border-brand bg-white';

  return (
    <AppLayout>
      <StoreTabs action={
        <button onClick={() => { reset(); setOpen(true); }} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap">
          <Plus size={16} /> <span className="hidden sm:inline">Add supplier bill</span><span className="sm:hidden">Add bill</span>
        </button>
      } />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bill no., supplier or item"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
        </div>
        <ItemFilter value={filter} onChange={setFilter} suppliers={suppliers} resultCount={visiblePurchases.length} noun="bill" />
      </div>

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden shadow-sm">
        <ul className="divide-y divide-border-custom">
          {visiblePurchases.map((p) => (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="flex justify-between">
                <p className="font-bold text-text">{p.supplier?.name || 'No supplier'}{p.billNo && <span className="text-text3 font-normal"> · #{p.billNo}</span>}</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-text">{rupees(p.total)}</p>
                  <button onClick={() => startEdit(p)} className="p-1 text-text3 hover:text-brand" title="Edit bill"><Pencil size={15} /></button>
                  {isAdmin && (
                    <button onClick={() => deleteBill(p)} className="p-1 text-text3 hover:text-danger" title="Delete bill"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-[12px] text-text3">
                <span>{p.purchaseDate} · {p.lines.map((l) => `${l.item.name} × ${qty(l.qty)}`).join(', ')}</span>
                {p.paid < p.total && <span className="text-danger font-bold">Due {rupees(p.total - p.paid)}</span>}
              </div>
            </li>
          ))}
          {purchases.length === 0 && <li className="p-6 text-center text-sm text-text3">No stock received in the last 30 days.</li>}
          {purchases.length > 0 && visiblePurchases.length === 0 && <li className="p-6 text-center text-sm text-text3">No bills match the search or filter.</li>}
        </ul>
      </div>

      {open && (
        <Portal>
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl p-6 max-h-[95vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit supplier bill' : 'Supplier bill'}</h2>
              <button onClick={() => setOpen(false)}><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr] gap-3 mb-4">
              <label className="block col-span-2 sm:col-span-1">
                <span className={label}>Supplier</span>
                <Combobox value={supplierName} onChange={setSupplierName} autoFocus={!editing} placeholder="Type or pick supplier"
                  options={suppliers.map((s) => ({ value: s.name }))} className={input} />
              </label>
              <label className="block">
                <span className={label}>Bill no.</span>
                <input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Optional" className={input} />
              </label>
              <label className="block">
                <span className={label}>Bill date</span>
                <input type="date" value={date} max={todayIso()} onChange={(e) => changeDate(e.target.value)} className={input} />
              </label>
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => {
                const existing = l.itemName.trim() ? itemFor(l.itemName) : undefined;
                const isNew = !existing && l.itemName.trim() !== '';
                const belowMin = l.unitCost !== '' && l.margin !== '' && Number(l.margin) < MIN_MARGIN;
                return (
                  <div key={i} className="rounded-xl border border-border-custom p-3">
                    {/* One row: item takes the free space; number boxes are sized for ~4 digits. */}
                    <div className="grid grid-cols-4 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_4.5rem_5.5rem_9.5rem_auto] gap-2 items-end">
                      <label className="col-span-4 sm:col-span-1">
                        <span className={label}>Item</span>
                        <Combobox value={l.itemName} className={input}
                          placeholder={itemChoices.length ? 'Type or pick item' : 'Type item name'}
                          options={itemChoices.map((it) => ({ value: it.name, hint: [it.brand, packLabel(it)].filter(Boolean).join(' · ') }))}
                          onChange={(itemName) => {
                            const match = itemFor(itemName);
                            // Picking an existing item starts from its current selling price.
                            setLine(i, match && l.unitCost !== ''
                              ? { itemName, salePrice: match.salePrice, margin: marginFrom(l.unitCost, match.salePrice) }
                              : { itemName });
                          }} />
                      </label>
                      <label><span className={label}>Qty</span>
                        <input type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} value={l.qty}
                          onChange={(e) => { const qty = upTo(e.target.value, MAX_AMOUNT); if (qty !== null) setLine(i, { qty }); }} className={num} /></label>
                      <label><span className={label}>Cost ₹</span>
                        <input type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} value={l.unitCost}
                          onChange={(e) => {
                            const unitCost = upTo(e.target.value, MAX_AMOUNT); if (unitCost === null) return;
                            setLine(i, { unitCost, salePrice: priceFrom(unitCost, l.margin) });
                          }} className={num} /></label>
                      <label><span className={label}>Margin %</span>
                        <input type="number" inputMode="decimal" min={MIN_MARGIN} step={0.1} value={l.margin}
                          onChange={(e) => {
                            // At most one decimal place.
                            const raw = upTo(e.target.value, MAX_MARGIN); if (raw === null) return; const margin = raw === '' ? '' : Math.round(raw * 10) / 10;
                            setLine(i, { margin, salePrice: priceFrom(l.unitCost, margin) });
                          }} className={`${num} ${belowMin ? 'border-danger text-danger' : ''}`} /></label>
                      <label><span className={label}>Sell at ₹</span>
                        <input type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} value={l.salePrice}
                          onChange={(e) => {
                            const salePrice = upTo(e.target.value, MAX_AMOUNT); if (salePrice === null) return;
                            setLine(i, { salePrice, margin: marginFrom(l.unitCost, salePrice) });
                          }} className={`${num} font-bold ${belowMin ? 'border-danger text-danger' : ''}`} /></label>
                      <label className="col-span-3 sm:col-span-1"><span className={label}>Expiry</span>
                        <input type="date" value={l.expiryDate} onChange={(e) => setLine(i, { expiryDate: e.target.value, expiryEdited: true })}
                          className={`${input} px-2`} /></label>
                      <button onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [blankLine(date)]))}
                        title="Remove line" className="text-text3 hover:text-danger p-2 justify-self-end"><Trash2 size={16} /></button>
                    </div>

                    {isNew ? (
                      <div className="grid grid-cols-2 sm:grid-cols-[10rem_minmax(0,1fr)_14rem] gap-2 mt-2 items-end sm:w-5/6">
                        <label><span className={label}>Type</span>
                          <select value={l.newCategory} onChange={(e) => setLine(i, { newCategory: e.target.value as StoreItemCategory })} className={input}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                          </select></label>
                        <label><span className={label}>Brand</span>
                          <input value={l.newBrand} placeholder={supplierName || 'e.g. Cargill'} onChange={(e) => setLine(i, { newBrand: e.target.value })} className={input} /></label>
                        <label><span className={label}>Pack</span>
                          <div className="flex gap-1">
                            <input type="number" inputMode="decimal" value={l.newUnitSize} placeholder="50"
                              onChange={(e) => setLine(i, { newUnitSize: e.target.value === '' ? '' : Number(e.target.value) })} className={`${num} w-16`} />
                            <select value={l.newUnit} onChange={(e) => setLine(i, { newUnit: e.target.value as StoreUnit })} className={input}>
                              {UNITS.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </div></label>
                      </div>
                    ) : existing && (
                      <p className="text-[11px] text-text3 mt-1">
                        {[existing.brand, packLabel(existing), `now ${rupees(existing.salePrice)}`].filter(Boolean).join(' · ')}
                        {l.salePrice !== '' && Number(l.salePrice) !== existing.salePrice &&
                          <span className="text-amber-700"> → {rupees(Number(l.salePrice))}</span>}
                      </p>
                    )}
                    {belowMin && <p className="text-[11px] text-danger mt-1">Margin must be at least {MIN_MARGIN}%.</p>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setLines((ls) => [...ls, blankLine(date)])} title="Add another item" aria-label="Add another item"
              className="mt-2 w-9 h-9 rounded-full border border-brand text-brand flex items-center justify-center hover:bg-brand hover:text-white">
              <Plus size={18} />
            </button>

            <div className="mt-4 border-t border-border-custom pt-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold">Total {rupees(total)}</span>
              <label className="flex items-center gap-2">
                <span className="text-text2">Paid now ₹</span>
                <input type="number" inputMode="decimal" placeholder={String(Math.round(total))} value={paid}
                  onChange={(e) => setPaid(e.target.value === '' ? '' : Number(e.target.value))} className="w-28 px-2 py-1.5 border border-border-custom rounded-lg text-right" />
              </label>
            </div>

            <button onClick={save} disabled={saving} className="w-full mt-4 bg-brand text-white py-3 rounded-lg font-bold disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save & add to stock'}
            </button>
          </div>
        </div>
        </Portal>
      )}
      {deleting && (
        <ConfirmDialog title="Delete supplier bill?"
          message={<>{deleting.supplier?.name || 'No supplier'}{deleting.billNo && ` #${deleting.billNo}`} · <b>{rupees(deleting.total)}</b>. Its stock will be removed.</>}
          busy={deletingBusy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </AppLayout>
  );
}
