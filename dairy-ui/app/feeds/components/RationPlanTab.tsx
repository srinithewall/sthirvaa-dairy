'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { rupees, todayIso, currentRole, canManageStore } from '@/lib/store';
import {
  RationGroup, RationItem, RationPlan, ProductSetting, StoreItemLite,
  BATCH_COLORS, KINDS, kindOf, fmtQty, isActive, addDays, fmtDate, parseProducts, purchaseRows, productKey,
} from '@/lib/ration';
import RationBatchEditor from './RationBatchEditor';
import { Sun, Moon, Printer, Pencil, Plus, Trash2, ShoppingBag, Users, ClipboardList, Save, AlertTriangle } from 'lucide-react';

interface Animal {
  id: number;
  animalName?: string;
  tagNumber?: string;
  animalType?: string;
  animalStatus?: string;
  status?: string;
  dim?: number;
  avgMilk30Days?: number;
  bcs?: number;
}

const animalLabel = (a: Animal) => (a.animalName || a.tagNumber || `#${a.id}`).trim();

function animalInfo(a: Animal): string {
  const parts: string[] = [];
  if (a.animalStatus === 'LACTATING') {
    if (a.avgMilk30Days) parts.push(`${Math.round(a.avgMilk30Days * 10) / 10} L/day`);
    if (a.dim != null) parts.push(`${a.dim} DIM`);
  } else if (a.animalStatus) {
    parts.push(a.animalStatus.charAt(0) + a.animalStatus.slice(1).toLowerCase());
  }
  if (a.bcs != null) parts.push(`BCS ${a.bcs}`);
  return parts.join(' · ');
}

type View = 'feeding' | 'batches' | 'purchase';

export default function RationPlanTab() {
  const [groups, setGroups] = useState<RationGroup[]>([]);
  const [plan, setPlan] = useState<RationPlan>({ days: 45, wastagePct: 5 });
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItemLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('feeding');
  const [day, setDay] = useState(todayIso());
  const [editing, setEditing] = useState<RationGroup | null>(null);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    // Staff only see the feeding sheet; owners set up batches and buy feed.
    setCanManage(canManageStore(currentRole()));
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, h, s] = await Promise.all([
        api.get('/ration'),
        api.get('/herds'),
        api.get('/store/items').catch(() => ({ data: [] })),
      ]);
      setGroups(r.data.groups || []);
      setPlan(r.data.plan || { days: 45, wastagePct: 5 });
      setAnimals(((h.data?.herds ?? h.data) || []).filter((a: Animal) =>
        a.status === 'ACTIVE' && (a.animalType === 'COW' || a.animalType === 'BUFFALO')));
      setStoreItems(s.data || []);
    } catch (err) {
      console.error('Failed to load ration plan', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const animalById = useMemo(() => new Map(animals.map((a) => [a.id, a])), [animals]);
  const groupOf = useMemo(() => {
    const m = new Map<number, RationGroup>();
    groups.forEach((g) => g.herdIds.forEach((id) => m.set(id, g)));
    return m;
  }, [groups]);
  const membersOf = useCallback(
    (g: RationGroup) => g.herdIds.map((id) => animalById.get(id)).filter(Boolean) as Animal[],
    [animalById],
  );
  const unassigned = animals.filter((a) => !groupOf.has(a.id));

  const moveAnimal = async (herdId: number, groupId: number | null) => {
    await api.put('/ration/members', { herdId, groupId });
    load();
  };

  if (loading) return <div className="p-8 text-center text-text3 text-[13px]">Loading ration plan...</div>;

  const views: { id: View; label: string; icon: any }[] = [
    { id: 'feeding', label: 'Feeding sheet', icon: ClipboardList },
    ...(canManage ? [
      { id: 'batches' as View, label: 'Batches & animals', icon: Users },
      { id: 'purchase' as View, label: 'Purchase list', icon: ShoppingBag },
    ] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {views.length > 1 && (
        <div className="flex gap-1 bg-surface2 rounded-lg p-1 self-start">
          {views.map((v) => {
            const Icon = v.icon;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  view === v.id ? 'bg-white text-brand shadow-sm' : 'text-text2 hover:text-text'}`}>
                <Icon size={14} /> {v.label}
              </button>
            );
          })}
        </div>
      )}

      {view === 'feeding' && (
        <FeedingSheet groups={groups} plan={plan} day={day} setDay={setDay} membersOf={membersOf}
          unassigned={canManage ? unassigned : []} />
      )}
      {view === 'batches' && canManage && (
        <BatchSetup groups={groups} animals={animals} groupOf={groupOf} membersOf={membersOf}
          onEdit={setEditing} onMove={moveAnimal} onChanged={load} />
      )}
      {view === 'purchase' && canManage && (
        <PurchaseList groups={groups} plan={plan} storeItems={storeItems} membersOf={membersOf} onSaved={load} />
      )}

      {editing && (
        <RationBatchEditor group={editing} storeItems={storeItems}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Feeding sheet */

function ItemLines({ items, shift, multiplier = 1 }: { items: RationItem[]; shift: 'morningQty' | 'eveningQty'; multiplier?: number }) {
  const lines = items.filter((it) => it[shift] > 0);
  if (!lines.length) return <div className="text-[12px] text-text3">Nothing</div>;
  return (
    <ul className="space-y-1">
      {lines.map((it, i) => {
        const k = kindOf(it.kind);
        return (
          <li key={i} className="flex items-baseline gap-2 text-[13px]">
            <span className="w-2 h-2 rounded-full shrink-0 translate-y-[-1px]" style={{ background: k.dot }} />
            <span className={`flex-1 ${it.kind === 'CONCENTRATE' ? 'font-semibold text-text' : 'text-text2'}`}>{it.name}</span>
            <span className="font-bold tabular-nums whitespace-nowrap text-text">{fmtQty(it[shift] * multiplier, it.unit)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FeedingSheet({ groups, plan, day, setDay, membersOf, unassigned }: {
  groups: RationGroup[]; plan: RationPlan; day: string; setDay: (d: string) => void;
  membersOf: (g: RationGroup) => Animal[]; unassigned: Animal[];
}) {
  const shown = groups.filter((g) => membersOf(g).length > 0);
  const end = plan.startDate ? addDays(plan.startDate, plan.days - 1) : null;
  const outside = plan.startDate && (day < plan.startDate || (end && day > end));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] font-semibold text-text2">Feeding for</label>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)}
          className="border border-border-custom rounded-lg px-2 py-1 text-[13px]" />
        {day !== todayIso() && (
          <button onClick={() => setDay(todayIso())} className="text-[12px] font-semibold text-brand">Today</button>
        )}
        {plan.startDate && (
          <span className="text-[12px] text-text3">Plan: {fmtDate(plan.startDate)} – {fmtDate(end)} ({plan.days} days)</span>
        )}
        <button onClick={() => printSheet(shown, day, membersOf)}
          className="ml-auto flex items-center gap-1.5 bg-white border border-border-custom text-text2 px-3 py-1.5 rounded-lg text-[12px] font-semibold hover:border-brand hover:text-brand">
          <Printer size={14} /> Print
        </button>
      </div>

      {outside && (
        <div className="text-[12px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          {day < plan.startDate! ? `The plan starts on ${fmtDate(plan.startDate)}.` : `The plan ended on ${fmtDate(end)}.`}
          {' '}Check the batches before feeding.
        </div>
      )}

      {!shown.length && (
        <div className="p-8 text-center text-text3 text-[13px]">No batches with animals yet. Set them up under Batches &amp; animals.</div>
      )}

      {shown.length > 0 && (
        <div className="hidden md:grid grid-cols-[230px_1fr_1fr] gap-4 px-4 text-[11px] font-bold uppercase tracking-wide text-text3">
          <span>Animals</span>
          <span className="flex items-center gap-1"><Sun size={12} /> Morning · each animal</span>
          <span className="flex items-center gap-1"><Moon size={12} /> Evening · each animal</span>
        </div>
      )}

      {shown.map((g) => {
        const members = membersOf(g);
        const items = g.items.filter((it) => isActive(it, day));
        const color = g.color || '#64748b';
        return (
          <section key={g.id} className="rounded-xl border border-border-custom overflow-hidden bg-white" style={{ borderLeft: `6px solid ${color}` }}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: `${color}14` }}>
              <span className="text-[15px] font-extrabold uppercase tracking-wide" style={{ color }}>{g.name}</span>
              <span className="text-[12px] font-semibold text-text2">{members.length} {members.length === 1 ? 'animal' : 'animals'}</span>
            </div>
            {g.notes && (
              <div className="mx-4 mt-2 text-[12px] bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-2.5 py-1.5 whitespace-pre-line">{g.notes}</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-[230px_1fr_1fr] gap-x-4 gap-y-3 p-4">
              <div className="col-span-2 md:col-span-1 flex flex-wrap md:flex-col gap-x-4 gap-y-1.5">
                {members.map((a) => (
                  <div key={a.id}>
                    <div className="text-[14px] font-bold text-text">{animalLabel(a)}</div>
                    <div className="text-[11px] text-text3">{animalInfo(a)}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="md:hidden flex items-center gap-1 text-[11px] font-bold uppercase text-text3 mb-1"><Sun size={12} /> Morning</div>
                <ItemLines items={items} shift="morningQty" />
              </div>
              <div>
                <div className="md:hidden flex items-center gap-1 text-[11px] font-bold uppercase text-text3 mb-1"><Moon size={12} /> Evening</div>
                <ItemLines items={items} shift="eveningQty" />
              </div>
            </div>
            {members.length > 1 && (
              <div className="grid grid-cols-2 md:grid-cols-[230px_1fr_1fr] gap-x-4 gap-y-2 px-4 py-3 bg-surface2/60 border-t border-border-custom">
                <div className="col-span-2 md:col-span-1 text-[12px] font-bold text-text2">
                  Total for {members.length} animals
                  <div className="text-[11px] font-normal text-text3">Mix this, then give each animal its share</div>
                </div>
                <ItemLines items={items} shift="morningQty" multiplier={members.length} />
                <ItemLines items={items} shift="eveningQty" multiplier={members.length} />
              </div>
            )}
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <div className="flex items-start gap-2 text-[12px] bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Not in any batch: {unassigned.map(animalLabel).join(', ')}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-text3">
        {KINDS.map((k) => (
          <span key={k.id} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: k.dot }} />{k.label}</span>
        ))}
      </div>
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Opens a plain, printer-friendly copy of the feeding sheet to stick up in the shed. */
function printSheet(groups: RationGroup[], day: string, membersOf: (g: RationGroup) => Animal[]) {
  const lines = (items: RationItem[], shift: 'morningQty' | 'eveningQty', mult = 1) =>
    items.filter((it) => it[shift] > 0)
      .map((it) => `<div class="l"><span>${esc(it.name)}</span><b>${fmtQty(it[shift] * mult, it.unit)}</b></div>`)
      .join('') || '–';
  const body = groups.map((g) => {
    const members = membersOf(g);
    const items = g.items.filter((it) => isActive(it, day));
    const total = members.length > 1
      ? `<tr class="t"><td>Total for ${members.length}</td><td>${lines(items, 'morningQty', members.length)}</td><td>${lines(items, 'eveningQty', members.length)}</td></tr>`
      : '';
    return `<tr class="h"><td colspan="3" style="border-left:8px solid ${g.color || '#64748b'}">${esc(g.name.toUpperCase())}
        ${g.notes ? `<div class="n">${esc(g.notes)}</div>` : ''}</td></tr>
      <tr><td>${members.map((a) => `<div class="a">${esc(animalLabel(a))}</div>`).join('')}</td>
        <td>${lines(items, 'morningQty')}</td><td>${lines(items, 'eveningQty')}</td></tr>${total}`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Feeding sheet ${day}</title><style>
    body{font-family:system-ui,sans-serif;margin:16px;color:#111}h1{font-size:18px;margin:0 0 8px}
    table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:6px 8px;vertical-align:top;font-size:13px}
    th{text-align:left;font-size:12px;padding:6px 8px;background:#eee;border:1px solid #999}
    tr.h td{background:#f4f4f4;font-weight:800;font-size:14px}.n{font-weight:400;font-size:12px;margin-top:2px;white-space:pre-line}
    tr.t td{background:#fafafa;font-size:12px}.l{display:flex;justify-content:space-between;gap:12px}.a{font-weight:700}
  </style></head><body><h1>Feeding sheet – ${fmtDate(day)}</h1>
  <table><thead><tr><th style="width:22%">Animals</th><th>Morning (each animal)</th><th>Evening (each animal)</th></tr></thead>
  <tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

/* ------------------------------------------------------------------ Batches & animals */

function BatchSetup({ groups, animals, groupOf, membersOf, onEdit, onMove, onChanged }: {
  groups: RationGroup[]; animals: Animal[]; groupOf: Map<number, RationGroup>;
  membersOf: (g: RationGroup) => Animal[]; onEdit: (g: RationGroup) => void;
  onMove: (herdId: number, groupId: number | null) => void; onChanged: () => void;
}) {
  const [newName, setNewName] = useState('');

  const addBatch = async () => {
    const name = newName.trim();
    if (!name) return;
    const res = await api.post('/ration/groups', {
      name, color: BATCH_COLORS[groups.length % BATCH_COLORS.length], items: [],
    });
    setNewName('');
    onChanged();
    onEdit(res.data);
  };

  const removeBatch = async (g: RationGroup) => {
    if (!confirm(`Delete batch "${g.name}"? Its animals will be left without a batch.`)) return;
    await api.delete(`/ration/groups/${g.id}`);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {groups.map((g) => {
          const members = membersOf(g);
          return (
            <div key={g.id} className="rounded-xl border border-border-custom bg-white overflow-hidden" style={{ borderTop: `5px solid ${g.color || '#64748b'}` }}>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="font-extrabold text-[14px]" style={{ color: g.color }}>{g.name}</span>
                <span className="text-[11px] text-text3">{members.length} {members.length === 1 ? 'animal' : 'animals'} · {g.items.length} lines</span>
                <button onClick={() => onEdit(g)} className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-brand"><Pencil size={13} /> Edit ration</button>
                <button onClick={() => removeBatch(g)} className="text-text3 hover:text-rose-600" title="Delete batch"><Trash2 size={14} /></button>
              </div>
              <div className="px-3 pb-3 text-[12px] text-text2">
                {members.length ? members.map(animalLabel).join(', ') : <span className="text-text3">No animals yet</span>}
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border border-dashed border-border-custom p-3 flex items-center gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBatch()}
            placeholder="New batch, e.g. Peak yield" className="flex-1 border border-border-custom rounded-lg px-2 py-1.5 text-[13px]" />
          <button onClick={addBatch} className="flex items-center gap-1 bg-brand text-white px-3 py-1.5 rounded-lg text-[12px] font-semibold"><Plus size={14} /> Add</button>
        </div>
      </div>

      <div className="rounded-xl border border-border-custom overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-surface2 text-[11px] uppercase text-text3">
            <tr>
              <th className="text-left px-3 py-2">Animal</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Milk (30-day avg)</th>
              <th className="text-right px-3 py-2">DIM</th>
              <th className="text-right px-3 py-2">BCS</th>
              <th className="text-left px-3 py-2">Batch</th>
            </tr>
          </thead>
          <tbody>
            {animals.map((a) => {
              const g = groupOf.get(a.id);
              return (
                <tr key={a.id} className="border-t border-border-custom">
                  <td className="px-3 py-2 font-semibold">{animalLabel(a)}</td>
                  <td className="px-3 py-2 text-text2">{a.animalStatus ? a.animalStatus.charAt(0) + a.animalStatus.slice(1).toLowerCase() : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.animalStatus === 'LACTATING' && a.avgMilk30Days ? `${Math.round(a.avgMilk30Days * 10) / 10} L` : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.animalStatus === 'LACTATING' && a.dim != null ? a.dim : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.bcs ?? '–'}</td>
                  <td className="px-3 py-2">
                    <select value={g?.id ?? ''} onChange={(e) => onMove(a.id, e.target.value ? Number(e.target.value) : null)}
                      className="border border-border-custom rounded-lg px-2 py-1 text-[12px] font-semibold"
                      style={{ color: g?.color }}>
                      <option value="">— Not in a batch —</option>
                      {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Purchase list */

function PurchaseList({ groups, plan, storeItems, membersOf, onSaved }: {
  groups: RationGroup[]; plan: RationPlan; storeItems: StoreItemLite[];
  membersOf: (g: RationGroup) => Animal[]; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RationPlan>(plan);
  const [products, setProducts] = useState<Record<string, ProductSetting>>(() => parseProducts(plan));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const rows = useMemo(
    () => purchaseRows(groups, draft, products, storeItems, (g) => membersOf(g).length),
    [groups, draft, products, storeItems, membersOf],
  );
  const total = rows.reduce((t, r) => t + (r.cost ?? 0), 0);
  const unpriced = rows.some((r) => r.cost == null);

  const setProduct = (key: string, name: string, patch: Partial<ProductSetting>) => {
    setProducts((p) => ({ ...p, [key]: { ...(p[key] ?? { name }), name, ...patch } }));
    setDirty(true);
  };
  const setPlanField = (patch: Partial<RationPlan>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/ration/plan', { ...draft, products: JSON.stringify(products) });
      setDirty(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => (v === '' ? undefined : Number(v));
  const cell = 'w-20 border border-border-custom rounded-md px-1.5 py-1 text-right text-[12px] tabular-nums';
  const extraOptions = storeItems.filter((s) => s.active && !rows.some((r) => r.key === `s:${s.id}`)
    && ['FEED', 'MINERAL', 'SUPPLEMENT'].includes(s.category));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] font-semibold text-text2">Start date
          <input type="date" value={draft.startDate ?? ''} onChange={(e) => setPlanField({ startDate: e.target.value || null })}
            className="block mt-1 border border-border-custom rounded-lg px-2 py-1 text-[13px]" />
        </label>
        <label className="text-[12px] font-semibold text-text2">Days
          <input type="number" min={1} value={draft.days} onChange={(e) => setPlanField({ days: Number(e.target.value) || 1 })}
            className="block mt-1 w-20 border border-border-custom rounded-lg px-2 py-1 text-[13px]" />
        </label>
        <label className="text-[12px] font-semibold text-text2">Wastage %
          <input type="number" min={0} value={draft.wastagePct} onChange={(e) => setPlanField({ wastagePct: Number(e.target.value) || 0 })}
            className="block mt-1 w-20 border border-border-custom rounded-lg px-2 py-1 text-[13px]" />
        </label>
        {draft.startDate && (
          <span className="text-[12px] text-text3 pb-1.5">{fmtDate(draft.startDate)} – {fmtDate(addDays(draft.startDate, draft.days - 1))}</span>
        )}
        <button onClick={save} disabled={!dirty || saving}
          className="ml-auto flex items-center gap-1.5 bg-brand text-white px-4 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40">
          <Save size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {!draft.startDate ? (
        <div className="p-8 text-center text-text3 text-[13px]">Set a start date to see what to buy.</div>
      ) : (
        <div className="rounded-xl border border-border-custom overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-surface2 text-[11px] uppercase text-text3">
              <tr>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Needed</th>
                <th className="text-right px-3 py-2">Bag size (kg)</th>
                <th className="text-right px-3 py-2">In stock (bags)</th>
                <th className="text-right px-3 py-2">Extra bags</th>
                <th className="text-right px-3 py-2">Bags to buy</th>
                <th className="text-right px-3 py-2">Price / bag</th>
                <th className="text-right px-3 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border-custom">
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text2">{Math.round(r.kgWithWastage)} kg</td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={1} className={cell} value={products[r.key]?.bagKg ?? r.bagKg}
                      onChange={(e) => setProduct(r.key, r.name, { bagKg: num(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} className={cell} value={products[r.key]?.inStock ?? ''} placeholder="0"
                      onChange={(e) => setProduct(r.key, r.name, { inStock: num(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} className={cell} value={products[r.key]?.extraBags ?? ''} placeholder="0"
                      onChange={(e) => setProduct(r.key, r.name, { extraBags: num(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right text-[15px] font-extrabold tabular-nums">{r.bags}</td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min={0} className={cell} value={products[r.key]?.bagPrice ?? r.bagPrice ?? ''} placeholder="—"
                      onChange={(e) => setProduct(r.key, r.name, { bagPrice: num(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.cost != null ? rupees(r.cost) : '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-custom bg-surface2/60">
                <td className="px-3 py-2 font-bold" colSpan={5}>Total</td>
                <td className="px-3 py-2 text-right font-extrabold tabular-nums">{rows.reduce((t, r) => t + r.bags, 0)}</td>
                <td />
                <td className="px-3 py-2 text-right font-extrabold tabular-nums">{rupees(total)}{unpriced ? '*' : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-text3">
        <span>Concentrate and mineral lines only; fodder, hotel waste and milk are not bought.</span>
        {unpriced && <span>* Some products have no price yet.</span>}
        {extraOptions.length > 0 && (
          <select value="" onChange={(e) => {
            const s = storeItems.find((x) => x.id === Number(e.target.value));
            if (s) setProduct(productKey({ storeItemId: s.id, name: s.name }), s.name, { extraBags: 1 });
          }} className="ml-auto border border-border-custom rounded-lg px-2 py-1 text-[12px] text-text2">
            <option value="">+ Add a product to keep in reserve</option>
            {extraOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
