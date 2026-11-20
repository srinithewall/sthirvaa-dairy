'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import {
  RationGroup, RationItem, RationAnimal, RationRule, StoreItemLite, BATCH_COLORS, KINDS, RationKind, RationUnit, STATUSES,
  animalLabel, matchesRule, ruleBatchFor, ruleIsEmpty,
} from '@/lib/ration';
import { X, Plus, Trash2, ArrowUp, Zap } from 'lucide-react';

const blankLine = (): RationItem => ({ name: '', kind: 'CONCENTRATE', unit: 'KG', morningQty: 0, eveningQty: 0 });

/** Edits one batch: name, colour, staff note, the rule that fills it, and the ration lines (per animal, per feed). */
export default function RationBatchEditor({ group, groups, animals, storeItems, onClose, onSaved }: {
  group: RationGroup; groups: RationGroup[]; animals: RationAnimal[]; storeItems: StoreItemLite[];
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color || BATCH_COLORS[0]);
  const [notes, setNotes] = useState(group.notes || '');
  const [items, setItems] = useState<RationItem[]>(group.items.length ? group.items.map((it) => ({ ...it })) : [blankLine()]);
  const [rule, setRule] = useState<RationRule>(() => ({ ...(group.rule ?? {}), statuses: [...(group.rule?.statuses ?? [])] }));
  const [refMilk, setRefMilk] = useState<number | null>(group.refMilk ?? null);
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
        name, color, notes, sortOrder: group.sortOrder, rule, refMilk: refMilk || null,
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

  // Who this rule would take today, with the edits so far. An earlier batch whose rule also fits wins.
  const withEdit = groups.map((g) => (g.id === group.id ? { ...g, rule } : g));
  const fits = animals.filter((a) => matchesRule(rule, a));
  const lands = fits.filter((a) => ruleBatchFor(withEdit, a) === group.id);
  const takenEarlier = fits.filter((a) => ruleBatchFor(withEdit, a) !== group.id);
  const pinnedHere = animals.filter((a) => a.pinned && a.groupId === group.id);
  const nameOf = (id: number | null) => groups.find((g) => g.id === id)?.name ?? '';
  const setRange = (k: keyof RationRule, v: string) =>
    setRule((r) => ({ ...r, [k]: v === '' ? null : Math.max(0, Number(v)) }));
  const toggleStatus = (id: string) =>
    setRule((r) => ({ ...r, statuses: r.statuses.includes(id) ? r.statuses.filter((x) => x !== id) : [...r.statuses, id] }));
  const avgMilk = (() => {
    const xs = lands.concat(pinnedHere.filter((a) => !lands.includes(a))).map((a) => a.milkPerDay).filter((v): v is number => v != null);
    return xs.length ? Math.round((xs.reduce((t, v) => t + v, 0) / xs.length) * 10) / 10 : null;
  })();
  const range = (label: string, lo: keyof RationRule, hi: keyof RationRule, unit: string) => (
    <label className="text-[12px] font-semibold text-text2">{label}
      <div className="flex items-center gap-1 mt-1">
        <input type="number" min={0} step="any" placeholder="any" value={(rule[lo] as number | null | undefined) ?? ''}
          onChange={(e) => setRange(lo, e.target.value)} className={`${input} w-16 text-right`} />
        <span className="text-text3">to</span>
        <input type="number" min={0} step="any" placeholder="any" value={(rule[hi] as number | null | undefined) ?? ''}
          onChange={(e) => setRange(hi, e.target.value)} className={`${input} w-16 text-right`} />
        <span className="text-[11px] font-normal text-text3">{unit}</span>
      </div>
    </label>
  );

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

          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-text2 flex items-center gap-1">
              <Zap size={13} className="text-sky-600" /> Animals that go in this batch by themselves
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.id} onClick={() => toggleStatus(s.id)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border ${
                    rule.statuses.includes(s.id) ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-text2 border-border-custom'}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {range('Milk per day', 'minMilk', 'maxMilk', 'L (7-day avg)')}
              {range('Days in milk', 'minDim', 'maxDim', 'days')}
              {range('Age', 'minAgeMonths', 'maxAgeMonths', 'months')}
            </div>
            <div className="text-[12px] text-text2">
              {ruleIsEmpty(rule) ? (
                <span className="text-text3">No rule: only animals you pin by hand are in this batch.</span>
              ) : (
                <>
                  <b>Today:</b> {lands.length ? lands.map(animalLabel).join(', ') : 'no animal fits'}
                  {takenEarlier.length > 0 && (
                    <span className="text-text3"> · also fits, but an earlier batch takes: {takenEarlier.map((a) => `${animalLabel(a)} (${nameOf(ruleBatchFor(withEdit, a))})`).join(', ')}</span>
                  )}
                </>
              )}
              {pinnedHere.length > 0 && (
                <div className="text-text3">Pinned here by hand: {pinnedHere.map(animalLabel).join(', ')}</div>
              )}
            </div>
            <div className="border-t border-sky-200 pt-2 flex flex-wrap items-center gap-2 text-[12px] text-text2">
              <span className="font-semibold">Ration below is written for a cow giving</span>
              <input type="number" min={0} step="any" placeholder="—" value={refMilk ?? ''}
                onChange={(e) => setRefMilk(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                className={`${input} w-16 text-right`} />
              <span>L/day</span>
              {avgMilk != null && refMilk !== avgMilk && (
                <button onClick={() => setRefMilk(avgMilk)} className="text-brand font-semibold">Use batch average ({avgMilk} L)</button>
              )}
              <span className="basis-full text-[11px] text-text3">
                Lines ticked &ldquo;By milk&rdquo; then change for each cow: 1 kg a day more or less for every 2.5 L above or below this
                (2 L for buffaloes), split between the ticked lines, kept between half and one and a half times. Leave empty to give everyone the same.
              </span>
            </div>
          </div>

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
                    {refMilk ? <th className="text-center px-2 py-1.5">By milk</th> : null}
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
                      {refMilk ? (
                        <td className="px-2 py-1 text-center">
                          {it.unit !== 'L' && (
                            <input type="checkbox" checked={!!it.scaleWithMilk} title="Change this line with each cow's milk"
                              onChange={(e) => setLine(i, { scaleWithMilk: e.target.checked })} />
                          )}
                        </td>
                      ) : null}
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
