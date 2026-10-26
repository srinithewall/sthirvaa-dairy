'use client';

import React, { useState } from 'react';
import Portal from '@/components/store/Portal';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { StoreItem, StoreSupplier, CATEGORIES, UNITS, apiError, clearStoreCache } from '@/lib/store';
import { X } from 'lucide-react';

/** Edit an item's details and prices. Items are created from supplier bills (Stock In). */
export default function ItemEditModal({ item, suppliers, canSeeCost, onClose, onSaved }: {
  item: StoreItem; suppliers: StoreSupplier[]; canSeeCost: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useNotification();
  const [editing, setEditing] = useState<Partial<StoreItem>>({ ...item });

  const save = async () => {
    try {
      await api.put(`/store/items/${item.id}`, editing);
      clearStoreCache();
      showToast('Item saved', 'success');
      onSaved();
    } catch (err) {
      showToast(apiError(err, 'Could not save item'), 'error');
    }
  };

  const label = 'block text-xs font-bold text-text2 uppercase tracking-wide mb-1';
  const field = (key: keyof StoreItem, text: string, type: 'text' | 'number' = 'text') => (
    <label className="block">
      <span className={label}>{text}</span>
      <input type={type} inputMode={type === 'number' ? 'decimal' : undefined}
        value={(editing[key] as string | number | undefined) ?? ''}
        onChange={(e) => setEditing({ ...editing, [key]: type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
        className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
    </label>
  );

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Edit {item.name}</h2>
            <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{field('name', 'Name')}</div>
            <div className="col-span-2">{field('kannadaName', 'Kannada name')}</div>
            <label className="block">
              <span className={label}>Category</span>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as StoreItem['category'] })}
                className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm bg-white">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            {field('brand', 'Brand (manufacturer)')}
            <label className="block">
              <span className={label}>Sold per</span>
              <select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value as StoreItem['unit'] })}
                className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm bg-white">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            {field('unitSize', editing.unit === 'PIECE' ? 'Pieces per pack' : editing.unit === 'LITRE' ? 'Litres per pack' : 'Pack size (kg)', 'number')}
            {field('salePrice', 'Selling price ₹', 'number')}
            {canSeeCost || !editing.hidePrice ? field('minSalePrice', 'Min price ₹', 'number') : <div />}
            {field('reorderLevel', 'Reorder level', 'number')}
            {field('shelfLifeDays', 'Shelf life (days)', 'number')}
            {canSeeCost && (
              <div className="col-span-2">
                {field('rewardCoins', '💎 Diamonds to take 1 free (blank = not a reward item)', 'number')}
                <p className="text-[11px] text-text3 mt-1">Contacts can take this item with their Sthirvaa Diamonds instead of paying.</p>
              </div>
            )}
            <div className="col-span-2">
              <span className={label}>Bought from (suppliers)</span>
              <div className="flex flex-wrap gap-2">
                {suppliers.map((s) => {
                  const on = !!editing.supplierIds?.includes(s.id);
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setEditing({ ...editing, supplierIds: on ? editing.supplierIds!.filter((x) => x !== s.id) : [...(editing.supplierIds ?? []), s.id] })}
                      className={`px-3 py-1.5 rounded-full text-sm border ${on ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom'}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {(canSeeCost || !editing.hidePrice) && (
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.hidePrice} onChange={(e) => setEditing({ ...editing, hidePrice: e.target.checked })} />
                Hide min price from staff
              </label>
            )}
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active (still sold)
            </label>
          </div>
          <button onClick={save} className="w-full mt-5 bg-brand text-white py-3 rounded-lg font-bold">Save</button>
        </div>
      </div>
    </Portal>
  );
}
