'use client';

import React from 'react';
import { Heart } from 'lucide-react';

const HEART_PATH = 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.5 5.5 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5';

export type HealthLevel = 0 | 1 | 2;

export type HealthInfo = { level: HealthLevel; label: string; color: string; box: string };

/**
 * Health graded for the heart. Underweight = below her healthy minimum weight with a BCS under 3;
 * BCS 2.5 cracks the heart, BCS 2 or lower breaks it. Needing attention also breaks it, in red.
 */
export function healthInfo(healthStatus: string | null | undefined, bcs: number | null | undefined,
  weightKg: number | null | undefined, targetKg: number | null | undefined): HealthInfo {
  if (healthStatus && healthStatus.toUpperCase() !== 'HEALTHY')
    return { level: 2, label: 'Requires attention', color: 'text-red-700', box: 'border-red-200 bg-red-50 text-red-700' };
  const under = bcs != null && bcs < 3 && weightKg != null && targetKg != null && weightKg < targetKg;
  if (under && bcs! <= 2)
    return { level: 2, label: 'Badly underweight', color: 'text-orange-700', box: 'border-orange-300 bg-orange-100 text-orange-700' };
  if (under)
    return { level: 1, label: 'Underweight', color: 'text-orange-600', box: 'border-orange-200 bg-orange-50 text-orange-600' };
  return { level: 0, label: 'Healthy', color: 'text-emerald-600', box: 'border-emerald-200 bg-emerald-50 text-emerald-600' };
}

/** The split line, top notch to bottom tip. */
const CRACK = [[12, 5.2], [10, 9.5], [13.2, 12.5], [10.6, 16], [12, 21.5]];

/** Hairline cracks drawn in white: from the top notch, and in from the left, right and bottom edges. */
const HAIRLINES = {
  centre: '12,5.2 10.4,8.6 12.8,11.2 11,14',
  left: '1.8,10.4 4.4,11 4,12.8 6.6,14',
  right: '17.6,4.4 16.8,7 18.8,8.4 17.6,10.8',
  bottom: '8.6,18.4 9.8,16.6 9.2,15',
};

const Hairline = ({ points, width }: { points: string; width: number }) => (
  <polyline points={points} fill="none" stroke="#fff" strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"/>
);

/**
 * Health as a heart: 0 whole, 1 cracked in several places, 2 split in two along the crack with
 * the halves slightly apart and cracks on both - still clearly a heart.
 */
export function HealthHeart({ level, size = 16 }: { level: HealthLevel; size?: number }) {
  const id = React.useId().replace(/:/g, '');
  // Thicker lines when drawn small, so the cracks still show at icon size.
  const w = size <= 20 ? 1.6 : 1.3;
  if (level === 0) return <Heart size={size} fill="currentColor"/>;
  if (level === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d={HEART_PATH} fill="currentColor"/>
        <Hairline points={HAIRLINES.centre} width={w}/>
        <Hairline points={HAIRLINES.left} width={w}/>
        <Hairline points={HAIRLINES.right} width={w}/>
      </svg>
    );
  }
  const crack = CRACK.map(p => p.join(',')).join(' ');
  const back = [...CRACK].reverse().map(p => p.join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox="-1 -1 26 26" aria-hidden>
      <defs>
        <clipPath id={`${id}l`}><polygon points={`-3,-3 12,-3 ${crack} 12,27 -3,27`}/></clipPath>
        <clipPath id={`${id}r`}><polygon points={`12,-3 27,-3 27,27 12,27 ${back}`}/></clipPath>
      </defs>
      <g transform="translate(-0.8 0.4) rotate(-6 11 20)" clipPath={`url(#${id}l)`}>
        <path d={HEART_PATH} fill="currentColor"/>
        <Hairline points={HAIRLINES.left} width={w}/>
        <Hairline points={HAIRLINES.bottom} width={w}/>
      </g>
      <g transform="translate(0.8 0.4) rotate(6 13 20)" clipPath={`url(#${id}r)`}>
        <path d={HEART_PATH} fill="currentColor"/>
        <Hairline points={HAIRLINES.right} width={w}/>
      </g>
    </svg>
  );
}
