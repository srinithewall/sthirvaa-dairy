'use client';

import React from 'react';
import { EffReport, EffCow, litres, rupees, shortDate, summarise, toneOf } from '@/lib/efficiency';
import { Card, fromToday, Kpi, KpiRow, Note, PctBar, Sub, TableWrap, TD, TH } from './ui';

const daysUntil = (iso: string, today: string) =>
  Math.round((new Date(iso).getTime() - new Date(today).getTime()) / 86400000);

/** Order: best first, then cows still in the rest period, then cows with no calving recorded. */
const rank = (c: EffCow) => c.reproduction.efficiency ?? (c.reproduction.state === 'WAITING' ? 101 : -1);

function Breeding({ c, today }: { c: EffCow; today: string }) {
  const r = c.reproduction;
  if (r.state === 'WAITING') {
    return <><div className="text-text2">Not inseminated yet</div><Sub>breed by {shortDate(r.breedBy)} · {r.daysLeft} days left</Sub></>;
  }
  if (r.state === 'OPEN' && r.notPregnantOn) {
    const d = daysUntil(r.nextAiDue!, today);
    return (
      <>
        <div className="text-danger font-bold">Not pregnant · PD −ve {shortDate(r.notPregnantOn)}</div>
        <Sub><span className={d < 0 ? 'text-danger font-bold' : d <= 3 ? 'text-[#8a5a00] font-bold' : ''}>
          Next AI due {shortDate(r.nextAiDue)} ({d < 0 ? `overdue ${-d} days` : fromToday(d)})
        </span></Sub>
      </>
    );
  }
  if (r.state === 'OPEN') {
    return <><div className="text-danger font-bold">Not inseminated</div><Sub>{r.daysOpen} days since calving</Sub></>;
  }
  return (
    <>
      <div>{shortDate(r.aiDate)} · {r.daysOpen} days open</div>
      <Sub>{r.state === 'CONFIRMED' ? `PD +ve ${shortDate(r.pdDate)}` : r.inseminations > 1 ? `AI no. ${r.inseminations} · not checked yet` : 'Not checked yet'}</Sub>
    </>
  );
}

function NextCalf({ c }: { c: EffCow }) {
  const r = c.reproduction;
  if (r.state === 'WAITING') return <><div className="font-bold text-text">12 months</div><Sub>if pregnant by {shortDate(r.breedBy)}</Sub></>;
  if (r.monthsToNextCalf == null) return <span className="text-text3">—</span>;
  const lead = r.state === 'OPEN' ? (r.notPregnantOn ? 'if the next AI takes' : 'at best, rising daily') : 'expected';
  return (
    <>
      <div className="font-bold text-text">{r.monthsToNextCalf} months</div>
      <Sub>{lead} · {shortDate(r.expectedCalving, true)}</Sub>
    </>
  );
}

function DryOff({ c, dryDays }: { c: EffCow; dryDays: number }) {
  const r = c.reproduction;
  if (r.drySince) {
    const long = (r.dryPeriodDays ?? 0) > dryDays + 10;
    return (
      <>
        <div>Dry since {shortDate(r.drySince)}</div>
        <Sub><span className={long ? 'text-[#8a5a00] font-bold' : ''}>{r.dryPeriodDays}-day dry period{long ? ` (aim ${dryDays})` : ''}</span></Sub>
      </>
    );
  }
  if (!r.dryOffDate) return <><span className="text-text3">—</span><Sub>{r.state === 'NO_CALVING' ? '' : 'once she is pregnant'}</Sub></>;
  const d = r.dryOffInDays!;
  return (
    <>
      <div className={d < 0 ? 'text-danger font-bold' : d <= 14 ? 'text-[#8a5a00] font-bold' : ''}>{shortDate(r.dryOffDate, true)}</div>
      <Sub>{d < 0 ? `overdue by ${-d} days` : fromToday(d)}</Sub>
    </>
  );
}

export default function ReproductionTab({ report }: { report: EffReport }) {
  const s = summarise(report).repro;
  const { rules, milkRate, asOf } = report;
  const dryDays = 60;
  const cows = report.cows.filter(c => c.reproduction.state !== 'NO_CALVING').sort((a, b) => rank(b) - rank(a));
  const noCalving = report.cows.filter(c => c.reproduction.state === 'NO_CALVING');

  return (
    <div className="space-y-3">
      <KpiRow>
        <Kpi label="Calving efficiency" value={s.efficiency != null ? `${Math.round(s.efficiency)}%` : '—'}
          sub={s.cows ? `${(s.avgInterval / 30.44).toFixed(1)} months between calves` : 'no cows to score yet'}
          tone={s.efficiency != null ? toneOf(s.efficiency) : undefined} />
        <Kpi label="Avg days open" value={s.cows ? `${Math.round(s.avgDaysOpen)}` : '—'} sub={`target ${rules.targetDaysOpen} or less`} />
        <Kpi label="Milk lost to late calving" value={litres(s.milkLostPerCow)} sub={`per cow a year · ${rupees(s.milkLostPerCow * milkRate)}`} />
        <Kpi label="Whole herd" value={litres(s.milkLost)} sub={`${rupees(s.milkLost * milkRate)} a year · ${s.calvesMissed.toFixed(1)} calves missed`} />
      </KpiRow>

      <Card>
        <div className="px-3 pt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-text2">
          <span className="font-bold">Calving efficiency = {rules.calvingInterval} ÷ calving interval.</span>
          {[365, 400, 450, 500, 600].map(d => (
            <span key={d} className="text-text3">{(d / 30.44).toFixed(0)} months → {Math.round((100 * rules.calvingInterval) / d)}%</span>
          ))}
        </div>
        <TableWrap wide>
          <thead>
            <tr>
              <th className={TH}>Cow</th><th className={TH}>Breeding</th><th className={TH}>Next calf</th>
              <th className={`${TH} w-[20%]`}>Calving efficiency</th><th className={TH}>Dry off</th>
              <th className={`${TH} text-right`}>Milk lost / year</th>
            </tr>
          </thead>
          <tbody>
            {cows.map(c => {
              const r = c.reproduction;
              return (
                <tr key={c.id}>
                  <td className={TD}><div className="font-bold text-text">{c.name}</div><Sub>calved {shortDate(c.lastCalving, true)} · day {c.dim}</Sub></td>
                  <td className={TD}><Breeding c={c} today={asOf} /></td>
                  <td className={TD}><NextCalf c={c} /></td>
                  <td className={TD}>
                    {r.state === 'WAITING'
                      ? <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#EBF3FD] text-[#1d5fa8]">Can still reach 100%</span>
                      : <PctBar pct={r.efficiency!} />}
                  </td>
                  <td className={TD}><DryOff c={c} dryDays={dryDays} /></td>
                  <td className={`${TD} text-right`}>{litres(r.milkLostPerYear ?? 0)}<Sub>{rupees((r.milkLostPerYear ?? 0) * milkRate)}</Sub></td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
        <Note>
          Days open = calving to the insemination that took. Months to the next calf = (days open + {rules.gestationDays} days of pregnancy) ÷ 30.4,
          so an AI 6 months after calving means about 15–16 months to the next calf. A cow found not pregnant is due her next AI 21 days later (one heat cycle).
          Dry off = {dryDays} days before the expected calving. Unconfirmed inseminations count as if they took.
          {noCalving.length > 0 && ` No calving recorded for ${noCalving.map(c => c.name).join(', ')}, so they aren't scored.`}
        </Note>
      </Card>
    </div>
  );
}
