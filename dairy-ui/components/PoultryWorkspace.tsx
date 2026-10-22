'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Edit2, Egg, Skull, Trash2, RefreshCw } from 'lucide-react';
import BatchIcon from '@/components/BatchIcon';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { BIRD_DEATH, EGGS_COLLECTED, batchType, liveBirds, sumQty } from '@/lib/poultry';

interface Herd {
  id: number;
  tagNumber: string;
  animalType: string;
  animalName: string;
  breed: string;
  source: string;
  birthDate: string;
  procuredDate: string;
  birdCount?: number;
  costPerBird?: number;
  purpose?: string;
  notes?: string;
}

interface HerdEvent {
  id: number;
  herdId: number;
  eventDate: string;
  eventType: string;
  title: string;
  details?: string;
  quantity?: number | null;
}

interface Props {
  herd: Herd;
  events: HerdEvent[];
  loadingEvents: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEventAdded: (e: HerdEvent) => void;
  onEventDeleted: (id: number) => void;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const niceDate = (iso?: string) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ageLabel = (birth?: string) => {
  if (!birth) return '—';
  const days = Math.max(0, Math.floor((Date.now() - new Date(birth + 'T00:00:00').getTime()) / 86400000));
  return days >= 60 ? `${Math.floor(days / 30)} months` : `${days} days`;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function PoultryWorkspace({ herd, events, loadingEvents, onBack, onEdit, onDelete, onEventAdded, onEventDeleted }: Props) {
  const { showToast, confirm } = useNotification();
  const bt = batchType(herd.animalType);
  const laysEggs = bt.laysEggs && herd.purpose !== 'MEAT';

  const [form, setForm] = useState<null | 'death' | 'eggs'>(null);
  const [date, setDate] = useState(todayIso());
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const start = herd.birdCount ?? 0;
  const deaths = sumQty(events, BIRD_DEATH);
  const alive = liveBirds(start, events);
  const eggsTotal = sumQty(events, EGGS_COLLECTED);
  const eggs7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const from = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return events.reduce((t, e) => (e.eventType === EGGS_COLLECTED && e.eventDate >= from ? t + (e.quantity || 0) : t), 0);
  }, [events]);
  const cost = (herd.costPerBird ?? 0) * start;
  const mortality = start > 0 ? Math.round((deaths / start) * 100) : 0;

  const log = events
    .filter(e => e.eventType === BIRD_DEATH || e.eventType === EGGS_COLLECTED)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id - a.id);

  const openForm = (kind: 'death' | 'eggs') => {
    setForm(kind);
    setDate(todayIso());
    setCount('');
    setNote('');
  };

  const save = async () => {
    const n = parseInt(count);
    if (!(n > 0)) { showToast('Enter a number greater than zero.', 'error'); return; }
    if (form === 'death' && n > alive) { showToast(`Only ${alive} ${bt.unit} are alive in this batch.`, 'error'); return; }
    setSaving(true);
    try {
      const isDeath = form === 'death';
      const res = await api.post(`/herds/${herd.id}/events`, {
        eventDate: date,
        eventType: isDeath ? BIRD_DEATH : EGGS_COLLECTED,
        title: isDeath ? (bt.unit === 'fish' ? `${n} fish died` : `${n} bird${n === 1 ? '' : 's'} died`) : `${n} eggs collected`,
        details: note.trim() || null,
        quantity: n,
      });
      onEventAdded(res.data);
      showToast(isDeath ? 'Deaths recorded' : 'Eggs recorded');
      setForm(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = (e: HerdEvent) => {
    confirm(`Remove "${e.title}" on ${niceDate(e.eventDate)}?`, async () => {
      try {
        await api.delete(`/herds/events/${e.id}`);
        onEventDeleted(e.id);
      } catch {
        showToast('Could not remove the entry.', 'error');
      }
    }, 'danger');
  };

  const Stat = ({ label, value, tone = 'text-text' }: { label: string; value: string | number; tone?: string }) => (
    <div className="bg-white border border-border-custom rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-bold text-text3 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black ${tone}`}>{value}</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <button onClick={onBack} className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-4">
        <ArrowLeft size={16} /> Back to herd
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bt.tile}`}>
          <BatchIcon type={herd.animalType} size={28} className={bt.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-text truncate">{herd.animalName || herd.tagNumber}</h1>
          <p className="text-[12px] text-text3">
            {[bt.label, herd.breed, herd.purpose ? `For ${herd.purpose.toLowerCase()}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={onEdit} aria-label="Edit batch" title="Edit batch"
          className="p-2.5 rounded-lg border border-border-custom text-text2 hover:bg-surface2"><Edit2 size={16} /></button>
        <button onClick={onDelete} aria-label="Delete batch" title="Delete batch"
          className="p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <Stat label="Alive now" value={alive} tone="text-brand" />
        <Stat label="Deaths" value={`${deaths}${start ? ` (${mortality}%)` : ''}`} tone={deaths > 0 ? 'text-red-600' : 'text-text'} />
        <Stat label="Started with" value={start} />
        <Stat label="Age" value={ageLabel(herd.birthDate)} />
        {laysEggs && <Stat label="Eggs, last 7 days" value={eggs7} />}
        {laysEggs && <Stat label="Eggs, total" value={eggsTotal} />}
        <Stat label="Batch cost" value={cost ? inr(cost) : '—'} />
        <Stat label="Batch date" value={niceDate(herd.procuredDate)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => openForm('death')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold ${form === 'death' ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-700 bg-white hover:bg-red-50'}`}>
          <Skull size={16} /> Record deaths
        </button>
        {laysEggs && (
          <button onClick={() => openForm('eggs')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold ${form === 'eggs' ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-700 bg-white hover:bg-amber-50'}`}>
            <Egg size={16} /> Record eggs
          </button>
        )}
      </div>

      {form && (
        <div className="bg-white border border-border-custom rounded-xl p-3 mb-5 grid grid-cols-2 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
          <label className="text-[11px] font-bold text-text3 uppercase">
            Date
            <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)}
              className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-sm font-semibold normal-case" />
          </label>
          <label className="text-[11px] font-bold text-text3 uppercase">
            {form === 'death' ? (bt.unit === 'fish' ? 'Fish died' : 'Birds died') : 'Eggs collected'}
            <input type="number" min={1} inputMode="numeric" autoFocus value={count} onChange={e => setCount(e.target.value)}
              className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-sm font-semibold" />
          </label>
          <label className="text-[11px] font-bold text-text3 uppercase col-span-2 sm:col-span-1">
            {form === 'death' ? 'Cause (optional)' : 'Note (optional)'}
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder={form === 'death' ? 'e.g. heat, disease, predator' : 'e.g. 3 cracked'}
              className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-sm font-semibold normal-case" />
          </label>
          <div className="col-span-2 sm:col-span-1 flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setForm(null)} className="px-3 py-2 rounded-lg border border-border-custom text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-border-custom rounded-xl">
        <div className="px-4 py-2.5 border-b border-border-custom text-[11px] font-black text-text3 uppercase tracking-wider">History</div>
        {loadingEvents ? (
          <div className="flex items-center justify-center p-6 text-text3 text-sm"><RefreshCw size={16} className="animate-spin mr-2" /> Loading…</div>
        ) : log.length === 0 ? (
          <p className="text-center text-sm text-text3 py-6">No deaths or eggs recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border-custom">
            {log.map(e => {
              const isDeath = e.eventType === BIRD_DEATH;
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                  {isDeath ? <Skull size={16} className="text-red-500 shrink-0" /> : <Egg size={16} className="text-amber-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text">{e.title}</p>
                    <p className="text-[11px] text-text3 truncate">{niceDate(e.eventDate)}{e.details ? ` · ${e.details}` : ''}</p>
                  </div>
                  <button onClick={() => removeEntry(e)} aria-label="Remove entry" className="text-text3 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(herd.source || herd.notes) && (
        <p className="text-[12px] text-text3 mt-4">
          {herd.source && <>Supplier: <b className="text-text2">{herd.source}</b></>}
          {herd.source && herd.notes && ' · '}
          {herd.notes}
        </p>
      )}
    </div>
  );
}
