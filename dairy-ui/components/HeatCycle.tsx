'use client';

// Heat cycle pieces for the Breeding window's Heat tab: status labels, and the panel a cow's
// row opens with her heat history and a form to record a heat.

import React, { useState } from 'react';
import { Flame, Plus, Trash2, X, Syringe, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import {
  HEAT_EVENT, HEAT_SIGNS, HeatEventLike, HeatStatus, HeatSummary, fmtDate, heatDetails, isoToday,
} from '@/lib/heat';

export const HEAT_STATUS: Record<HeatStatus, { label: string; pill: string; rank: number }> = {
  IN_HEAT:      { label: 'Heat due now',    pill: 'bg-rose-100 text-rose-700',       rank: 0 },
  MISSED:       { label: 'Heat missed',     pill: 'bg-red-100 text-red-700',         rank: 1 },
  NO_HEAT:      { label: 'No heat · check', pill: 'bg-red-100 text-red-700',         rank: 2 },
  DUE_SOON:     { label: 'Due this week',   pill: 'bg-amber-100 text-amber-800',     rank: 3 },
  INSEMINATED:  { label: 'Inseminated',     pill: 'bg-violet-100 text-violet-700',   rank: 4 },
  PD_DUE:       { label: 'PD due',          pill: 'bg-indigo-100 text-indigo-700',   rank: 5 },
  UPCOMING:     { label: 'Upcoming',        pill: 'bg-slate-100 text-slate-600',     rank: 6 },
  POST_CALVING: { label: 'After calving',   pill: 'bg-emerald-100 text-emerald-700', rank: 7 },
  NO_RECORD:    { label: 'No record',       pill: 'bg-slate-100 text-slate-500',     rank: 8 },
  PREGNANT:     { label: 'Pregnant',        pill: 'bg-green-100 text-green-700',     rank: 9 },
};

/** Sort key for the Heat tab: most urgent first, then soonest. */
export const heatSortKey = (s: HeatSummary) => HEAT_STATUS[s.status].rank * 100000 + (s.daysToNext ?? 9999);

function History({ s, onDelete }: { s: HeatSummary; onDelete: (e: HeatEventLike) => void }) {
  if (!s.history.length) return <div className="text-[13px] text-text3">No heats recorded yet.</div>;
  return (
    <ol className="border-l-2 border-rose-200 ml-1.5 space-y-2.5">
      {s.history.map(h => {
        const Icon = h.source === 'AI' ? Syringe : h.source === 'RETURNED' ? RotateCcw : Flame;
        const label = h.source === 'AI' ? 'Inseminated (in heat)' : h.source === 'RETURNED' ? 'Returned to heat' : 'Heat observed';
        const gapTone = h.gap == null ? '' : h.gap >= 18 && h.gap <= 24 ? 'text-green-700' : h.gap > 30 ? 'text-red-600' : 'text-amber-700';
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
                <button type="button" onClick={() => onDelete(h.event)} aria-label="Delete heat" className="text-text3 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One cow's heat cycle: where she is, her history, and recording a new heat. */
export function HeatPanel({ herdId, name, s, minDate, onClose, onChanged }: {
  herdId: number; name: string; s: HeatSummary;
  /** Earliest heat date: the day she turns 11 months, when her birth date is known. */
  minDate?: string | null;
  onClose: () => void; onChanged: () => void;
}) {
  const { showToast, confirm } = useNotification();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(isoToday());
  const [signs, setSigns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toggle = (x: string) => setSigns(xs => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]));
  const st = HEAT_STATUS[s.status];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/herds/${herdId}/events`, {
        eventDate: date, eventType: HEAT_EVENT, title: 'Heat observed', details: heatDetails(signs, notes),
      });
      showToast('Heat recorded', 'success');
      setAdding(false); setSigns([]); setNotes(''); setDate(isoToday());
      onChanged();
    } catch {
      showToast("Couldn't save the heat. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (e: HeatEventLike) => confirm(`Delete the heat on ${fmtDate(e.eventDate)}?`, async () => {
    try { await api.delete(`/herds/events/${e.id}`); showToast('Heat deleted', 'success'); onChanged(); }
    catch { showToast("Couldn't delete. Try again.", 'error'); }
  }, 'danger');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-black text-text flex items-center gap-2"><Flame size={18} className="text-rose-600" /> Heat cycle · {name}</h2>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide ${st.pill}`}>{st.label}</span>
              <span className="text-[12px] text-text3">{s.note}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text3 hover:text-text"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Last heat', s.lastHeat ? fmtDate(s.lastHeat.date) : '—'],
            ['Next expected', s.nextExpected ? fmtDate(s.nextExpected) : '—'],
            ['Cycle', `${s.cycleDays} days${s.ownCycle ? '' : ' (std)'}`],
          ].map(([l, v]) => (
            <div key={l} className="bg-slate-50 rounded-lg p-2">
              <div className="text-[10px] font-bold text-text3 uppercase tracking-wider">{l}</div>
              <div className="text-[13px] font-black text-text">{v}</div>
            </div>
          ))}
        </div>

        {adding ? (
          <form onSubmit={save} className="border border-rose-200 rounded-xl p-3 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Heat date</span>
              <input type="date" required min={minDate ?? undefined} max={isoToday()} value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full border border-border-custom rounded-lg px-3 py-2 text-[14px]" />
            </label>
            <div>
              <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Signs seen</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HEAT_SIGNS.map(x => (
                  <button key={x} type="button" onClick={() => toggle(x)}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border ${signs.includes(x) ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-text2 border-border-custom'}`}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes: time seen, strength, who saw it…"
              className="w-full border border-border-custom rounded-lg px-3 py-2 text-[14px]" />
            <p className="text-[12px] text-text3">If she was inseminated on this heat, record the AI on her page instead. It counts as a heat here.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 border border-border-custom rounded-lg py-2 text-[13px] font-bold text-text2">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-lg py-2 text-[13px]">
                {saving ? 'Saving…' : 'Save heat'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg py-2.5 text-[14px]">
            <Plus size={16} /> Record heat
          </button>
        )}

        <div>
          <div className="text-[11px] font-bold text-text3 uppercase tracking-wider mb-2">History</div>
          <History s={s} onDelete={remove} />
        </div>
      </div>
    </div>
  );
}
