'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, ExternalLink, Info, Dna, Lightbulb, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
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
  aiOutcome?: 'CONCEIVED' | 'NOT_CONCEIVED' | 'REPEATED' | 'AWAITING_PD' | 'UNKNOWN';
  sire?: SireBull;
  dam?: { name: string; breed?: string; exoticPct?: number; lactationStart?: string; daysRecorded: number;
          avgDailyL?: number; peakDailyL?: number; targetL?: number; bcs?: number; imageUrl?: string };
  farm?: { avgDailyL: number; cowsCompared: number; windowDays: number; targetL?: number };
  prediction?: { avgDailyL: number; peakDailyL: number; lowL: number; highL: number; lactation305L: number;
    damEffectL: number; sireEffectL: number; breedEffectL: number; sireMeritPct?: number; pedigreeKg?: number;
    breedMeanKg?: number; geneticCeilingL?: number; daughterExoticPct?: number; damFromRecords: boolean;
    heritability: number; expectedCalving?: string; firstMilkFrom?: string;
    /** Same genetics with the herd and the dam at their target capacity (ideal weight, BCS 3–3.5). */
    best?: { avgDailyL: number; peakDailyL: number; lowL: number; highL: number; lactation305L: number;
             damEffectL: number; sireEffectL: number; breedEffectL: number } };
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
export function SireDatalist() {
  const [sires, setSires] = useState<SireBull[]>([]);
  useEffect(() => { loadSires().then(setSires); }, []);
  return (
    <datalist id="sire-bulls">
      {sires.map(s => <option key={s.bullNo} value={s.bullNo}>{[s.bullName, s.breed, s.starValue].filter(Boolean).join(' · ')}</option>)}
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

const SECTIONS = ['parents', 'pedigree', 'daughter', 'breakdown', 'compare', 'history'] as const;
type SectionKey = typeof SECTIONS[number];

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
  // Facts open, estimate workings folded away until asked for.
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(
    { parents: true, pedigree: true, daughter: true, breakdown: false, compare: false, history: false });
  const toggle = (k: SectionKey) => setOpen(o => ({ ...o, [k]: !o[k] }));

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get(`/herds/${herdId}/sire-analysis`, { params: preview ? { bull: preview } : {} })
      .then(r => { if (live) { setData(r.data); setFailed(false); } })
      .catch(() => { if (live) { setData(null); setFailed(true); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [herdId, refreshKey, preview]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-5 pt-4">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><Sparkles size={14} className="text-emerald-700" /></div>
        <span className="text-[12px] font-bold text-[#064e3b] uppercase tracking-wide">Sire analysis</span>
        <span className="text-[11px] font-semibold text-slate-400 truncate">
          {preview ? '· preview, no AI recorded with this bull'
            : data?.aiDate ? `· from the AI on ${fmtDate(data.aiDate)}` : '· bull pedigree + this cow + your farm’s milk records'}
        </span>
      </div>
      {preview && onClearPreview && (
        <button type="button" onClick={onClearPreview}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold hover:bg-amber-200">
          <X size={12} /> Back to the AI bull
        </button>
      )}
    </div>
  );

  if (loading && !data) {
    return (
      <div className="rounded-3xl overflow-hidden border border-emerald-100 shadow-sm bg-white">
        {header}
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-[12px] font-bold">
          <div className="w-6 h-6 border-[3px] border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /> Analysing pedigree…
        </div>
      </div>
    );
  }

  if (!data || !data.matched || !data.sire || !data.prediction) {
    return (
      <div className="rounded-3xl overflow-hidden border border-emerald-100 shadow-sm bg-white">
        {header}
        <div className="p-6 text-center">
          <Dna size={36} className="mx-auto text-slate-300 mb-2" />
          {failed ? (
            <p className="text-[13px] font-bold text-rose-600">
              Couldn’t load the sire analysis.
              <span className="block text-[12px] font-semibold text-slate-400 mt-1">The server may be running an older version without this feature. Restart the backend and reopen this tab.</span>
            </p>
          ) : data?.bullRef ? (
            <p className="text-[13px] font-bold text-slate-600">
              Bull <span className="font-mono text-slate-800">{data.bullRef}</span> is not in the sire catalogue.
              <span className="block text-[12px] font-semibold text-slate-400 mt-1">Check the Bull ID on the AI record (e.g. HF-40421) or use Analyse at the top to try a bull.</span>
            </p>
          ) : (
            <p className="text-[13px] font-bold text-slate-600">
              No AI with a Bull ID yet.
              <span className="block text-[12px] font-semibold text-slate-400 mt-1">Record the AI with its Bull ID, or use Analyse at the top to see what a daughter could give.</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  const { sire, dam, farm, prediction: p, farmRecord, insights = [], compare } = data;
  const name = sire.bullName ? title(sire.bullName) : sire.bullNo;
  const outcome = data.aiOutcome ? OUTCOME[data.aiOutcome] : null;
  const b = p.best;
  const allNotes = [
    ...insights,
    ...(farmRecord && farmRecord.ais > 0 ? [
      `On this farm ${name} has been used ${farmRecord.ais}× (${farmRecord.cows.join(', ')}): ${farmRecord.conceived} confirmed pregnant, ${farmRecord.notConceived} not conceived`
      + `${farmRecord.ais - farmRecord.conceived - farmRecord.notConceived > 0 ? `, ${farmRecord.ais - farmRecord.conceived - farmRecord.notConceived} awaiting PD` : ''}.`,
    ] : []),
  ];
  const allOpen = SECTIONS.every(s => open[s]);
  const th = 'py-2 px-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400';
  const td = 'py-2 px-3 text-[12px] font-semibold text-slate-700';
  const num = 'py-2 px-3 text-right text-[13px] font-black';

  return (
    <article className={`bg-white rounded-2xl border border-slate-200 shadow-sm transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {/* ─── Report title ─── */}
      <header className="px-5 md:px-7 pt-5 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Sire analysis report</div>
            <h2 className="text-[22px] md:text-[26px] font-black text-slate-900 leading-tight mt-1">{dam?.name} × {name}</h2>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">
              {data.preview ? 'Preview — no AI recorded with this bull' : data.aiDate ? `AI on ${fmtDate(data.aiDate)}` : 'No AI date'}
              {outcome && !data.preview ? ` · ${outcome.label}` : ''}
              {' · '}{sire.bullNo}, {sire.station ?? 'semen station'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.preview && onClearPreview && (
              <button type="button" onClick={onClearPreview}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold hover:bg-amber-200">
                <X size={12} /> Back to the AI bull
              </button>
            )}
            <button type="button" onClick={() => setShowInsights(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#064e3b] text-white text-[11px] font-bold uppercase tracking-wide hover:bg-[#064e3b]/90">
              <Lightbulb size={13} /> Insights <span className="ml-0.5 px-1.5 rounded-full bg-white/20 text-[10px]">{allNotes.length}</span>
            </button>
            <button type="button" onClick={() => setOpen(Object.fromEntries(SECTIONS.map(s => [s, !allOpen])) as Record<SectionKey, boolean>)}
              className="flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-50">
              {allOpen ? <><ChevronsDownUp size={13} /> Collapse all</> : <><ChevronsUpDown size={13} /> Expand all</>}
            </button>
          </div>
        </div>
      </header>

      <div className="divide-y divide-slate-100">
        {/* ─── 1. Parents ─── */}
        <Section n={1} title="Parents" open={open.parents} onToggle={() => toggle('parents')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                role: 'Sire (bull)', heading: name, sub: `${sire.bullNo} · ${sire.breed ?? ''}${sire.dateOfBirth ? ` · born ${fmtDate(sire.dateOfBirth)}` : ''}`,
                photo: sire.imageUrl, badge: sire.starValue,
                rows: [
                  ['Mother’s best lactation', kg(sire.damBestYieldKg)],
                  ['Avg milk / day (that lactation)', sire.damBestYieldKg != null ? L(sire.damBestYieldKg / 305 / 1.03) : '—'],
                  ['Mother’s fat', sire.damFatPct != null ? `${sire.damFatPct}%` : '—'],
                  ['Sire’s mother', kg(sire.sireDamBestYieldKg)],
                ],
                link: sire.sourceUrl,
              },
              {
                role: 'Dam (this cow)', heading: dam?.name ?? '', sub: `${dam?.breed || 'Breed not set'}${dam?.exoticPct != null ? ` · ${Math.round(dam.exoticPct)}% exotic` : ''}${dam?.bcs != null ? ` · BCS ${dam.bcs}` : ''}`,
                photo: dam?.imageUrl ? formatImageUrl(dam.imageUrl) || undefined : undefined, badge: undefined,
                rows: [
                  ['Projected lactation', lact(dam?.avgDailyL)],
                  ['Avg milk / day', L(dam?.avgDailyL)],
                  ['Peak (7-day)', L(dam?.peakDailyL)],
                  ['Target / day (BCS 3–3.5)', L(dam?.targetL)],
                ],
                link: undefined,
              },
            ].map(c => (
              <div key={c.role} className="flex gap-4 rounded-xl border border-slate-200 p-3">
                <BullPhoto src={c.photo} alt={c.heading} className="w-28 md:w-32 h-36 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.role}</span>
                    {c.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAR_STYLE[c.badge] ?? 'bg-slate-100 text-slate-700'}`}>{c.badge}</span>}
                  </div>
                  <h3 className="text-[19px] font-black text-slate-900 leading-tight truncate">{c.heading}</h3>
                  <p className="text-[11px] font-semibold text-slate-500 truncate">{c.sub}</p>
                  <dl className="mt-2 divide-y divide-slate-100">
                    {c.rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 py-1">
                        <dt className="text-[11px] font-semibold text-slate-500">{k}</dt>
                        <dd className="text-[12px] font-black text-slate-800 whitespace-nowrap">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 hover:underline">
                      Station record <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-2">{dam?.name}: {dam?.daysRecorded ?? 0} days of milk records since {fmtDate(dam?.lactationStart)}.</p>
        </Section>

        {/* ─── 2. Pedigree ─── */}
        <Section n={2} title={`${name}’s pedigree`} open={open.pedigree} onToggle={() => toggle('pedigree')}>
          <table className="w-full">
            <thead className="border-b border-slate-200"><tr><th className={th}>Relation</th><th className={th}>Animal</th><th className={`${th} text-right`}>Best lactation</th><th className={`${th} text-right`}>Fat</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className={td}>Mother</td><td className={td}>{sire.damName || '—'} <span className="text-slate-400">{sire.damNo}</span></td><td className={`${num} text-slate-800`}>{kg(sire.damBestYieldKg)}</td><td className={`${num} text-slate-800`}>{sire.damFatPct != null ? `${sire.damFatPct}%` : '—'}</td></tr>
              <tr><td className={td}>Father</td><td className={td}>{sire.sireName || '—'} <span className="text-slate-400">{sire.sireNo}</span></td><td className={`${num} text-slate-400`}>—</td><td className={`${num} text-slate-400`}>—</td></tr>
              <tr><td className={td}>Father’s mother</td><td className={td}>—</td><td className={`${num} text-slate-800`}>{kg(sire.sireDamBestYieldKg)}</td><td className={`${num} text-slate-400`}>—</td></tr>
            </tbody>
          </table>
          {p.sireMeritPct != null && (
            <p className="text-[12px] font-semibold text-slate-600 mt-3">
              Pedigree {kg(p.pedigreeKg)} against the {sire.breed} catalogue average of {kg(p.breedMeanKg)}:{' '}
              <b className={p.sireMeritPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{p.sireMeritPct >= 0 ? '+' : ''}{p.sireMeritPct.toFixed(0)}%</b>.
            </p>
          )}
        </Section>

        {/* ─── 3. Expected daughter ─── */}
        <Section n={3} title="Expected daughter" open={open.daughter} onToggle={() => toggle('daughter')}>
          <table className="w-full">
            <thead className="border-b border-slate-200">
              <tr><th className={th}></th><th className={`${th} text-right`}>Average · today’s care</th>{b && <th className={`${th} text-right text-amber-600`}>Best case · BCS 3–3.5</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Avg milk / day', L(p.avgDailyL), b ? L(b.avgDailyL) : null, true],
                ['Projected lactation (305 days)', `${Math.round(p.lactation305L).toLocaleString('en-IN')} L`, b ? `${Math.round(b.lactation305L).toLocaleString('en-IN')} L` : null, true],
                ['Peak yield', L(p.peakDailyL), b ? L(b.peakDailyL) : null, false],
                ['Likely range / day', `${L(p.lowL)} – ${L(p.highL)}`, b ? `${L(b.lowL)} – ${L(b.highL)}` : null, false],
                ['Herd level used', `${L(farm?.avgDailyL)} (last ${farm?.windowDays ?? 30} days)`, b ? `${L(farm?.targetL)} (at target)` : null, false],
              ].map(([k, a, bc, strong]) => (
                <tr key={k as string}>
                  <td className={td}>{k}</td>
                  <td className={`${num} ${strong ? 'text-[#064e3b] text-[16px]' : 'text-slate-800'}`}>{a}</td>
                  {b && <td className={`${num} ${strong ? 'text-amber-700 text-[16px]' : 'text-slate-800'}`}>{bc}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[12px] font-semibold text-slate-600">
            {p.daughterExoticPct != null && <span>Exotic blood: <b className="text-slate-900">{Math.round(p.daughterExoticPct)}%</b></span>}
            {p.expectedCalving && <span>Calving due: <b className="text-slate-900">{fmtDate(p.expectedCalving)}</b></span>}
            {p.firstMilkFrom && <span>Her first milk: <b className="text-slate-900">~{fmtDate(p.firstMilkFrom)}</b></span>}
          </div>
        </Section>

        {/* ─── 4. How the estimate adds up ─── */}
        <Section n={4} title="How the estimate adds up" open={open.breakdown} onToggle={() => toggle('breakdown')}
          summary={`${L(farm?.avgDailyL)} herd ${signed(p.damEffectL)} ${dam?.name} ${signed(p.sireEffectL)} ${name} = ${L(p.avgDailyL)}`}>
          {(() => {
            const rows = [
              { label: 'Herd level', note: b ? 'today · all cows at target weight' : `${farm?.cowsCompared ?? 0} cows, ${farm?.windowDays ?? 30} days`, v: farm?.avgDailyL ?? 0, bv: farm?.targetL, base: true },
              { label: `${dam?.name}’s share`, note: p.damFromRecords ? 'her yield vs the herd · ½ × 30%' : 'too few records', v: p.damEffectL, bv: b?.damEffectL, base: false },
              { label: `${name}’s share`, note: `${p.sireMeritPct != null ? `pedigree ${p.sireMeritPct >= 0 ? '+' : ''}${p.sireMeritPct.toFixed(0)}% · ` : ''}½ × 30%`, v: p.sireEffectL, bv: b?.sireEffectL, base: false },
              ...(p.breedEffectL ? [{ label: 'Breed change', note: '', v: p.breedEffectL, bv: b?.breedEffectL, base: false }] : []),
            ];
            const cell = (v: number | undefined, base: boolean) => v == null ? <span className="text-slate-300">—</span>
              : <span className={base ? 'text-slate-800' : v >= 0 ? 'text-emerald-700' : 'text-rose-600'}>{base ? L(v) : signed(v)}</span>;
            return (
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr><th className={th}></th><th className={`${th} text-right`}>Average</th>{b && <th className={`${th} text-right text-amber-600`}>Best case</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => (
                    <tr key={r.label}>
                      <td className={td}>{r.label}<div className="text-[10px] font-semibold text-slate-400">{r.note}</div></td>
                      <td className={num}>{cell(r.v, r.base)}</td>
                      {b && <td className={num}>{cell(r.bv, r.base)}</td>}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td className={`${td} font-black text-slate-900`}>Expected daughter</td>
                    <td className={`${num} text-[#064e3b]`}>{L(p.avgDailyL)}/day</td>
                    {b && <td className={`${num} text-amber-700`}>{L(b.avgDailyL)}/day</td>}
                  </tr>
                </tbody>
              </table>
            );
          })()}
          <p className="text-[11px] font-semibold text-slate-400 mt-3 flex gap-1.5">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            A calf takes half her genes from each parent, and about {Math.round(p.heritability * 100)}% of milk-yield differences are inherited; feed, weight and care decide the rest. {name}’s mother’s {kg(sire.damBestYieldKg)} is a top cow’s record on an elite farm, not what his daughters give here.
          </p>
        </Section>

        {/* ─── 5. Compared with a 1★ bull ─── */}
        {compare && (
          <Section n={5} title={`${name} vs an average 1★ bull`} open={open.compare} onToggle={() => toggle('compare')}
            summary={`${signed(compare.today.extraDailyL)}/day today${compare.best ? `, ${signed(compare.best.extraDailyL)}/day best case` : ''}`}>
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr><th className={th}></th><th className={`${th} text-right`}>Today’s care</th>{compare.best && <th className={`${th} text-right text-amber-600`}>Best case</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  [`${name}’s daughter / day`, (r: CompareRow) => L(r.thisBullDailyL), false],
                  ['1★ bull’s daughter / day', (r: CompareRow) => L(r.refDailyL), false],
                  ['Extra per day', (r: CompareRow) => signed(r.extraDailyL), true],
                  ['Extra per lactation (305 days)', (r: CompareRow) => litres(r.extraLactationL), true],
                  [`Extra over ${compare.lifetimeLactations} lactations`, (r: CompareRow) => litres(r.extraLifetimeL), true],
                ] as [string, (r: CompareRow) => string, boolean][]).map(([k, f, gain]) => (
                  <tr key={k}>
                    <td className={td}>{k}</td>
                    <td className={`${num} ${gain ? (compare.today.extraDailyL >= 0 ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-800'}`}>{f(compare.today)}</td>
                    {compare.best && <td className={`${num} ${gain ? (compare.best.extraDailyL >= 0 ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-800'}`}>{f(compare.best)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] font-semibold text-slate-400 mt-3">
              Same cow, same farm, only the bull changed. 1★ reference: average of {compare.refBulls} 1★ {compare.refBreed} bulls in the catalogue (pedigree {kg(compare.refPedigreeKg)}). The gap grows as feeding improves.
            </p>
          </Section>
        )}

        {/* ─── 6. AI history ─── */}
        {data.aiHistory.length > 0 && (
          <Section n={compare ? 6 : 5} title="AI history" open={open.history} onToggle={() => toggle('history')}
            summary={`${data.aiHistory.length} AI record${data.aiHistory.length > 1 ? 's' : ''}`}>
            <table className="w-full">
              <thead className="border-b border-slate-200"><tr><th className={th}>Date</th><th className={th}>Bull</th><th className={`${th} text-right`}>Result</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.aiHistory.map(h => (
                  <tr key={h.eventId}>
                    <td className={td}>{fmtDate(h.date)}</td>
                    <td className={td}>
                      <button type="button" disabled={!h.bullNo} onClick={() => { if (h.bullNo) onPreview?.(h.bullNo); }}
                        className={`text-left font-bold ${h.bullNo ? 'text-[#064e3b] hover:underline' : 'text-slate-400'}`}>
                        {h.bullNo ? `${h.bullNo}${h.bullName ? ` · ${title(h.bullName)}` : ''}` : h.bullRef ? `${h.bullRef} (not in catalogue)` : 'No Bull ID recorded'}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(OUTCOME[h.outcome] ?? OUTCOME.UNKNOWN).cls}`}>{(OUTCOME[h.outcome] ?? OUTCOME.UNKNOWN).label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>

      {/* ─── Insights panel ─── */}
      {showInsights && (
        <div className="fixed inset-0 z-[2500] bg-black/40 backdrop-blur-sm flex justify-end" onClick={() => setShowInsights(false)}>
          <aside className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Insights</div>
                <h3 className="text-[17px] font-black text-slate-900">{dam?.name} × {name}</h3>
              </div>
              <button type="button" onClick={() => setShowInsights(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"><X size={16} /></button>
            </div>
            <ol className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {allNotes.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                  <p className="text-[13px] font-semibold text-slate-700 leading-relaxed">{t}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </article>
  );
}

/* ─── Report section: numbered heading, collapsible ─────────── */
function Section({ n, title: heading, open, onToggle, summary, children }: {
  n: number; title: string; open: boolean; onToggle: () => void; summary?: string; children: React.ReactNode;
}) {
  return (
    <section className="px-5 md:px-7 py-4">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 text-left group">
        <span className="text-[12px] font-black text-emerald-700 w-5">{n}.</span>
        <h4 className="text-[14px] font-black text-slate-900 flex-1">{heading}</h4>
        {!open && summary && <span className="hidden sm:inline text-[11px] font-semibold text-slate-400 truncate max-w-[55%]">{summary}</span>}
        <ChevronDown size={16} className={`text-slate-400 group-hover:text-slate-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-3 pl-8">{children}</div>}
    </section>
  );
}
