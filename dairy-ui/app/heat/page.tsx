'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Flame, ChevronDown, ChevronRight, Plus, Trash2, X, Search, Syringe, RotateCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { isPoultryType } from '@/lib/poultry';
import {
  HEAT_EVENT, HEAT_SIGNS, HeatEventLike, HeatStatus, HeatSummary, fmtDate, heatDetails, isoToday, summariseHeat,
} from '@/lib/heat';

interface Herd {
  id: number; tagNumber: string; animalName?: string; animalType: string; animalStatus?: string; status?: string;
}
interface Row { herd: Herd; s: HeatSummary }

const STATUS: Record<HeatStatus, { label: string; pill: string; rank: number }> = {
  IN_HEAT:      { label: 'Heat due now',     pill: 'bg-rose-100 text-rose-700',       rank: 0 },
  MISSED:       { label: 'Heat missed',      pill: 'bg-[#FDEAEA] text-danger',        rank: 1 },
  NO_HEAT:      { label: 'No heat · check',  pill: 'bg-[#FDEAEA] text-danger',        rank: 2 },
  DUE_SOON:     { label: 'Due this week',    pill: 'bg-[#FEF6E0] text-[#8a5a00]',     rank: 3 },
  INSEMINATED:  { label: 'Inseminated',      pill: 'bg-violet-100 text-violet-700',   rank: 4 },
  PD_DUE:       { label: 'PD due',           pill: 'bg-indigo-100 text-indigo-700',   rank: 5 },
  UPCOMING:     { label: 'Upcoming',         pill: 'bg-surface2 text-text2',          rank: 6 },
  POST_CALVING: { label: 'After calving',    pill: 'bg-emerald-100 text-emerald-700', rank: 7 },
  NO_RECORD:    { label: 'No record',        pill: 'bg-surface2 text-text3',          rank: 8 },
  PREGNANT:     { label: 'Pregnant',         pill: 'bg-[#E8F5EE] text-brand',         rank: 9 },
};

const FILTERS: { key: string; label: string; match: (s: HeatStatus) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'now', label: 'Due now', match: s => s === 'IN_HEAT' },
  { key: 'week', label: 'This week', match: s => s === 'IN_HEAT' || s === 'DUE_SOON' },
  { key: 'attention', label: 'Needs attention', match: s => s === 'MISSED' || s === 'NO_HEAT' },
  { key: 'bred', label: 'Inseminated / PD', match: s => s === 'INSEMINATED' || s === 'PD_DUE' },
  { key: 'pregnant', label: 'Pregnant', match: s => s === 'PREGNANT' },
  { key: 'none', label: 'No record', match: s => s === 'NO_RECORD' },
];

const nameOf = (h: Herd) => h.animalName ? `${h.animalName} · ${h.tagNumber}` : h.tagNumber;
const whenText = (d: number | null) =>
  d == null ? '' : d === 0 ? 'today' : d > 0 ? `in ${d} day${d > 1 ? 's' : ''}` : `${-d} day${d < -1 ? 's' : ''} ago`;

function RecordHeatModal({ herds, herdId, onClose, onSaved }: {
  herds: Herd[]; herdId: number | null; onClose: () => void; onSaved: () => void;
}) {
  const { showToast } = useNotification();
  const [animal, setAnimal] = useState<number | ''>(herdId ?? '');
  const [date, setDate] = useState(isoToday());
  const [signs, setSigns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toggle = (s: string) => setSigns(xs => (xs.includes(s) ? xs.filter(x => x !== s) : [...xs, s]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal) return;
    setSaving(true);
    try {
      await api.post(`/herds/${animal}/events`, {
        eventDate: date, eventType: HEAT_EVENT, title: 'Heat observed', details: heatDetails(signs, notes),
      });
      showToast('Heat recorded', 'success');
      onSaved();
    } catch {
      showToast("Couldn't save the heat. Try again.", 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-black text-text flex items-center gap-2"><Flame size={18} className="text-rose-600" /> Record heat</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text3 hover:text-text"><X size={18} /></button>
        </div>
        <label className="block">
          <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Animal</span>
          <select required value={animal} onChange={e => setAnimal(e.target.value ? +e.target.value : '')}
            className="mt-1 w-full border border-border-custom rounded-lg px-3 py-2 text-[14px]">
            <option value="">Select animal…</option>
            {herds.map(h => <option key={h.id} value={h.id}>{nameOf(h)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Heat date</span>
          <input type="date" required max={isoToday()} value={date} onChange={e => setDate(e.target.value)}
            className="mt-1 w-full border border-border-custom rounded-lg px-3 py-2 text-[14px]" />
        </label>
        <div>
          <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Signs seen</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {HEAT_SIGNS.map(s => (
              <button key={s} type="button" onClick={() => toggle(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border ${signs.includes(s) ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-text2 border-border-custom'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Notes</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Time seen, strength, who saw it…"
            className="mt-1 w-full border border-border-custom rounded-lg px-3 py-2 text-[14px]" />
        </label>
        <p className="text-[12px] text-text3">If she was inseminated on this heat, record the AI on the animal's page instead. It counts as a heat here.</p>
        <button type="submit" disabled={saving || !animal}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-lg py-2.5 text-[14px]">
          {saving ? 'Saving…' : 'Save heat'}
        </button>
      </form>
    </div>
  );
}

function History({ row, onDelete }: { row: Row; onDelete: (e: HeatEventLike) => void }) {
  const { history, cycleDays, ownCycle } = row.s;
  if (!history.length) return <div className="px-4 pb-4 text-[13px] text-text3">No heats recorded yet.</div>;
  return (
    <div className="px-4 pb-4">
      <div className="text-[12px] text-text3 mb-2">
        Cycle length {cycleDays} days {ownCycle ? '(her own, from her history)' : '(standard; record more heats to learn hers)'}
      </div>
      <ol className="border-l-2 border-rose-200 ml-1.5 space-y-2.5">
        {history.map(h => {
          const Icon = h.source === 'AI' ? Syringe : h.source === 'RETURNED' ? RotateCcw : Flame;
          const label = h.source === 'AI' ? 'Inseminated (in heat)' : h.source === 'RETURNED' ? 'Returned to heat' : 'Heat observed';
          const gapTone = h.gap == null ? '' : h.gap >= 18 && h.gap <= 24 ? 'text-brand' : h.gap > 30 ? 'text-danger' : 'text-[#8a5a00]';
          return (
            <li key={`${h.date}-${h.event.id}`} className="relative pl-4">
              <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-rose-400 border-2 border-white" />
              <div className="flex items-start gap-2">
                <Icon size={14} className="text-rose-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-text">
                    {fmtDate(h.date)} <span className="font-medium text-text2">· {label}</span>
                    {h.gap != null && <span className={`ml-1.5 text-[12px] font-black ${gapTone}`}>+{h.gap} days</span>}
                  </div>
                  {h.event.details && <div className="text-[12px] text-text3 break-words">{h.event.details}</div>}
                </div>
                {h.source === 'OBSERVED' && (
                  <button type="button" onClick={() => onDelete(h.event)} aria-label="Delete heat" className="text-text3 hover:text-danger p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function HeatCyclesPage() {
  const { showToast, confirm } = useNotification();
  const [herds, setHerds] = useState<Herd[] | null>(null);
  const [events, setEvents] = useState<HeatEventLike[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showCalves, setShowCalves] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [modal, setModal] = useState<{ herdId: number | null } | null>(null);

  const load = () =>
    Promise.all([api.get('/herds'), api.get('/herds/events/all')])
      .then(([h, e]) => { setHerds(h.data || []); setEvents(e.data || []); setError(''); })
      .catch(() => setError("Couldn't load the herd. Try again."));
  useEffect(() => { load(); }, []);

  const animals = useMemo(() => (herds || [])
    .filter(h => h.status !== 'DISPOSED' && h.status !== 'SOLD' && !isPoultryType(h.animalType))
    .filter(h => showCalves || h.animalStatus !== 'CALF')
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [herds, showCalves]);

  const rows: Row[] = useMemo(() => {
    const byHerd = new Map<number, HeatEventLike[]>();
    for (const e of events) (byHerd.get(e.herdId) ?? byHerd.set(e.herdId, []).get(e.herdId)!).push(e);
    return animals.map(herd => ({ herd, s: summariseHeat(byHerd.get(herd.id) ?? []) }))
      .sort((a, b) => STATUS[a.s.status].rank - STATUS[b.s.status].rank
        || (a.s.daysToNext ?? 9999) - (b.s.daysToNext ?? 9999));
  }, [animals, events]);

  const count = (k: string) => rows.filter(r => FILTERS.find(f => f.key === k)!.match(r.s.status)).length;
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => FILTERS.find(f => f.key === filter)!.match(r.s.status)
    && (!q || nameOf(r.herd).toLowerCase().includes(q)));

  const remove = (e: HeatEventLike) => confirm(`Delete the heat on ${fmtDate(e.eventDate)}?`, async () => {
    try { await api.delete(`/herds/events/${e.id}`); showToast('Heat deleted', 'success'); load(); }
    catch { showToast("Couldn't delete. Try again.", 'error'); }
  }, 'danger');

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-10 px-1">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight uppercase flex items-center gap-2 sm:gap-3">
              <Flame size={22} className="text-rose-600" /> Heat Cycles
            </h1>
            <p className="text-[13px] text-text3 mt-1 font-medium">Every cow's heats, her cycle length and when the next one is due.</p>
          </div>
          <button type="button" onClick={() => setModal({ herdId: null })}
            className="shrink-0 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg px-3 py-2 text-[13px]">
            <Plus size={16} /> Record heat
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
          {FILTERS.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-black whitespace-nowrap border ${filter === f.key ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom hover:border-brand'}`}>
              {f.label} <span className="opacity-70">{herds ? count(f.key) : ''}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or tag"
              className="w-full border border-border-custom rounded-lg pl-9 pr-3 py-2 text-[13px] bg-white" />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-text2 whitespace-nowrap">
            <input type="checkbox" checked={showCalves} onChange={e => setShowCalves(e.target.checked)} /> Show calves
          </label>
        </div>

        {error && <div className="text-danger text-[13px] mb-3">{error}</div>}
        {!herds && !error && <div className="text-text3 text-[13px]">Loading…</div>}

        <div className="bg-white rounded-radius-custom-lg border border-border-custom divide-y divide-border-custom">
          {herds && shown.length === 0 && <div className="p-4 text-[13px] text-text3">No animals here.</div>}
          {shown.map(r => {
            const st = STATUS[r.s.status], isOpen = open === r.herd.id;
            return (
              <div key={r.herd.id}>
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.herd.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 text-left">
                    {isOpen ? <ChevronDown size={16} className="text-text3 shrink-0" /> : <ChevronRight size={16} className="text-text3 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-black text-text truncate">{nameOf(r.herd)}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md ${st.pill}`}>{st.label}</span>
                      </div>
                      <div className="text-[12px] text-text3 truncate">{r.s.note}</div>
                    </div>
                    <div className="hidden sm:block text-right w-32 shrink-0">
                      <div className="text-[10px] font-bold text-text3 uppercase tracking-wider">Last heat</div>
                      <div className="text-[13px] font-bold text-text">{r.s.lastHeat ? fmtDate(r.s.lastHeat.date) : '—'}</div>
                    </div>
                    <div className="text-right w-28 sm:w-32 shrink-0">
                      <div className="text-[10px] font-bold text-text3 uppercase tracking-wider">Next expected</div>
                      <div className="text-[13px] font-bold text-text">{r.s.nextExpected ? fmtDate(r.s.nextExpected) : '—'}</div>
                      {r.s.nextExpected && <div className="text-[11px] text-text3">{whenText(r.s.daysToNext)}</div>}
                    </div>
                  </button>
                  <button type="button" onClick={() => setModal({ herdId: r.herd.id })} title="Record heat"
                    className="shrink-0 flex items-center gap-1 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg px-2 py-1.5 text-[12px] font-black">
                    <Plus size={14} /><span className="hidden sm:inline">Heat</span>
                  </button>
                </div>
                {isOpen && <History row={r} onDelete={remove} />}
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <RecordHeatModal herds={animals} herdId={modal.herdId} onClose={() => setModal(null)}
          onSaved={() => { if (modal.herdId) setOpen(modal.herdId); setModal(null); load(); }} />
      )}
    </AppLayout>
  );
}
