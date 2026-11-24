'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, XCircle, Dna, Award, GitBranch, BarChart3, Syringe } from 'lucide-react';
import api, { formatImageUrl } from '@/lib/api';

/* ─── Types (mirror /api/herds/{id}/sire-analysis) ─────────── */
export interface SireBull {
  id: number; bullNo: string; bullName?: string; category?: string; breed?: string; starValue?: string;
  inaphId?: string; dateOfBirth?: string; damNo?: string; damName?: string; damBestYieldKg?: number;
  damFatPct?: number; sireNo?: string; sireName?: string; sireDamBestYieldKg?: number;
  sireDaughtersYieldKg?: number; breedingValue?: number; imageUrl?: string; sourceUrl?: string; station?: string;
}
interface Analysis {
  matched: boolean; preview: boolean; bullRef?: string; aiDate?: string;
  /** Set when the bull is of the other species (e.g. a BUFFALO bull for a cow). */
  wrongSpecies?: string;
  aiOutcome?: 'CONCEIVED' | 'NOT_CONCEIVED' | 'REPEATED' | 'AWAITING_PD' | 'UNKNOWN';
  sire?: SireBull;
  dam?: { name: string; breed?: string; exoticPct?: number; lactationStart?: string; daysRecorded: number;
          avgDailyL?: number; peakDailyL?: number; targetL?: number; bcs?: number; imageUrl?: string };
  farm?: { avgDailyL: number; cowsCompared: number; windowDays: number; targetL?: number };
  prediction?: { avgDailyL: number; peakDailyL: number; lowL: number; highL: number; lactation305L: number;
    damEffectL: number; sireEffectL: number; breedEffectL: number; heterosisL?: number; heterosisPct?: number; sireMeritPct?: number; pedigreeKg?: number;
    breedMeanKg?: number; geneticCeilingL?: number; daughterExoticPct?: number; damFromRecords: boolean;
    heritability: number; expectedCalving?: string; firstMilkFrom?: string;
    /** Same genetics with the herd and the dam at their target capacity (ideal weight, BCS 3–3.5). */
    best?: { avgDailyL: number; peakDailyL: number; lowL: number; highL: number; lactation305L: number;
             damEffectL: number; sireEffectL: number; breedEffectL: number; heterosisL?: number } };
  farmRecord?: { ais: number; conceived: number; notConceived: number; cows: string[] };
  /** This bull against the average 1-star bull of his breed. */
  compare?: { refBreed: string; refBulls: number; refPedigreeKg: number; lifetimeLactations: number; pricePerLitre?: number;
    today: CompareRow; best?: CompareRow } | null;
  insights?: string[];
  aiHistory: { eventId: number; date: string; bullRef?: string; bullNo?: string; bullName?: string; outcome: string }[];
}

interface CompareRow { thisBullDailyL: number; refDailyL: number; extraDailyL: number; extraLactationL: number;
  extraLifetimeL: number; extraLifetimeRs?: number }

/* ─── Shared catalogue fetch (one request per page load) ────── */
let siresPromise: Promise<SireBull[]> | null = null;
export const loadSires = () => {
  if (!siresPromise) siresPromise = api.get('/sires').then(r => r.data as SireBull[]).catch(() => { siresPromise = null; return []; });
  return siresPromise;
};

/** <datalist id="sire-bulls"> so every Bull ID box suggests catalogue bulls. */
export function SireDatalist({ animalType }: { animalType?: string }) {
  const [sires, setSires] = useState<SireBull[]>([]);
  useEffect(() => { loadSires().then(setSires); }, []);
  // A cow only gets cattle bulls, a buffalo only buffalo bulls.
  const category = animalType === 'BUFFALO' ? 'BUFFALO' : animalType === 'COW' ? 'CATTLE' : undefined;
  const shown = category ? sires.filter(s => !s.category || s.category === category) : sires;
  return (
    <datalist id="sire-bulls">
      {shown.map(s => <option key={s.bullNo} value={s.bullNo}>{[s.bullName, s.breed, s.starValue].filter(Boolean).join(' · ')}</option>)}
    </datalist>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */
const fmtDate = (d?: string) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const kg = (v?: number) => (v == null ? '—' : `${Math.round(v).toLocaleString('en-IN')} kg`);
const L = (v?: number) => (v == null ? '—' : `${v.toFixed(1)} L`);
const title = (s?: string) => (s ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '');
const lact = (perDay?: number) => (perDay == null ? '—' : `${Math.round(perDay * 305).toLocaleString('en-IN')} L`);
const litres = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('en-IN')} L`;
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} L`;

const STAR_STYLE: Record<string, string> = {
  Premium: 'bg-amber-400 text-amber-950', Imported: 'bg-violet-500 text-white',
  '5*': 'bg-emerald-500 text-white', '1*': 'bg-slate-200 text-slate-700',
};
const OUTCOME: Record<string, { label: string; cls: string }> = {
  CONCEIVED: { label: 'PD positive', cls: 'bg-emerald-100 text-emerald-800' },
  NOT_CONCEIVED: { label: 'PD negative', cls: 'bg-rose-100 text-rose-700' },
  REPEATED: { label: 'Repeated AI', cls: 'bg-orange-100 text-orange-700' },
  AWAITING_PD: { label: 'Awaiting PD', cls: 'bg-sky-100 text-sky-800' },
  UNKNOWN: { label: '—', cls: 'bg-slate-100 text-slate-500' },
};

function BullPhoto({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return (
    <div className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400`}>
      <Dna size={40} />
    </div>
  );
  return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => setBad(true)} referrerPolicy="no-referrer" />;
}

type ReportTab = 'pedigree' | 'breakdown' | 'compare' | 'history';
const REPORT_TABS: { key: ReportTab; label: string; icon: typeof Dna }[] = [
  { key: 'pedigree', label: 'Pedigree', icon: GitBranch },
  { key: 'breakdown', label: 'Breakdown', icon: BarChart3 },
  { key: 'compare', label: 'vs 1★ bull', icon: Award },
  { key: 'history', label: 'AI history', icon: Syringe },
];

/* ─── Main card ─────────────────────────────────────────────── */
export default function SireAnalysisCard({ herdId, refreshKey, preview = '', onPreview, onClearPreview }: {
  herdId: number; refreshKey: string;
  /** Bull to preview instead of the AI bull (set from the header's Analyse button). */
  preview?: string;
  onPreview?: (bullNo: string) => void;
  onClearPreview?: () => void;
}) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTab, setReportTab] = useState<ReportTab>('pedigree');

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get(`/herds/${herdId}/sire-analysis`, { params: preview ? { bull: preview } : {} })
      .then(r => { if (live) { setData(r.data); setFailed(false); } })
      .catch(() => { if (live) { setData(null); setFailed(true); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [herdId, refreshKey, preview]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center py-16">
        <div className="w-8 h-8 border-[3px] border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.matched || !data.sire || !data.prediction) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-12 flex flex-col items-center gap-2">
        <Dna size={36} className={failed ? 'text-rose-300' : 'text-slate-300'} />
        <p className={`text-[13px] font-bold ${failed ? 'text-rose-600' : 'text-slate-600'}`}>
          {failed ? 'Analysis unavailable — restart the backend'
            : data?.wrongSpecies ? `${data.bullRef} is a ${data.wrongSpecies.toLowerCase()} bull` : data?.bullRef ? `${data.bullRef} not in the catalogue` : 'No Bull ID on the AI record'}
        </p>
        {preview && onClearPreview && (
          <button type="button" onClick={onClearPreview} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold"><X size={12} /> AI bull</button>
        )}
      </div>
    );
  }

  const { sire, dam, farm, prediction: p, farmRecord, insights = [], compare } = data;
  const name = sire.bullName ? title(sire.bullName) : sire.bullNo;
  const b = p.best;
  const allNotes = [
    ...insights,
    ...(farmRecord && farmRecord.ais > 0 ? [
      `${name} on farm: ${farmRecord.ais} AI · ${farmRecord.conceived} pregnant · ${farmRecord.notConceived} open`,
    ] : []),
  ];
  const sireAvg = sire.damBestYieldKg != null ? sire.damBestYieldKg / 305 / 1.03 : undefined;

  return (
    <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {data.preview && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50">
          <span className="text-[12px] font-bold text-amber-800">Preview · {sire.bullNo} {name !== sire.bullNo ? name : ''}</span>
          {onClearPreview && <button type="button" onClick={onClearPreview} className="text-[10px] font-bold text-amber-800 hover:underline">Back to AI bull</button>}
        </div>
      )}

      {/* ─── Sire / Dam ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ParentPanel title="Sire" photo={sire.imageUrl} heading={name} sub={`${sire.bullNo} · ${sire.breed ?? ''}`}
          chip={sire.starValue ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAR_STYLE[sire.starValue] ?? 'bg-slate-100 text-slate-700'}`}>{sire.starValue}</span> : null}
          action={sire.sourceUrl ? <a href={sire.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-brand hover:underline">Station</a> : null}
          stats={[['Mother’s Lactation', kg(sire.damBestYieldKg)], ['Avg / Day', L(sireAvg)], ['Mother’s Fat', sire.damFatPct != null ? `${sire.damFatPct}%` : '—'], ['Born', sire.dateOfBirth ? fmtDate(sire.dateOfBirth) : '—']]}
          footer={['Pedigree vs breed', p.sireMeritPct != null ? `${p.sireMeritPct >= 0 ? '+' : ''}${p.sireMeritPct.toFixed(0)}%` : '—']} />
        <ParentPanel title="Dam" photo={dam?.imageUrl ? formatImageUrl(dam.imageUrl) || undefined : undefined} heading={dam?.name ?? ''}
          sub={`${dam?.breed || '—'}${dam?.bcs != null ? ` · BCS ${dam.bcs}` : ''}`}
          chip={null}
          action={null}
          stats={[['Lactation', lact(dam?.avgDailyL)], ['Avg / Day', L(dam?.avgDailyL)], ['Peak', L(dam?.peakDailyL)], ['Target / Day', L(dam?.targetL)]]}
          footer={['Milk Records', `${dam?.daysRecorded ?? 0} Days`]} />
      </div>

      {/* ─── Expected daughter ─── */}
      <Panel title="Expected Daughter" actions={<>
        <button type="button" onClick={() => setShowInsights(true)} className="text-[10px] font-bold text-brand hover:underline">Insights ({allNotes.length})</button>
        <button type="button" onClick={() => setReportOpen(true)} className="text-[10px] font-bold text-brand hover:underline">View Report</button>
      </>}>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {[['Average', p.avgDailyL, p.lactation305L, `${L(p.lowL)} – ${L(p.highL)}`, 'text-brand'],
              ...(b ? [['Best · BCS 3–3.5', b.avgDailyL, b.lactation305L, `${L(b.lowL)} – ${L(b.highL)}`, 'text-amber-600']] : [])]
              .map(([label, perDay, lacts, range, cls]) => (
              <div key={label as string} className="px-4 py-4 text-center">
                <div className="text-[10px] text-text3 font-semibold">{label}</div>
                <div className={`text-[26px] font-bold leading-tight mt-1 ${cls}`}>{(perDay as number).toFixed(1)}<span className="text-[12px] font-bold text-text3"> L/day</span></div>
                <div className="text-[12px] font-bold text-text mt-1">{Math.round(lacts as number).toLocaleString('en-IN')} L <span className="text-text3 font-semibold">lactation</span></div>
                <div className="text-[10px] font-semibold text-text3 mt-0.5">{range}</div>
              </div>
            ))}
          </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-brand/5">
          <FooterCell label="Exotic Blood" value={p.daughterExoticPct != null ? `${Math.round(p.daughterExoticPct)}%` : '—'} />
          <FooterCell label="Calving Due" value={p.expectedCalving ? fmtDate(p.expectedCalving) : '—'} />
        </div>
      </Panel>

      {/* ─── Report popup ─── */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2500] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setReportOpen(false)}>
          <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg,#2d6a4f,#1b4332)' }}>
              <div>
                <h3 className="text-[15px] font-bold text-white uppercase">Sire Report</h3>
                <p className="text-[10px] text-white/60 mt-0.5">{dam?.name} × {name} ({sire.bullNo})</p>
              </div>
              <button type="button" onClick={() => setReportOpen(false)} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"><XCircle size={20} /></button>
            </div>
            <div className="flex border-b border-slate-200 flex-shrink-0">
              {REPORT_TABS.filter(t => t.key !== 'compare' || compare).map(t => (
                <button key={t.key} type="button" onClick={() => setReportTab(t.key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-colors ${reportTab === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-4 sm:p-5 bg-slate-50 h-[420px] max-h-[65vh]">
              {reportTab === 'pedigree' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoPanel title="Father" heading={sire.sireName || '—'} sub={sire.sireNo}
                      stats={[['His Mother’s Lactation', kg(sire.sireDamBestYieldKg)], ...(sire.sireDaughtersYieldKg ? [['Daughters’ Yield', kg(sire.sireDaughtersYieldKg)] as [string, string]] : [])]} />
                    <InfoPanel title="Mother" heading={sire.damName || '—'} sub={sire.damNo}
                      stats={[]} />
                  </div>
                  <InfoPanel title="Pedigree Strength" stats={[[`${name}’s Pedigree`, kg(p.pedigreeKg)], [`${sire.breed} Average`, kg(p.breedMeanKg)]]} />
                </div>
              )}

              {reportTab === 'breakdown' && (
                <div className="space-y-4">
                  {[['Average · Today’s Care', farm?.avgDailyL, p.damEffectL, p.sireEffectL, p.breedEffectL, p.heterosisL ?? 0, p.avgDailyL],
                    ...(b ? [['Best Case · BCS 3–3.5', farm?.targetL, b.damEffectL, b.sireEffectL, b.breedEffectL, b.heterosisL ?? 0, b.avgDailyL]] : [])]
                    .map(([label, herd, damFx, sireFx, breedFx, hetFx, total]) => (
                    <Panel key={label as string} title={label as string}>
                      <div className={`grid ${(breedFx as number) ? ((hetFx as number) ? 'grid-cols-6' : 'grid-cols-5') : 'grid-cols-4'} divide-x divide-slate-100`}>
                        <Cell label="Herd" value={L(herd as number | undefined)} />
                        <Cell label={dam?.name ?? 'Dam'} value={signed(damFx as number)} tone={(damFx as number) >= 0 ? 'up' : 'down'} />
                        <Cell label={name} value={signed(sireFx as number)} tone={(sireFx as number) >= 0 ? 'up' : 'down'} />
                        {(breedFx as number) ? <Cell label="Breed" value={signed(breedFx as number)} tone={(breedFx as number) >= 0 ? 'up' : 'down'} /> : null}
                        {(hetFx as number) ? <Cell label="Hybrid vigour" value={signed(hetFx as number)} tone="up" /> : null}
                        <Cell label="Daughter" value={L(total as number)} tone="brand" />
                      </div>
                    </Panel>
                  ))}
                </div>
              )}

              {reportTab === 'compare' && compare && (
                <Panel title={`${name} vs 1★ Bull`}><CompareGrid compare={compare} name={name} /></Panel>
              )}

              {reportTab === 'history' && (
                <Panel title="AI History">
                  {data.aiHistory.length === 0
                    ? <div className="py-8 text-center text-[11px] font-semibold text-text3">No AI records</div>
                    : <div className="divide-y divide-slate-100">
                        {data.aiHistory.map(h => (
                          <div key={h.eventId} className="px-4 py-3 flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-brand" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-bold text-slate-800 truncate">{h.bullNo ? `${h.bullNo}${h.bullName ? ` · ${title(h.bullName)}` : ''}` : h.bullRef ?? 'No Bull ID'}</div>
                              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{fmtDate(h.date)}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(OUTCOME[h.outcome] ?? OUTCOME.UNKNOWN).cls}`}>{(OUTCOME[h.outcome] ?? OUTCOME.UNKNOWN).label}</span>
                            {h.bullNo && (
                              <button type="button" onClick={() => { onPreview?.(h.bullNo!); setReportOpen(false); }}
                                className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50">View</button>
                            )}
                          </div>
                        ))}
                      </div>}
                </Panel>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Insights popup ─── */}
      {showInsights && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2500] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowInsights(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg,#2d6a4f,#1b4332)' }}>
              <div>
                <h3 className="text-[15px] font-bold text-white uppercase">Insights</h3>
                <p className="text-[10px] text-white/60 mt-0.5">{dam?.name} × {name}</p>
              </div>
              <button type="button" onClick={() => setShowInsights(false)} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"><XCircle size={20} /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100">
              {allNotes.map((t, i) => (
                <div key={i} className="px-5 py-3 flex gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-brand mt-1" />
                  <p className="text-[12px] font-semibold text-slate-700 leading-snug">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── App-style building blocks (match Animal Information / Action Required) ─── */
function Panel({ title: heading, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-bold text-text uppercase tracking-wide truncate">{heading}</h3>
        {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' | 'brand' }) {
  const cls = tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-red-600' : tone === 'brand' ? 'text-brand' : 'text-text';
  return (
    <div className="px-3 py-2.5 text-center min-w-0">
      <div className="text-[10px] text-text3 font-semibold truncate">{label}</div>
      <div className={`text-[13px] font-bold mt-0.5 leading-tight ${cls}`}>{value}</div>
    </div>
  );
}

function FooterCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between">
      <span className="text-[11px] font-bold text-text3">{label}:</span>
      <span className="text-[13px] font-bold text-brand">{value}</span>
    </div>
  );
}

function ParentPanel({ title: heading, photo, heading: _h, sub, chip, action, stats, footer }: {
  title: string; photo?: string; heading: string; sub: string; chip: React.ReactNode; action: React.ReactNode;
  stats: [string, string][]; footer: [string, string];
}) {
  return (
    <Panel title={heading} actions={<>{chip}{action}</>}>
      <div className="flex">
        <div className="p-3 flex-shrink-0">
          <BullPhoto src={photo} alt={_h} className="w-28 h-28 rounded-xl" />
        </div>
        <div className="flex-1 min-w-0 py-3 pr-3">
          <div className="text-[15px] font-bold text-text truncate">{_h}</div>
          <div className="text-[11px] font-semibold text-text3 truncate">{sub}</div>
          <div className="grid grid-cols-2 mt-2 border border-slate-100 rounded-xl divide-x divide-y divide-slate-100 overflow-hidden">
            {stats.map(([label, value]) => <Cell key={label} label={label} value={value} />)}
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-brand/5"><FooterCell label={footer[0]} value={footer[1]} /></div>
    </Panel>
  );
}

function InfoPanel({ title: heading, heading: name, sub, stats }: { title: string; heading?: string; sub?: string; stats: [string, string][] }) {
  return (
    <Panel title={heading}>
      {name && (
        <div className="px-4 pt-3">
          <div className="text-[14px] font-bold text-text truncate">{name}</div>
          {sub && <div className="text-[10px] font-semibold text-text3 truncate">{sub}</div>}
        </div>
      )}
      {stats.length > 0 ? (
        <div className={`grid ${stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100 ${name ? 'mt-2 border-t border-slate-100' : ''}`}>
          {stats.map(([label, value]) => <Cell key={label} label={label} value={value} />)}
        </div>
      ) : <div className="pb-3" />}
    </Panel>
  );
}

function CompareGrid({ compare, name }: { compare: NonNullable<Analysis['compare']>; name: string }) {
  const rows = [['Today', compare.today], ...(compare.best ? [['Best Case', compare.best]] : [])] as [string, CompareRow][];
  return (
    <div className="divide-y divide-slate-100">
      {rows.map(([label, r]) => (
        <div key={label} className="grid grid-cols-5 divide-x divide-slate-100">
          <div className="px-3 py-2.5 flex items-center"><span className="text-[11px] font-bold text-text3 uppercase">{label}</span></div>
          <Cell label={`${name}’s daughter`} value={L(r.thisBullDailyL)} tone="brand" />
          <Cell label="1★ daughter" value={L(r.refDailyL)} />
          <Cell label="Extra / day" value={signed(r.extraDailyL)} tone={r.extraDailyL >= 0 ? 'up' : 'down'} />
          <Cell label={`${compare.lifetimeLactations} lactations`} value={litres(r.extraLifetimeL)} tone={r.extraLifetimeL >= 0 ? 'up' : 'down'} />
        </div>
      ))}
    </div>
  );
}
