'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EffCow, EffReport, litres, rupees, shortDate, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, PctBar, Sub, TableWrap, TD, TH } from './ui';

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
  const cows = report.cows.filter(c => c.lactation)
    .sort((a, b) => (b.lactation!.possible?.efficiency ?? -1) - (a.lactation!.possible?.efficiency ?? -1));

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Possible for the herd" value={litres(s.possible)} sub={`${s.possibleCows} cows · by breed and lactation`} />
        <Kpi label="On course for" value={litres(s.possibleProjected)} sub={`projected to day ${rules.lactationDays}`} />
        <Kpi label="Farm efficiency score" value={s.farmScore != null ? `${Math.round(s.farmScore)}%` : '—'}
          sub="on course ÷ possible" tone={s.farmScore != null ? toneOf(s.farmScore) : undefined} />
        <Kpi label="Shortfall" value={litres(s.possibleShortfall)} sub={rupees(s.possibleShortfall * milkRate)} />
      </KpiRow>

      <Card>
        <TableWrap wide>
          <thead>
            <tr>
              <th className={TH}>Cow · lactation</th><th className={TH}>Days in milk</th><th className={TH}>Milk recorded</th>
              <th className={`${TH} w-[15%]`}>Achieved so far</th><th className={`${TH} text-right`}>Projected {rules.lactationDays} d</th>
              <th className={`${TH} text-right`}>Possible for breed</th>
              <th className={`${TH} w-[15%]`}>Efficiency</th>
              <th className={`${TH} text-right`}>Per day · full cycle</th>
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
                      <Sub>lactation {c.lactationNumber || '—'}{l.ended ? ' · dry now' : ''}</Sub>
                    </td>
                    <td className={TD}>{l.ended ? 'ended' : `${c.dim} of ${rules.lactationDays}`}
                      <Sub>{l.recordedDays} days recorded{l.partlyRecorded ? ' · part' : ''}</Sub></td>
                    <td className={TD}>{litres(l.recordedLitres)}{l.recordedTarget != null && <Sub>target {litres(l.recordedTarget)}</Sub>}</td>
                    <td className={TD}>{l.achieved != null ? <PctBar pct={l.achieved} /> : <span className="text-text3">no target</span>}</td>
                    <td className={`${TD} text-right`}>{l.ended ? '≈ ' : ''}{litres(l.projected)}</td>
                    <td className={`${TD} text-right`}>
                      {l.possible ? litres(l.possible.litres) : '—'}
                      {l.possible && <Sub>{c.breed || 'breed not set'} · {l.possible.normalPerDay} L/day{l.possible.factor !== 1 ? ` · ×${l.possible.factor}` : ''}</Sub>}
                    </td>
                    <td className={TD}>{l.possible?.efficiency != null ? <PctBar pct={l.possible.efficiency} /> : <span className="text-text3">—</span>}</td>
                    <td className={`${TD} text-right`}>
                      {c.cycleAverage ? litres(c.cycleAverage.perDay, 1) : '—'}
                      {c.cycleAverage && <Sub>{c.cycleAverage.completedCycles > 0
                        ? `${c.cycleAverage.completedCycles} past cycle${c.cycleAverage.completedCycles > 1 ? 's' : ''} + this one`
                        : 'this cycle, projected'}</Sub>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={8} className="px-3 py-2 border-b border-border-custom"><History cow={c} lactationDays={rules.lactationDays} /></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
