'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import StoreTabs from '@/components/store/StoreTabs';
import Portal from '@/components/store/Portal';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import ItemEditModal from '@/components/store/ItemEditModal';
import ItemFilter, { ItemFilterValue, NO_FILTER, matchesItemFilter } from '@/components/store/ItemFilter';
import { StockRow, StoreItem, StoreSupplier, packLabel, rupees, qty, apiError, canManageStore, currentRole, cachedGet } from '@/lib/store';
import { AlertTriangle, CheckCircle2, Pencil, Search, SlidersHorizontal, X } from 'lucide-react';

type AdjustType = 'ADJUSTMENT' | 'EXPIRED' | 'RETURN';

export default function StoreStockPage() {
  const { showToast } = useNotification();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [canAdjust, setCanAdjust] = useState(false);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [adjQty, setAdjQty] = useState<number | ''>('');
  const [adjType, setAdjType] = useState<AdjustType>('ADJUSTMENT');
  const [reason, setReason] = useState('');

  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);

  const load = () =>
    Promise.all([api.get('/store/stock', { params: { includeInactive: true } }), cachedGet<StoreSupplier[]>('/store/suppliers')])
      .then(([r, s]) => { setRows(r.data); setSuppliers(s); })
      .catch((err) => showToast(apiError(err, 'Failed to load stock'), 'error'));

  useEffect(() => {
    setCanAdjust(canManageStore(currentRole()));
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ItemFilterValue>(NO_FILTER);
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || r.item.name.toLowerCase().includes(q) || (r.item.kannadaName || '').includes(query.trim()))
      && matchesItemFilter(r.item, filter, suppliers));
  }, [rows, query, filter, suppliers]);
  // Value covers the products currently listed, so it follows the search and filter.
  const totalValue = visibleRows.reduce((s, r) => s + Number(r.stockValue), 0);

  const saveAdjust = async () => {
    if (!adjusting || adjQty === '' || adjQty === 0) return;
    try {
      // Expired/damaged stock always goes out.
      const signed = adjType === 'EXPIRED' ? -Math.abs(adjQty) : adjQty;
      await api.post('/store/stock/adjust', { itemId: adjusting.item.id, qty: signed, type: adjType, reason });
      showToast('Stock updated', 'success');
      setAdjusting(null); setAdjQty(''); setReason(''); setAdjType('ADJUSTMENT');
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not adjust stock'), 'error');
    }
  };

  return (
    <AppLayout>
      <StoreTabs action={<p className="text-[13px] text-text3">Value at cost: <span className="font-bold text-text">{rupees(totalValue)}</span></p>} />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search item / ಹುಡುಕಿ"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
        </div>
        <ItemFilter value={filter} onChange={setFilter} suppliers={suppliers} resultCount={visibleRows.length} />
      </div>

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden shadow-sm">
        <ul className="divide-y divide-border-custom">
          {visibleRows.map((r) => (
            <li key={r.item.id} className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${r.item.active ? '' : 'opacity-50'}`}>
              <div className="min-w-0">
                <p className="font-bold text-text">
                  {r.item.name}<span className="text-brand"> · {rupees(r.item.salePrice)}</span>
                  {r.item.minSalePrice != null && <span className="text-text3 font-normal text-[12px]"> (min {rupees(r.item.minSalePrice)}{r.item.hidePrice && ', hidden'})</span>}
                </p>
                <p className="text-[12px] text-text3">
                  {[r.item.brand, packLabel(r.item),
                    suppliers.filter((s) => r.item.supplierIds?.includes(s.id)).map((s) => s.name).join(', ') || null,
                    `value ${rupees(r.stockValue)}`, r.earliestExpiry && `expiry ${r.earliestExpiry}`, !r.item.active && 'inactive',
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {Number(r.qtyOnHand) <= 0 && (
                  <Link href={`/store/purchases?item=${r.item.id}`} className="text-[12px] font-bold text-brand whitespace-nowrap">+ Stock In</Link>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${r.lowStock ? 'bg-red-50 text-danger' : 'bg-green-50 text-brand'}`}>
                  {r.lowStock ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {qty(r.qtyOnHand)} {r.item.unit}
                </span>
                <button onClick={() => setEditingItem(r.item)} className="p-1.5 text-text3 hover:text-brand" title="Edit product">
                  <Pencil size={16} />
                </button>
                {canAdjust && (
                  <button onClick={() => setAdjusting(r)} className="p-1.5 text-text3 hover:text-brand" title="Adjust stock">
                    <SlidersHorizontal size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-text3">No products yet. Add a supplier bill in Stock In.</li>}
          {rows.length > 0 && visibleRows.length === 0 && <li className="p-6 text-center text-sm text-text3">No products match the search or filter.</li>}
        </ul>
      </div>

      {editingItem && (
        <ItemEditModal item={editingItem} suppliers={suppliers} canSeeCost={canAdjust}
          onClose={() => setEditingItem(null)} onSaved={() => { setEditingItem(null); load(); }} />
      )}

      {adjusting && (
        <Portal>
        <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Adjust {adjusting.item.name}</h2>
              <button onClick={() => setAdjusting(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-text3 mb-4">In stock: {qty(adjusting.qtyOnHand)} {adjusting.item.unit}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['ADJUSTMENT', 'EXPIRED', 'RETURN'] as AdjustType[]).map((t) => (
                <button key={t} onClick={() => setAdjType(t)}
                  className={`py-2 rounded-lg border text-xs font-bold ${adjType === t ? 'bg-brand text-white border-brand' : 'border-border-custom text-text2'}`}>
                  {t === 'ADJUSTMENT' ? 'Count fix' : t === 'EXPIRED' ? 'Expired / damaged' : 'Customer return'}
                </button>
              ))}
            </div>
            <input type="number" inputMode="decimal" value={adjQty} onChange={(e) => setAdjQty(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={adjType === 'ADJUSTMENT' ? 'Qty (+ add, − remove)' : 'Qty'}
              className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm mb-2" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)"
              className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" />
            <button onClick={saveAdjust} disabled={adjQty === '' || !reason.trim()}
              className="w-full mt-4 bg-brand text-white py-3 rounded-lg font-bold disabled:opacity-50">Save</button>
          </div>
        </div>
        </Portal>
      )}
    </AppLayout>
  );
}
