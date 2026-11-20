'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { rupees, todayIso, currentRole, canManageStore } from '@/lib/store';
import {
  RationGroup, RationAnimal, RationPlan, ProductSetting, StoreItemLite, ResolvedLine, RuleSuggestion,
  BATCH_COLORS, KINDS, kindOf, fmtQty, addDays, fmtDate, parseProducts, purchaseRows, productKey,
  animalLabel, resolveLines, ruleText, ruleIsEmpty, ruleBatchFor, suggestRules,
} from '@/lib/ration';
import RationBatchEditor from './RationBatchEditor';
import {
  Sun, Moon, Printer, Pencil, Plus, Trash2, ShoppingBag, Users, ClipboardList, Save, AlertTriangle,
  Wand2, Pin, Zap, X,
} from 'lucide-react';

const milkText = (a: RationAnimal) => (a.milkPerDay != null ? `${Math.round(a.milkPerDay * 10) / 10} L/day` : '');

function animalInfo(a: RationAnimal): string {
  const parts: string[] = [];
  if (a.animalStatus === 'LACTATING') {
    if (a.milkPerDay != null) parts.push(milkText(a));
    if (a.dim != null) parts.push(`${a.dim} DIM`);
  } else if (a.animalStatus) {
    parts.push(a.animalStatus.charAt(0) + a.animalStatus.slice(1).toLowerCase());
    if (a.ageMonths != null && (a.animalStatus === 'CALF' || a.animalStatus === 'HEIFER')) parts.push(`${a.ageMonths} mo`);
  }
  if (a.bcs != null) parts.push(`BCS ${a.bcs}`);
  return parts.join(' · ');
}

type View = 'feeding' | 'batches' | 'purchase';

export default function RationPlanTab() {
  const [groups, setGroups] = useState<RationGroup[]>([]);
  const [plan, setPlan] = useState<RationPlan>({ days: 45, wastagePct: 5 });
  const [animals, setAnimals] = useState<RationAnimal[]>([]);
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
      // The server places each animal in its batch from the herd data (batch rules) or a hand pin.
      const [r, s] = await Promise.all([
        api.get('/ration'),
        api.get('/store/items').catch(() => ({ data: [] })),
      ]);
      setGroups(r.data.groups || []);
      setPlan(r.data.plan || { days: 45, wastagePct: 5 });
      setAnimals(r.data.animals || []);
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
    (g: RationGroup) => g.herdIds.map((id) => animalById.get(id)).filter(Boolean) as RationAnimal[],
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
        <RationBatchEditor group={editing} groups={groups} animals={animals} storeItems={storeItems}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Feeding sheet */

/**
 * One feed (morning or evening column). Lines everyone gets alike show one amount; lines scaled to
 * each cow's milk list every cow's own amount. With total, shows the whole batch's amount instead.
 */
function ItemLines({ lines, members, shift, total = false }: {
  lines: ResolvedLine[]; members: RationAnimal[]; shift: 'morning' | 'evening'; total?: boolean;
}) {
  const shown = lines.filter((l) => l[shift].some((q) => q > 0));
  if (!shown.length) return <div className="text-[12px] text-text3">Nothing</div>;
  return (
    <ul className="space-y-1">
      {shown.map((l, i) => {
        const it = l.item;
        const k = kindOf(it.kind);
        const qs = l[shift];
        const each = !total && l.varies;
        return (
          <li key={i} className="text-[13px]">
            <div className="flex items-baseline gap-2">
              <span className="w-2 h-2 rounded-full shrink-0 translate-y-[-1px]" style={{ background: k.dot }} />
              <span className={`flex-1 ${it.kind === 'CONCENTRATE' ? 'font-semibold text-text' : 'text-text2'}`}>
                {it.name}
                {it.scaleWithMilk && l.varies && <Zap size={11} className="inline ml-1 text-amber-500" aria-label="Set by each cow's milk" />}
              </span>
              {!each && (
                <span className="font-bold tabular-nums whitespace-nowrap text-text">
                  {fmtQty(total ? qs.reduce((t, q) => t + q, 0) : qs[0], it.unit)}
                </span>
              )}
            </div>
            {each && (
              <ul className="ml-4 mt-0.5 space-y-0.5">
                {members.map((a, j) => (
                  <li key={a.id} className="flex items-baseline gap-2 text-[12px]">
                    <span className="flex-1 text-text2">{animalLabel(a)}</span>
                    <span className="font-bold tabular-nums whitespace-nowrap text-text">{qs[j] > 0 ? fmtQty(qs[j], it.unit) : '–'}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FeedingSheet({ groups, plan, day, setDay, membersOf, unassigned }: {
  groups: RationGroup[]; plan: RationPlan; day: string; setDay: (d: string) => void;
  membersOf: (g: RationGroup) => RationAnimal[]; unassigned: RationAnimal[];
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
        const lines = resolveLines(g, members, day);
        const scaled = lines.some((l) => l.varies);
        const color = g.color || '#64748b';
        return (
          <section key={g.id} className="rounded-xl border border-border-custom overflow-hidden bg-white" style={{ borderLeft: `6px solid ${color}` }}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: `${color}14` }}>
              <span className="text-[15px] font-extrabold uppercase tracking-wide" style={{ color }}>{g.name}</span>
              <span className="text-[12px] font-semibold text-text2">{members.length} {members.length === 1 ? 'animal' : 'animals'}</span>
              {scaled && (
                <span className="text-[11px] text-amber-700 flex items-center gap-0.5"><Zap size={11} /> Concentrate set for each cow&rsquo;s milk</span>
              )}
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
                <ItemLines lines={lines} members={members} shift="morning" />
              </div>
              <div>
                <div className="md:hidden flex items-center gap-1 text-[11px] font-bold uppercase text-text3 mb-1"><Moon size={12} /> Evening</div>
                <ItemLines lines={lines} members={members} shift="evening" />
              </div>
            </div>
            {members.length > 1 && (
              <div className="grid grid-cols-2 md:grid-cols-[230px_1fr_1fr] gap-x-4 gap-y-2 px-4 py-3 bg-surface2/60 border-t border-border-custom">
                <div className="col-span-2 md:col-span-1 text-[12px] font-bold text-text2">
                  Total for {members.length} animals
                  <div className="text-[11px] font-normal text-text3">
                    {scaled ? 'Mix this, then give each cow her own amount' : 'Mix this, then give each animal its share'}
                  </div>
                </div>
                <ItemLines lines={lines} members={members} shift="morning" total />
                <ItemLines lines={lines} members={members} shift="evening" total />
              </div>
            )}
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <div className="flex items-start gap-2 text-[12px] bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Not in any batch (no batch rule fits): {unassigned.map(animalLabel).join(', ')}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-text3">
        {KINDS.map((k) => (
          <span key={k.id} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: k.dot }} />{k.label}</span>
        ))}
        <span className="flex items-center gap-1"><Zap size={11} className="text-amber-500" /> Set by each cow&rsquo;s milk</span>
      </div>
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Opens a plain, printer-friendly copy of the feeding sheet to stick up in the shed. */
function printSheet(groups: RationGroup[], day: string, membersOf: (g: RationGroup) => RationAnimal[]) {
  const cell = (lines: ResolvedLine[], members: RationAnimal[], shift: 'morning' | 'evening', total = false) =>
    lines.filter((l) => l[shift].some((q) => q > 0)).map((l) => {
      const qs = l[shift];
      if (!total && l.varies) {
        return `<div class="l"><span>${esc(l.item.name)}</span></div>`
          + members.map((a, j) => `<div class="l s"><span>${esc(animalLabel(a))}</span><b>${qs[j] > 0 ? fmtQty(qs[j], l.item.unit) : '–'}</b></div>`).join('');
      }
      const q = total ? qs.reduce((t, x) => t + x, 0) : qs[0];
      return `<div class="l"><span>${esc(l.item.name)}</span><b>${fmtQty(q, l.item.unit)}</b></div>`;
    }).join('') || '–';
  const body = groups.map((g) => {
    const members = membersOf(g);
    const lines = resolveLines(g, members, day);
    const total = members.length > 1
      ? `<tr class="t"><td>Total for ${members.length}</td><td>${cell(lines, members, 'morning', true)}</td><td>${cell(lines, members, 'evening', true)}</td></tr>`
      : '';
    return `<tr class="h"><td colspan="3" style="border-left:8px solid ${g.color || '#64748b'}">${esc(g.name.toUpperCase())}
        ${g.notes ? `<div class="n">${esc(g.notes)}</div>` : ''}</td></tr>
      <tr><td>${members.map((a) => `<div class="a">${esc(animalLabel(a))}</div>`).join('')}</td>
        <td>${cell(lines, members, 'morning')}</td><td>${cell(lines, members, 'evening')}</td></tr>${total}`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Feeding sheet ${day}</title><style>
    body{font-family:system-ui,sans-serif;margin:16px;color:#111}h1{font-size:18px;margin:0 0 8px}
    table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:6px 8px;vertical-align:top;font-size:13px}
    th{text-align:left;font-size:12px;padding:6px 8px;background:#eee;border:1px solid #999}
    tr.h td{background:#f4f4f4;font-weight:800;font-size:14px}.n{font-weight:400;font-size:12px;margin-top:2px;white-space:pre-line}
    tr.t td{background:#fafafa;font-size:12px}.l{display:flex;justify-content:space-between;gap:12px}.a{font-weight:700}
    .s{padding-left:12px;font-size:12px}
  </style></head><body><h1>Feeding sheet – ${fmtDate(day)}</h1>
  <table><thead><tr><th style="width:22%">Animals</th><th>Morning (each animal)</th><th>Evening (each animal)</th></tr></thead>
  <tbody>${body}</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

/* ------------------------------------------------------------------ Batches & animals */

function BatchSetup({ groups, animals, groupOf, membersOf, onEdit, onMove, onChanged }: {
  groups: RationGroup[]; animals: RationAnimal[]; groupOf: Map<number, RationGroup>;
  membersOf: (g: RationGroup) => RationAnimal[]; onEdit: (g: RationGroup) => void;
  onMove: (herdId: number, groupId: number | null) => void; onChanged: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (!confirm(`Delete batch "${g.name}"? Its animals go to whichever other batch's rule fits them.`)) return;
    await api.delete(`/ration/groups/${g.id}`);
    onChanged();
  };

  // Pinned animals a rule would also place: handing them back makes the plan follow their herd data.
  const pinnedWithRule = animals.filter((a) => a.pinned && a.ruleGroupId != null);
  const unpinAll = async () => {
    setBusy(true);
    try {
      await api.post('/ration/members/unpin', { herdIds: pinnedWithRule.map((a) => a.id) });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const moveNow = async (herdId: number) => {
    await api.post('/ration/members/unpin', { herdIds: [herdId] });
    onChanged();
  };
  const groupName = (id?: number | null) => groups.find((g) => g.id === id)?.name ?? '';
  const anyRules = groups.some((g) => !ruleIsEmpty(g.rule));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] bg-sky-50 border border-sky-200 text-sky-900 rounded-lg px-3 py-2">
        <Zap size={14} className="shrink-0" />
        <span className="flex-1 min-w-[240px]">
          Each batch can have a rule (status, milk per day, days in milk, age). Animals go to the first batch whose rule
          fits, and move by themselves as their milk and status change. After a move a cow stays at least 7 days before
          the rules move her again, so her feed doesn&rsquo;t switch back and forth; a change of status moves her at once.
          Pick a batch by hand to pin an animal there.
        </span>
        <button onClick={() => setSuggesting(true)}
          className="flex items-center gap-1 bg-white border border-sky-300 text-sky-800 px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-100">
          <Wand2 size={14} /> {anyRules ? 'Re-suggest rules' : 'Suggest rules'}
        </button>
        {anyRules && pinnedWithRule.length > 0 && (
          <button onClick={unpinAll} disabled={busy}
            className="flex items-center gap-1 bg-sky-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
            Let rules place {pinnedWithRule.length} pinned {pinnedWithRule.length === 1 ? 'animal' : 'animals'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {groups.map((g) => {
          const members = membersOf(g);
          return (
            <div key={g.id} className="rounded-xl border border-border-custom bg-white overflow-hidden" style={{ borderTop: `5px solid ${g.color || '#64748b'}` }}>
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="font-extrabold text-[14px]" style={{ color: g.color }}>{g.name}</span>
                <span className="text-[11px] text-text3">{members.length} {members.length === 1 ? 'animal' : 'animals'} · {g.items.length} lines</span>
                <button onClick={() => onEdit(g)} className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-brand"><Pencil size={13} /> Edit</button>
                <button onClick={() => removeBatch(g)} className="text-text3 hover:text-rose-600" title="Delete batch"><Trash2 size={14} /></button>
              </div>
              <div className="px-3 text-[11px] text-text2 flex items-center gap-1">
                <Zap size={11} className={ruleIsEmpty(g.rule) ? 'text-text3' : 'text-sky-600'} /> {ruleText(g.rule)}
                {g.refMilk ? <span className="text-text3"> · ration for {g.refMilk} L/day</span> : null}
              </div>
              <div className="px-3 pt-1 pb-3 text-[12px] text-text2">
                {members.length ? members.map((a) => (
                  <span key={a.id} className="mr-2 inline-flex items-center gap-0.5">
                    {a.pinned && <Pin size={10} className="text-text3" />}{animalLabel(a)}
                  </span>
                )) : <span className="text-text3">No animals yet</span>}
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
              <th className="text-right px-3 py-2">Milk (7-day avg)</th>
              <th className="text-right px-3 py-2">DIM</th>
              <th className="text-right px-3 py-2">Age</th>
              <th className="text-right px-3 py-2">BCS</th>
              <th className="text-left px-3 py-2">Batch</th>
            </tr>
          </thead>
          <tbody>
            {animals.map((a) => {
              const g = groupOf.get(a.id);
              const differs = a.pinned && a.ruleGroupId != null && a.ruleGroupId !== a.groupId;
              return (
                <tr key={a.id} className="border-t border-border-custom">
                  <td className="px-3 py-2 font-semibold">{animalLabel(a)}</td>
                  <td className="px-3 py-2 text-text2">{a.animalStatus ? a.animalStatus.charAt(0) + a.animalStatus.slice(1).toLowerCase() : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {a.animalStatus === 'LACTATING' && a.milkPerDay != null ? `${a.milkPerDay} L` : '–'}
                    {a.animalStatus === 'LACTATING' && a.milkPerDay != null && a.milk7Days == null && (
                      <div className="text-[10px] text-text3">30-day</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.animalStatus === 'LACTATING' && a.dim != null ? a.dim : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.ageMonths != null ? `${a.ageMonths} mo` : '–'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.bcs ?? '–'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <select value={a.pinned ? String(g?.id ?? '') : ''}
                        onChange={(e) => onMove(a.id, e.target.value ? Number(e.target.value) : null)}
                        className="border border-border-custom rounded-lg px-2 py-1 text-[12px] font-semibold"
                        style={{ color: g?.color }}>
                        <option value="">{a.ruleGroupId != null ? `Auto: ${groupName(a.ruleGroupId)}` : 'Auto: no rule fits'}</option>
                        {groups.map((x) => <option key={x.id} value={x.id}>Pin: {x.name}</option>)}
                      </select>
                      {a.pinned && <Pin size={12} className="text-text3" aria-label="Pinned by hand" />}
                    </div>
                    {differs && (
                      <div className="text-[11px] text-amber-700 mt-0.5">Rules would put her in {groupName(a.ruleGroupId)}</div>
                    )}
                    {!a.pinned && a.heldUntil && (
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Stays here till {fmtDate(a.heldUntil)} (joined {fmtDate(a.inBatchSince)}), then {a.ruleGroupId != null ? groupName(a.ruleGroupId) : 'no batch'}
                        {' '}· <button onClick={() => moveNow(a.id)} className="font-semibold underline">Move now</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {suggesting && (
        <SuggestRulesDialog groups={groups} animals={animals} onClose={() => setSuggesting(false)}
          onApplied={() => { setSuggesting(false); onChanged(); }} />
      )}
    </div>
  );
}

/**
 * Proposes a rule for every batch from where today's animals sit, shows where each animal would
 * land, and on Apply saves the rules and hands the animals back to them.
 */
function SuggestRulesDialog({ groups, animals, onClose, onApplied }: {
  groups: RationGroup[]; animals: RationAnimal[]; onClose: () => void; onApplied: () => void;
}) {
  const suggestions = useMemo(() => suggestRules(groups, animals), [groups, animals]);
  const [scale, setScale] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const proposed = groups.map((g, i) => ({ ...g, rule: suggestions[i].rule, refMilk: suggestions[i].refMilk }));
  const landing = new Map(animals.map((a) => [a.id, ruleBatchFor(proposed, a)]));
  const moved = animals.filter((a) => landing.get(a.id) != null && landing.get(a.id) !== (a.groupId ?? null));
  const nameOf = (id: number | null | undefined) => groups.find((g) => g.id === id)?.name ?? 'no batch';

  const apply = async () => {
    setSaving(true);
    setError('');
    try {
      for (const [i, g] of groups.entries()) {
        const s: RuleSuggestion = suggestions[i];
        await api.put(`/ration/groups/${g.id}`, {
          name: g.name, color: g.color, notes: g.notes, sortOrder: g.sortOrder,
          rule: s.rule, refMilk: s.refMilk,
          items: g.items.map((it) => ({
            ...it,
            scaleWithMilk: s.refMilk && scale ? it.kind === 'CONCENTRATE' || !!it.scaleWithMilk : !!it.scaleWithMilk,
          })),
        });
      }
      // Applying is the owner's call, so it takes effect today: no week's hold for these moves.
      const placed = animals.filter((a) => landing.get(a.id) != null).map((a) => a.id);
      if (placed.length) await api.post('/ration/members/unpin', { herdIds: placed });
      // Animals no new rule fits keep their current batch, pinned there.
      for (const a of animals) {
        if (!a.pinned && a.groupId != null && landing.get(a.id) == null) {
          await api.put('/ration/members', { herdId: a.id, groupId: a.groupId });
        }
      }
      onApplied();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save the rules.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-2 md:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-custom">
          <h3 className="font-bold text-[15px] flex items-center gap-1.5"><Wand2 size={16} /> Suggested batch rules</h3>
          <button onClick={onClose} className="ml-auto text-text3 hover:text-text"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-3 text-[13px]">
          <p className="text-[12px] text-text2">
            Worked out from where each animal is today. From now on animals move between batches by themselves as their
            status, milk and age change. You can fine-tune any rule later under Edit.
          </p>
          <table className="w-full">
            <thead className="text-[11px] uppercase text-text3 bg-surface2">
              <tr><th className="text-left px-2 py-1.5">Batch</th><th className="text-left px-2 py-1.5">Rule</th><th className="text-left px-2 py-1.5">Animals today</th></tr>
            </thead>
            <tbody>
              {proposed.map((g) => (
                <tr key={g.id} className="border-t border-border-custom align-top">
                  <td className="px-2 py-1.5 font-bold" style={{ color: g.color }}>{g.name}</td>
                  <td className="px-2 py-1.5 text-text2">
                    {ruleText(g.rule)}
                    {g.refMilk ? <div className="text-[11px] text-text3">Ration written for {g.refMilk} L/day</div> : null}
                  </td>
                  <td className="px-2 py-1.5">
                    {animals.filter((a) => landing.get(a.id) === g.id).map(animalLabel).join(', ') || <span className="text-text3">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {moved.length > 0 && (
            <div className="text-[12px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
              These would change batch: {moved.map((a) => `${animalLabel(a)} (${nameOf(a.groupId)} → ${nameOf(landing.get(a.id))})`).join(', ')}.
              {' '}Animals that land in no batch keep their current one.
            </div>
          )}
          {suggestions.some((s) => s.refMilk) && (
            <label className="flex items-start gap-2 text-[12px] text-text2">
              <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} className="mt-0.5" />
              <span>
                Set concentrate for each milking cow by her own milk: 1 kg more or less for every 2.5 L above or below the
                batch&rsquo;s figure (2 L for buffaloes), kept between half and one and a half times the ration.
              </span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border-custom">
          {error && <span className="text-[12px] text-rose-600">{error}</span>}
          <button onClick={onClose} className="ml-auto px-4 py-1.5 rounded-lg text-[12px] font-semibold text-text2 border border-border-custom">Cancel</button>
          <button onClick={apply} disabled={saving} className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-brand text-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Apply rules'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Purchase list */

function PurchaseList({ groups, plan, storeItems, membersOf, onSaved }: {
  groups: RationGroup[]; plan: RationPlan; storeItems: StoreItemLite[];
  membersOf: (g: RationGroup) => RationAnimal[]; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RationPlan>(plan);
  const [products, setProducts] = useState<Record<string, ProductSetting>>(() => parseProducts(plan));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const rows = useMemo(
    () => purchaseRows(groups, draft, products, storeItems, membersOf),
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
        <span>Concentrate and mineral lines only; fodder, hotel waste and milk are not bought. Amounts follow today&rsquo;s batches and milk.</span>
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
