'use client';

import React from 'react';
import { EffReport, litres, rupees, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, PctBar, Sub, TableWrap, TD, TH } from './ui';

export default function MilkTargetTab({ report }: { report: EffReport }) {
  const s = summarise(report).milk;
  const { milkRate, milkPerDay } = report;
  const cows = report.cows.filter(c => c.milkTarget).sort((a, b) => b.milkTarget!.efficiency - a.milkTarget!.efficiency);

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Milk per day · full cycle" value={litres(s.cyclePerDay, 1)}
          sub={`${s.cycleCows} cows, dry days included${milkPerDay.last7Avg != null ? ` · last ${milkPerDay.days} days ${litres(milkPerDay.last7Avg, 1)}` : ''}`} />
        <Kpi label="Herd efficiency" value={s.efficiency != null ? `${Math.round(s.efficiency)}%` : '—'}
          sub={`${litres(s.avg, 1)} of ${litres(s.target)} a day`} tone={s.efficiency != null ? toneOf(s.efficiency) : undefined} />
        <Kpi label="Avg lost per cow" value={`${litres(s.lostPerCowPerDay, 1)} / day`} sub={`${rupees(s.lostPerCowPerDay * 30 * milkRate)} a month`} />
        <Kpi label="Herd lost" value={rupees(s.lostPerDay * 30 * milkRate)} sub={`${litres(s.lostPerDay * 30)} a month`} tone={s.lostPerDay > 0 ? 'poor' : undefined} />
      </KpiRow>

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>Cow</th><th className={TH}>Avg / day</th><th className={TH}>Target</th>
              <th className={`${TH} w-[28%]`}>Efficiency</th><th className={`${TH} text-right`}>Milk lost</th>
            </tr>
          </thead>
          <tbody>
            {cows.map(c => {
              const m = c.milkTarget!;
              return (
                <tr key={c.id}>
                  <td className={TD}><div className="font-bold text-text">{c.name}</div>{c.dim != null && <Sub>day {c.dim} of lactation</Sub>}</td>
                  <td className={TD}>{litres(m.avgPerDay, 1)}</td>
                  <td className={TD}>{litres(m.targetPerDay)}</td>
                  <td className={TD}><PctBar pct={m.efficiency} /></td>
                  <td className={`${TD} text-right`}>{litres(m.lostPerDay, 1)} / day<Sub>{rupees(m.lostPerDay * 30 * milkRate)} / month</Sub></td>
                </tr>
              );
            })}
            {cows.length > 0 && (
              <tr className="font-black">
                <td className={TD}>Total</td><td className={TD}>{litres(s.avg, 1)}</td><td className={TD}>{litres(s.target)}</td>
                <td className={TD}>{s.efficiency != null && <PctBar pct={s.efficiency} />}</td>
                <td className={`${TD} text-right`}>{litres(s.lostPerDay, 1)} / day<Sub>{rupees(s.lostPerDay * 30 * milkRate)} / month</Sub></td>
              </tr>
            )}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
