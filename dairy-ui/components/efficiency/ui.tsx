'use client';

import React from 'react';
import { Tone, toneOf } from '@/lib/efficiency';

// Kept here, not in lib/: Tailwind only generates classes it finds under app/ and components/.
export const TONE: Record<Tone, { bar: string; pill: string; text: string }> = {
  good: { bar: 'bg-brand-light', pill: 'bg-[#E8F5EE] text-brand', text: 'text-brand' },
  fair: { bar: 'bg-warn', pill: 'bg-[#FEF6E0] text-[#8a5a00]', text: 'text-[#8a5a00]' },
  poor: { bar: 'bg-danger', pill: 'bg-[#FDEAEA] text-danger', text: 'text-danger' },
};

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'fair' | 'poor' }) {
  return (
    <div className="bg-white rounded-radius-custom-lg border border-border-custom p-3 sm:p-4 min-w-0">
      <div className="text-[11px] font-bold text-text3 uppercase tracking-wider">{label}</div>
      <div className={`text-[20px] sm:text-[22px] font-black mt-1 ${tone ? TONE[tone].text : 'text-text'}`}>{value}</div>
      {sub && <div className="text-[12px] text-text3 mt-0.5">{sub}</div>}
    </div>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">{children}</div>;
}

/** A percentage as a bar plus a coloured pill; the colour follows toneOf. */
export function PctBar({ pct }: { pct: number }) {
  const t = TONE[toneOf(pct)];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-2 flex-1 bg-surface2 rounded-full overflow-hidden min-w-[48px]">
        <div className={`h-full ${t.bar} rounded-full`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
      <span className={`text-[11px] font-black px-2 py-0.5 rounded-md whitespace-nowrap ${t.pill}`}>{Math.round(pct)}%</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-radius-custom-lg border border-border-custom ${className}`}>{children}</div>;
}

/** Wide tables scroll sideways on phones instead of squeezing. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[13px]">{children}</table></div>;
}

export const TH = 'text-left text-[11px] font-bold text-text3 uppercase tracking-wider px-3 py-2.5 border-b border-border-custom';
export const TD = 'px-3 py-2.5 border-b border-border-custom align-middle';

export function Sub({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-text3 mt-0.5">{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-text3 px-3 py-2.5">{children}</p>;
}
