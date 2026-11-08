'use client';

import React from 'react';
import { EffReport, litres, rupees, shortDate, summarise, toneOf } from '@/lib/efficiency';
import { Card, Kpi, KpiRow, Note, PctBar, Sub, TableWrap, TD, TH } from './ui';

export default function MilkTargetTab({ report }: { report: EffReport }) {
  const s = summarise(report).milk;
  const { milkRate, milkPerDay } = report;
  const cows = report.cows.filter(c => c.milkTarget).sort((a, b) => b.milkTarget!.efficiency - a.milkTarget!.efficiency);
  const dry = report.cows.filter(c => c.animalStatus === 'DRY').map(c => c.name);
  const noTarget = report.cows.filter(c => !c.milkTarget && c.animalStatus !== 'DRY').map(c => c.name);

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Total milk per day" value={milkPerDay.last7Avg != null ? litres(milkPerDay.last7Avg, 1) : '—'}
          sub={milkPerDay.latestDate ? `last ${milkPerDay.days} days · ${shortDate(milkPerDay.latestDate)}: ${litres(milkPerDay.latestTotal ?? 0, 1)}` : 'no milk recorded'} />
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
        <Note>
          Avg = last 30 days. Target = the cow&apos;s milk potential. Milk lost = target − avg, at ₹{milkRate.toFixed(2)} a litre.
          {dry.length > 0 && ` Dry, left out: ${dry.join(', ')}.`}
          {noTarget.length > 0 && ` No target yet (needs breed and birth date): ${noTarget.join(', ')}.`}
        </Note>
      </Card>
    </div>
  );
}
