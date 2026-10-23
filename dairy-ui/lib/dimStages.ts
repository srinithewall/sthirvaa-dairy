// Lactation stages by DIM (days in milk). Shared by the herds page and the dashboard so the
// colours always mean the same thing.

// Lactation stage bands by DIM (days in milk)
export const DIM_STAGES = [
  { max: 33,       days: 33,  label: 'Fresh (0–1M)',    text: 'text-purple-600', hex: '#a855f7' },
  { max: 100,      days: 67,  label: 'Peak (1–3M)',     text: 'text-green-700',  hex: '#16a34a' },
  { max: 200,      days: 100, label: 'Mid (3–7M)',      text: 'text-teal-600',   hex: '#14b8a6' },
  { max: 270,      days: 70,  label: 'Late (7–9M)',     text: 'text-amber-500',  hex: '#fbbf24' },
  { max: 305,      days: 35,  label: 'Dry-off (9–10M)', text: 'text-pink-600',   hex: '#ec4899' },
  { max: Infinity, days: 25,  label: 'Extended (10M+)', text: 'text-rose-800',   hex: '#9f1239' },
];
// Legend gradient: solid colour per band with a short soft blend at each boundary
export const DIM_TOTAL = DIM_STAGES.reduce((t, st) => t + st.days, 0);
export const DIM_GRADIENT = (() => {
  const blend = 1.5; // % of bar width blended on each side of a boundary
  let start = 0;
  const stops = DIM_STAGES.flatMap((st, i) => {
    const from = (start / DIM_TOTAL) * 100;
    start += st.days;
    const to = (start / DIM_TOTAL) * 100;
    const a = i === 0 ? from : from + blend;
    const b = i === DIM_STAGES.length - 1 ? to : to - blend;
    return [`${st.hex} ${a.toFixed(1)}%`, `${st.hex} ${b.toFixed(1)}%`];
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
})();
export const dimStage = (dim: number) => DIM_STAGES.find(s => dim <= s.max)!;
