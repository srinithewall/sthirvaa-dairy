'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { RationGroup, RationItem, StoreItemLite, BATCH_COLORS, KINDS, RationKind, RationUnit } from '@/lib/ration';
import { X, Plus, Trash2, ArrowUp } from 'lucide-react';

const blankLine = (): RationItem => ({ name: '', kind: 'CONCENTRATE', unit: 'KG', morningQty: 0, eveningQty: 0 });

/** Edits one batch: name, colour, staff note and the ration lines (per animal, per feed). */
export default function RationBatchEditor({ group, storeItems, onClose, onSaved }: {
  group: RationGroup; storeItems: StoreItemLite[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color || BATCH_COLORS[0]);
  const [notes, setNotes] = useState(group.notes || '');
  const [items, setItems] = useState<RationItem[]>(group.items.length ? group.items.map((it) => ({ ...it })) : [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const feeds = storeItems.filter((s) => s.active && ['FEED', 'FODDER', 'MINERAL', 'SUPPLEMENT'].includes(s.category));

  const setLine = (i: number, patch: Partial<RationItem>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Typing a shop item's name links the line to it, so the purchase list can use its bag size and price.
  const setLineName = (i: number, value: string) => {
    const match = feeds.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
    setLine(i, { name: value, storeItemId: match?.id ?? null, ...(match?.category === 'MINERAL' ? { kind: 'MINERAL', unit: 'G' } : {}) });
  };

  const move = (i: number) => setItems((xs) => {
    const ys = [...xs];
    [ys[i - 1], ys[i]] = [ys[i], ys[i - 1]];
    return ys;
  });

  const save = async () => {
    if (!name.trim()) { setError('Give the batch a name.'); return; }
    const bad = items.find((it) => it.name.trim() && it.fromDate && it.toDate && it.fromDate > it.toDate);
    if (bad) { setError(`"${bad.name}": the From date is after the To date.`); return; }
    setSaving(true);
    setError('');
    try {
      await api.put(`/ration/groups/${group.id}`, {
        name, color, notes, sortOrder: group.sortOrder,
        items: items.filter((it) => it.name.trim()).map((it) => ({
          ...it, fromDate: it.fromDate || null, toDate: it.toDate || null,
        })),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save the batch.');
      setSaving(false);
    }
  };

  const input = 'border border-border-custom rounded-md px-1.5 py-1 text-[12px]';

  // Portalled to <body>: inside the tab's scroll box the overlay sat under the sidebar and header.
  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-2 md:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-custom">
          <h3 className="font-bold text-[15px]">Edit batch</h3>
          <button onClick={onClose} className="ml-auto text-text3 hover:text-text"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] font-semibold text-text2 flex-1 min-w-[200px]">Batch name
              <input value={name} onChange={(e) => setName(e.target.value)} className="block mt-1 w-full border border-border-custom rounded-lg px-2 py-1.5 text-[13px]" />
            </label>
            <div className="text-[12px] font-semibold text-text2">Colour
              <div className="flex gap-1.5 mt-1">
                {BATCH_COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-text' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>

          <label className="text-[12px] font-semibold text-text2">Note for staff (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="e.g. When Lakshmi crosses 24 L, give Milkgen 10000 in the evening instead of 8000."
              className="block mt-1 w-full border border-border-custom rounded-lg px-2 py-1.5 text-[13px]" />
          </label>

          <div>
            <div className="text-[12px] font-semibold text-text2 mb-1">Ration — amount for <b>each animal</b> at each feed</div>
            <div className="overflow-x-auto rounded-lg border border-border-custom">
              <table className="w-full text-[12px]">
                <thead className="bg-surface2 text-[10px] uppercase text-text3">
                  <tr>
                    <th className="text-left px-2 py-1.5">Feed</th>
                    <th className="text-left px-2 py-1.5">Type</th>
                    <th className="text-left px-2 py-1.5">Unit</th>
                    <th className="text-right px-2 py-1.5">Morning</th>
                    <th className="text-right px-2 py-1.5">Evening</th>
                    <th className="text-left px-2 py-1.5">From</th>
                    <th className="text-left px-2 py-1.5">To</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-border-custom">
                      <td className="px-2 py-1">
                        <input list="ration-feeds" value={it.name} onChange={(e) => setLineName(i, e.target.value)}
                          placeholder="Pick or type a feed" className={`${input} w-48`} />
                        {it.storeItemId ? <div className="text-[10px] text-brand mt-0.5">Shop item</div> : null}
                      </td>
                      <td className="px-2 py-1">
                        <select value={it.kind} onChange={(e) => setLine(i, { kind: e.target.value as RationKind })} className={input}>
                          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select value={it.unit} onChange={(e) => setLine(i, { unit: e.target.value as RationUnit })} className={input}>
                          <option value="KG">kg</option>
                          <option value="G">g</option>
                          <option value="L">litre</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input type="number" min={0} step="any" value={it.morningQty} onChange={(e) => setLine(i, { morningQty: Number(e.target.value) || 0 })} className={`${input} w-20 text-right`} />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input type="number" min={0} step="any" value={it.eveningQty} onChange={(e) => setLine(i, { eveningQty: Number(e.target.value) || 0 })} className={`${input} w-20 text-right`} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="date" value={it.fromDate ?? ''} onChange={(e) => setLine(i, { fromDate: e.target.value || null })} className={input} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="date" value={it.toDate ?? ''} onChange={(e) => setLine(i, { toDate: e.target.value || null })} className={input} />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {i > 0 && <button onClick={() => move(i)} className="text-text3 hover:text-text mr-1" title="Move up"><ArrowUp size={13} /></button>}
                        <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="text-text3 hover:text-rose-600" title="Remove"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id="ration-feeds">
              {feeds.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
            <button onClick={() => setItems((xs) => [...xs, blankLine()])} className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-brand">
              <Plus size={14} /> Add line
            </button>
            <p className="mt-2 text-[11px] text-text3">
              Leave From/To empty for lines that apply the whole plan. Use them to switch feed on a date, e.g. Milkgen 5000+ to 19 Nov and Milkgen 8000 from 20 Nov.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border-custom">
          {error && <span className="text-[12px] text-rose-600">{error}</span>}
          <button onClick={onClose} className="ml-auto px-4 py-1.5 rounded-lg text-[12px] font-semibold text-text2 border border-border-custom">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-brand text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Save batch'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
