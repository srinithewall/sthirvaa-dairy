'use client';

import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

interface Breed { id: number; name: string; basePrice?: number | null; normalYield?: number | null; }

/**
 * Price list behind the animal valuation: what a healthy adult of each breed in its 2nd-3rd
 * lactation sells for, and its average daily milk over a whole lactation (the app adjusts that for each
 * cow's stage: more at peak, less late). Blank fields fall back to built-in estimates.
 */
export default function BreedPricesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useNotification();
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<number, { basePrice: string; normalYield: string }>>({});

  useEffect(() => {
    api.get('/breeds').then(res => {
      const list: Breed[] = (res.data || []).sort((a: Breed, b: Breed) => a.name.localeCompare(b.name));
      setBreeds(list);
      const init: Record<number, { basePrice: string; normalYield: string }> = {};
      list.forEach(b => { init[b.id] = { basePrice: b.basePrice ? String(b.basePrice) : '', normalYield: b.normalYield ? String(b.normalYield) : '' }; });
      setEdits(init);
    }).catch(() => showToast('Could not load breeds.', 'error')).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const changed = breeds.filter(b => {
        const e = edits[b.id];
        return (e.basePrice || '') !== (b.basePrice ? String(b.basePrice) : '')
          || (e.normalYield || '') !== (b.normalYield ? String(b.normalYield) : '');
      });
      for (const b of changed) {
        const e = edits[b.id];
        await api.put(`/breeds/${b.id}/valuation`, {
          basePrice: e.basePrice ? parseFloat(e.basePrice) : null,
          normalYield: e.normalYield ? parseFloat(e.normalYield) : null,
        });
      }
      showToast(changed.length ? 'Breed prices saved' : 'No changes');
      onSaved();
      onClose();
    } catch {
      showToast('Could not save breed prices.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cell = 'w-full bg-white border border-border-custom rounded-lg px-2 py-1.5 text-sm text-right';

  return (
    <div className="fixed inset-0 z-[3000] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-custom">
          <div>
            <h2 className="font-bold text-text">Breed prices</h2>
            <p className="text-[12px] text-text3">Used to value cows, buffaloes and goats. Blank uses the built-in estimate.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text3 hover:text-text"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center p-6 text-text3 text-sm"><RefreshCw size={16} className="animate-spin mr-2" /> Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-text3 uppercase text-left">
                  <th className="font-bold pb-2">Breed</th>
                  <th className="font-bold pb-2 text-right w-36">Adult price (₹)</th>
                  <th className="font-bold pb-2 text-right w-28">Normal L/day</th>
                </tr>
              </thead>
              <tbody>
                {breeds.map(b => (
                  <tr key={b.id} className="border-t border-border-custom">
                    <td className="py-1.5 pr-2 font-semibold text-text">{b.name}</td>
                    <td className="py-1.5 pl-2">
                      <input type="number" min={0} inputMode="numeric" placeholder="Auto" className={cell}
                        value={edits[b.id]?.basePrice ?? ''}
                        onChange={e => setEdits(p => ({ ...p, [b.id]: { ...p[b.id], basePrice: e.target.value } }))} />
                    </td>
                    <td className="py-1.5 pl-2">
                      <input type="number" min={0} step="0.5" inputMode="decimal" placeholder="Auto" className={cell}
                        value={edits[b.id]?.normalYield ?? ''}
                        onChange={e => setEdits(p => ({ ...p, [b.id]: { ...p[b.id], normalYield: e.target.value } }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex gap-2 px-5 py-3 border-t border-border-custom">
          <button onClick={save} disabled={saving || loading}
            className="flex-1 bg-brand text-white py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save prices'}</button>
          <button onClick={onClose} className="px-4 py-2.5 border border-border-custom rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
