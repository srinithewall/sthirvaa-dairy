'use client';

import React from 'react';
import { EffReport, EffCow, litres, rupees, shortDate, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, Note, PctBar, Sub, TableWrap, TD, TH } from './ui';

const stateLabel = (c: EffCow) => {
  const r = c.reproduction;
  if (r.state === 'CONFIRMED') return `Confirmed ${shortDate(r.pdDate)}`;
  if (r.state === 'INSEMINATED') return r.inseminations > 1 ? `AI no. ${r.inseminations} · not checked yet` : 'Not checked yet';
  return '';
};

/** Order: best first, then cows still in the rest period, then cows with no calving recorded. */
const rank = (c: EffCow) => c.reproduction.efficiency ?? (c.reproduction.state === 'WAITING' ? 101 : -1);

export default function ReproductionTab({ report }: { report: EffReport }) {
  const s = summarise(report).repro;
  const { rules, milkRate } = report;
  const cows = report.cows.filter(c => c.reproduction.state !== 'NO_CALVING').sort((a, b) => rank(b) - rank(a));
  const noCalving = report.cows.filter(c => c.reproduction.state === 'NO_CALVING');

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Calving efficiency" value={s.efficiency != null ? `${Math.round(s.efficiency)}%` : '—'}
          sub={s.cows ? `${Math.round(s.avgInterval)}-day avg interval` : 'no cows to score yet'}
          tone={s.efficiency != null ? toneOf(s.efficiency) : undefined} />
        <Kpi label="Avg days open" value={s.cows ? `${Math.round(s.avgDaysOpen)}` : '—'} sub={`target ${rules.targetDaysOpen} or less`} />
        <Kpi label="Milk lost to late calving" value={litres(s.milkLostPerCow)} sub={`per cow a year · ${rupees(s.milkLostPerCow * milkRate)}`} />
        <Kpi label="Whole herd" value={litres(s.milkLost)} sub={`${rupees(s.milkLost * milkRate)} a year · ${s.calvesMissed.toFixed(1)} calves missed`} />
      </KpiRow>

      <Card>
        <div className="px-3 pt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-text2">
          <span className="font-bold">Calving efficiency = {rules.calvingInterval} ÷ calving interval.</span>
          {[365, 400, 450, 500, 600].map(d => (
            <span key={d} className="text-text3">{d} d → {Math.round((100 * rules.calvingInterval) / d)}%</span>
          ))}
        </div>
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>Cow</th><th className={TH}>Pregnant from (AI)</th><th className={TH}>Interval</th>
              <th className={`${TH} w-[26%]`}>Calving efficiency</th><th className={`${TH} text-right`}>Milk lost / year</th>
            </tr>
          </thead>
          <tbody>
            {cows.map(c => {
              const r = c.reproduction;
              return (
                <tr key={c.id}>
                  <td className={TD}><div className="font-bold text-text">{c.name}</div><Sub>calved {shortDate(c.lastCalving, true)} · day {c.dim}</Sub></td>
                  {r.state === 'WAITING' ? (
                    <>
                      <td className={`${TD} text-text3`}>Not inseminated yet</td>
                      <td className={`${TD} text-text3`}>—</td>
                      <td className={TD}>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#EBF3FD] text-[#1d5fa8]">Can still reach 100%</span>
                        <Sub>pregnant by day {rules.targetDaysOpen} · {r.daysLeft} days left</Sub>
                      </td>
                      <td className={`${TD} text-right`}>0 L</td>
                    </>
                  ) : (
                    <>
                      <td className={TD}>
                        {r.state === 'OPEN'
                          ? <><div className="text-danger font-bold">Not inseminated</div><Sub>{r.daysOpen} days since calving</Sub></>
                          : <><div>{shortDate(r.aiDate)} · {r.daysOpen} days open</div><Sub>{stateLabel(c)}</Sub></>}
                      </td>
                      <td className={TD}>{r.calvingInterval} d<Sub>{r.state === 'OPEN' ? 'at best, rising daily' : `+${r.calvingInterval! - rules.calvingInterval} days`}</Sub></td>
                      <td className={TD}><PctBar pct={r.efficiency!} /></td>
                      <td className={`${TD} text-right`}>{litres(r.milkLostPerYear ?? 0)}<Sub>{rupees((r.milkLostPerYear ?? 0) * milkRate)}</Sub></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
        <Note>
          Days open = calving to the insemination that took. Interval = days open + {rules.gestationDays} days of pregnancy.
          Unconfirmed inseminations count as if they took. Milk lost = lactation yield × (1 − {rules.calvingInterval} ÷ interval).
          {noCalving.length > 0 && ` No calving recorded for ${noCalving.map(c => c.name).join(', ')}, so they aren't scored.`}
        </Note>
      </Card>
    </div>
  );
}
