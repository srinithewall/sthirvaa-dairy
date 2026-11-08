'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EffCow, EffReport, litres, rupees, shortDate, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, Note, PctBar, Sub, TableWrap, TD, TH } from './ui';

function History({ cow, lactationDays }: { cow: EffCow; lactationDays: number }) {
  const target = cow.milkTarget?.targetPerDay ?? (cow.lactation?.estimate ? cow.lactation.estimate / lactationDays : null);
  return (
    <div className="bg-surface2 rounded-lg px-3 py-2.5 space-y-1.5">
      <div className="text-[11px] font-bold text-text3 uppercase tracking-wider">{cow.name} · every lactation</div>
      {cow.history.length === 0 && <div className="text-[12px] text-text3">No calving recorded.</div>}
      {cow.history.map(h => (
        <div key={h.number} className="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1.4fr)] sm:grid-cols-[110px_190px_minmax(0,1fr)] gap-2 items-center text-[12px]">
          <span className="font-bold text-text">Lactation {h.number}</span>
          <span className="text-text2">{shortDate(h.from, true)} – {h.to ? shortDate(h.to, true) : 'now'}</span>
          {h.recordedDays === 0
            ? <span className="text-text3">no milk records</span>
            : <span className="text-text2">{litres(h.litres)} in {h.recordedDays} recorded days
                {target ? <span className="text-text3"> · {(h.litres / h.recordedDays).toFixed(1)} L a day vs {target} L</span> : null}</span>}
        </div>
      ))}
    </div>
  );
}

export default function LactationTab({ report }: { report: EffReport }) {
  const s = summarise(report).lactation;
  const { milkRate, rules } = report;
  const [open, setOpen] = useState<number | null>(null);
  const cows = report.cows.filter(c => c.lactation).sort((a, b) => (b.lactation!.achieved ?? -1) - (a.lactation!.achieved ?? -1));
  const partly = cows.filter(c => c.lactation!.partlyRecorded).map(c => c.name);

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Total potential" value={litres(s.estimate)} sub={`${s.cows} cows × ${rules.lactationDays}-day estimate`} />
        <Kpi label="On course for" value={litres(s.projected)} sub={`projected to day ${rules.lactationDays}`} />
        <Kpi label="Achieving" value={s.pct != null ? `${Math.round(s.pct)}%` : '—'} sub="of total potential" tone={s.pct != null ? toneOf(s.pct) : undefined} />
        <Kpi label="Shortfall" value={litres(s.shortfall)} sub={rupees(s.shortfall * milkRate)} />
      </KpiRow>

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>Cow · lactation</th><th className={TH}>Days in milk</th><th className={TH}>Milk recorded</th>
              <th className={`${TH} w-[26%]`}>Achieved so far</th><th className={`${TH} text-right`}>Projected {rules.lactationDays} d</th>
            </tr>
          </thead>
          <tbody>
            {cows.map(c => {
              const l = c.lactation!;
              const isOpen = open === c.id;
              return (
                <React.Fragment key={c.id}>
                  <tr className="cursor-pointer hover:bg-surface2" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                    <td className={TD}>
                      <div className="font-bold text-text flex items-center gap-1">
                        <ChevronDown size={14} className={`text-text3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />{c.name}
                      </div>
                      <Sub>lactation {c.history.length || '—'}{l.ended ? ' · dry now' : ''}</Sub>
                    </td>
                    <td className={TD}>{l.ended ? 'ended' : `${c.dim} of ${rules.lactationDays}`}
                      <Sub>{l.recordedDays} days recorded{l.partlyRecorded ? ' · part' : ''}</Sub></td>
                    <td className={TD}>{litres(l.recordedLitres)}{l.recordedTarget != null && <Sub>target {litres(l.recordedTarget)}</Sub>}</td>
                    <td className={TD}>{l.achieved != null ? <PctBar pct={l.achieved} /> : <span className="text-text3">no target</span>}</td>
                    <td className={`${TD} text-right`}>{l.ended ? '≈ ' : ''}{litres(l.projected)}
                      {l.estimate != null && <Sub>of {litres(l.estimate)} · {Math.round(l.projectedPct!)}%</Sub>}</td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={5} className="px-3 py-2 border-b border-border-custom"><History cow={c} lactationDays={rules.lactationDays} /></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </TableWrap>
        <Note>
          Tap a cow to see every lactation. Estimate = target litres a day × {rules.lactationDays}. Achieved = milk recorded since calving ÷ (target × days recorded).
          Projected = milk recorded, plus unrecorded days at her recorded average, plus the days left at her 30-day average.
          {partly.length > 0 && ` Part-recorded (milk recording started after calving): ${partly.join(', ')}.`}
        </Note>
      </Card>
    </div>
  );
}
