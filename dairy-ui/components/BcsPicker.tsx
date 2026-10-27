'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Droplets, Heart, FlaskConical, ShieldAlert, Activity, ArrowRight, TrendingDown } from 'lucide-react';

/* Body Condition Score (BCS), 1-5 for dairy cows. 3 is ideal.
   Pictures are the rear view from the farm's HF reference chart (public/bcs). */
export const BCS_LEVELS = [
  { score: 1, label: 'Very Thin', tip: 'Ribs, spine, hips very prominent — needs nutrition now',
    frame: 'border-2 border-red-600', text: 'text-red-700', bg: 'bg-red-50' },
  { score: 2, label: 'Thin', tip: 'Ribs and spine easily seen — increase feed',
    frame: 'border-2 border-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  { score: 3, label: 'Ideal', tip: 'Smooth topline, good fat cover — maintain diet',
    frame: 'border-[3px] border-green-600', text: 'text-green-700', bg: 'bg-green-50' },
  { score: 4, label: 'Fat', tip: 'Spine and hips covered — less concentrate, more roughage',
    frame: 'border-2 border-green-300', text: 'text-green-600', bg: 'bg-green-50/60' },
  { score: 5, label: 'Very Fat', tip: 'Heavy fat cover — calving and metabolic risk',
    frame: 'border-2 border-dashed border-[#7f1d1d] ring-1 ring-green-600 ring-offset-1', text: 'text-[#7f1d1d]', bg: 'bg-rose-50' },
] as const;

/** Major problems with low BCS (1-2) in HF cows. */
const LOW_BCS_RISKS = [
  { icon: Droplets, title: 'Reduced milk production',
    text: 'Insufficient energy reserves cause weight loss and difficulty sustaining milk yield.' },
  { icon: Heart, title: 'Reproductive problems',
    text: 'Delayed heat, poor conception and prolonged calving intervals.' },
  { icon: FlaskConical, title: 'Metabolic diseases',
    text: 'Increased risk of ketosis and fatty liver disease, especially around calving and early lactation.' },
  { icon: ShieldAlert, title: 'Weak immunity and infections',
    text: 'Increased susceptibility to mastitis, metritis (uterine infection) and other illnesses.' },
  { icon: Activity, title: 'Severe weakness and physical complications',
    text: 'Muscle loss, increased vulnerability to parasitism, and a higher risk of downer cow syndrome when severe weakness combines with calving-related injury, hypocalcaemia or other illness.' },
];

/** Sub-popup over the BCS picker listing the low-BCS risks. */
function LowBcsRiskModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2200] bg-black/60 flex items-end md:items-center justify-center md:p-6"
      onClick={e => { e.stopPropagation(); onClose(); }}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full md:max-w-lg max-h-[90vh] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="px-4 md:px-5 py-3.5 flex items-center justify-between shrink-0 bg-red-600">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/15 p-1.5 rounded-lg"><AlertTriangle size={16} className="text-white" /></div>
            <div>
              <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Low BCS (1–2) risks</h3>
              <p className="text-[10px] text-white/80 font-semibold uppercase mt-0.5">Top 5 problems in HF cows</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 md:p-1.5 rounded-full" aria-label="Close"><X size={16} /></button>
        </div>
        <ol className="flex-1 overflow-y-auto divide-y divide-border-custom/60">
          {LOW_BCS_RISKS.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.title} className="flex gap-3 px-4 md:px-5 py-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-red-50 flex items-center justify-center"><Icon size={15} className="text-red-600" /></div>
                <div className="min-w-0">
                  <div className="text-[13px] font-black text-text">{i + 1}. {r.title}</div>
                  <div className="text-[12px] text-text2 leading-snug mt-0.5">{r.text}</div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="px-4 md:px-5 py-3 border-t border-border-custom shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-[12px] uppercase">Back to scores</button>
        </div>
      </div>
    </div>
  );
}

export const bcsLevel = (bcs?: number | null) => BCS_LEVELS.find(l => l.score === bcs) ?? null;

/** Small square showing the current score; dashed grey "+" when not scored. */
export function BcsBadge({ bcs, onClick, size = 36 }: { bcs?: number | null; onClick: (e: React.MouseEvent) => void; size?: number }) {
  const lvl = bcsLevel(bcs);
  return (
    <button type="button" onClick={onClick} title={lvl ? `BCS ${lvl.score} · ${lvl.label} — tap to change` : 'Set body condition score'}
      className="relative inline-flex shrink-0 align-middle active:scale-95 transition-transform" style={{ width: size, height: size }}>
      {lvl ? (
        <>
          <img src={`/bcs/bcs-${lvl.score}.jpg`} alt={`BCS ${lvl.score}`} className={`w-full h-full rounded-md object-cover ${lvl.frame}`} />
          <span className={`absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-white text-[10px] font-black leading-4 text-center shadow ${lvl.text}`}>{lvl.score}</span>
        </>
      ) : (
        <span className="w-full h-full rounded-md border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center text-sm font-bold">+</span>
      )}
    </button>
  );
}

/** Pick 1-5 by picture. Full screen on phones, centred dialog on desktop. */
export function BcsPickerModal({ animalName, value, scoredToday, onSelect, onClose }: {
  animalName: string; value?: number | null; scoredToday?: boolean; onSelect: (bcs: number | null) => void; onClose: () => void;
}) {
  const [showRisks, setShowRisks] = useState(false);
  return (
    <div className="fixed inset-0 z-[2100] bg-white md:bg-black/70 md:backdrop-blur-sm flex md:items-center md:justify-center md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full h-full md:h-auto md:max-w-3xl md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="px-4 md:px-5 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] flex items-center justify-between shrink-0"
             style={{ background: 'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%)' }}>
          <div>
            <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Body Condition Score</h2>
            <p className="text-[10px] text-white/75 font-semibold uppercase mt-0.5">{animalName} · saved as today's reading</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 md:p-1.5 rounded-full" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 md:flex-none overflow-y-auto p-4 md:p-5">
          {value != null && value <= 2 && (
            <button type="button" onClick={() => setShowRisks(true)}
              className="w-full mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-left">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span className="flex-1 text-[12px] font-bold text-red-700">Current score is low — see the health risks</span>
              <span className="text-[11px] font-black text-red-600 uppercase">View</span>
            </button>
          )}
          {/* Phone: one row per score. Desktop: five tiles side by side like the chart. */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 md:gap-3">
            {BCS_LEVELS.map(l => {
              const selected = value === l.score;
              return (
                <button key={l.score} type="button" onClick={() => onSelect(l.score)}
                  className={`flex md:flex-col items-center gap-3 md:gap-2 p-2.5 md:p-3 rounded-xl text-left md:text-center border transition-all ${
                    selected ? `${l.bg} border-transparent ring-2 ring-brand` : 'bg-white border-border-custom hover:bg-surface'}`}>
                  <img src={`/bcs/bcs-${l.score}.jpg`} alt="" className={`w-16 h-16 md:w-full md:h-auto md:aspect-square rounded-lg object-cover shrink-0 ${l.frame}`} />
                  <div className="min-w-0">
                    <div className={`text-[13px] font-black ${l.text}`}>{l.score} · {l.label}</div>
                    <div className="text-[11px] text-text3 leading-snug mt-0.5">{l.tip}</div>
                    {l.score <= 2 && (
                      <span role="button" tabIndex={0}
                        onClick={e => { e.stopPropagation(); setShowRisks(true); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setShowRisks(true); } }}
                        className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 text-[10px] font-black uppercase hover:bg-red-100">
                        <AlertTriangle size={11} /> Health risks
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 md:px-5 py-3 border-t border-border-custom flex justify-between items-center shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {scoredToday
            ? <button onClick={() => onSelect(null)} className="text-[12px] font-bold text-text3 hover:text-red-600">Remove today&apos;s score</button>
            : <span />}
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-[12px] uppercase">Close</button>
        </div>
      </div>
      {showRisks && <LowBcsRiskModal onClose={() => setShowRisks(false)} />}
    </div>
  );
}

/* ─── Trend card for the animal's page ─── */
export interface BcsReading { id: number; eventDate: string; quantity?: number | null }

const ddmmyyyy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Latest score, the readings over time (oldest → newest) and a warning when the score drops a point or more. */
export function BcsTrendCard({ animalName, readings, canEdit, onScore }: {
  animalName: string; readings: BcsReading[]; canEdit: boolean; onScore: (bcs: number | null) => Promise<void> | void;
}) {
  const [picking, setPicking] = useState(false);
  const [showRisks, setShowRisks] = useState(false);
  const list = readings.filter(r => r.quantity != null)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id - b.id);
  const latest = list[list.length - 1];
  const prev = list[list.length - 2];
  const lvl = bcsLevel(latest?.quantity);
  const drop = latest && prev ? prev.quantity! - latest.quantity! : 0;
  const recent = list.slice(-8);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 md:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Body Condition (BCS)</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{list.length} reading{list.length === 1 ? '' : 's'} recorded</p>
        </div>
        {canEdit && (
          <button onClick={() => setPicking(true)}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-700 shadow-sm">
            Score now
          </button>
        )}
      </div>

      {!latest ? (
        <div className="px-4 md:px-5 py-6 text-center text-[12px] text-slate-400">No BCS recorded yet.</div>
      ) : (
        <div className="p-4 md:p-5 space-y-4">
          {/* Latest */}
          <div className="flex items-center gap-3">
            <img src={`/bcs/bcs-${latest.quantity}.jpg`} alt="" className={`w-16 h-16 rounded-lg object-cover shrink-0 ${lvl?.frame}`} />
            <div className="min-w-0">
              <div className={`text-[15px] font-black ${lvl?.text}`}>{latest.quantity} · {lvl?.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Scored {ddmmyyyy(latest.eventDate)}</div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{lvl?.tip}</div>
            </div>
          </div>

          {drop >= 1 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <TrendingDown size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[12px] text-red-700">
                <span className="font-bold">Dropped {drop} point{drop > 1 ? 's' : ''}</span> — from {prev.quantity} on {ddmmyyyy(prev.eventDate)} to {latest.quantity}. Check feed and health.
              </div>
              {latest.quantity! <= 2 && (
                <button onClick={() => setShowRisks(true)} className="text-[11px] font-black text-red-600 uppercase shrink-0">Risks</button>
              )}
            </div>
          )}

          {/* Trend, oldest → newest */}
          {recent.length > 1 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Trend{list.length > recent.length ? ` · last ${recent.length}` : ''}</div>
              <div className="flex items-start gap-1 overflow-x-auto pb-1">
                {recent.map((r, i) => {
                  const l = bcsLevel(r.quantity);
                  return (
                    <React.Fragment key={r.id}>
                      {i > 0 && <ArrowRight size={12} className="text-slate-300 shrink-0 mt-3" />}
                      <div className="flex flex-col items-center shrink-0 w-[58px]">
                        <span className={`w-9 h-9 rounded-md flex items-center justify-center text-[14px] font-black bg-white ${l?.frame} ${l?.text}`}>{r.quantity}</span>
                        <span className="text-[9px] text-slate-500 mt-1 whitespace-nowrap">{ddmmyyyy(r.eventDate).slice(0, 5)}-{r.eventDate.slice(2, 4)}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {picking && (
        <BcsPickerModal animalName={animalName} value={latest?.quantity}
          scoredToday={latest?.eventDate.slice(0, 10) === todayIso()}
          onSelect={async bcs => { setPicking(false); await onScore(bcs); }}
          onClose={() => setPicking(false)} />
      )}
      {showRisks && <LowBcsRiskModal onClose={() => setShowRisks(false)} />}
    </div>
  );
}

export { todayIso as bcsTodayIso };
