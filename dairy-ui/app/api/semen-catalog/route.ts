import { NextResponse } from 'next/server';

export const runtime = 'edge';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Fallback catalog (used when backend is unavailable)
const FALLBACK_CATALOG = [
  {
    id: 1, semenId: 'hf-elite', bullId: 'HF-2204', breedName: 'HF Elite', breedCode: 'HF',
    absScore: 'ABS 7', colorHex: '#3B82F6', colorLabel: 'Blue Straw', semenCode: 'HF2204-A',
    milkPotential: '28–35 L/day', fat: '3.5–4.0%',
    benefits: 'High Milk Yield,Good Fertility,Heat Tolerant',
    successRate: 78, pregnancyRate: 68, femaleCalfPct: 90, price: 650,
    technicianCount: 6, fastestArrival: '30–45 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'COW', bestFor: 'hf,holstein,cross,mixed',
    strawImage: '/semen/straw-blue.png', calfImage: '/semen/calf-holstein.png', status: 'ACTIVE',
  },
  {
    id: 2, semenId: 'jersey-fat', bullId: 'JER-1458', breedName: 'Jersey High Fat', breedCode: 'JR',
    absScore: 'ABS 6', colorHex: '#F59E0B', colorLabel: 'Yellow Straw', semenCode: 'JR1108-B',
    milkPotential: '16–22 L/day', fat: '5.0–6.0%',
    benefits: 'High Fat %,Better SNF,Ideal for Butter',
    successRate: 72, pregnancyRate: 62, femaleCalfPct: 80, price: 600,
    technicianCount: 4, fastestArrival: '35–50 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'COW', bestFor: 'jersey,gir,sahiwal,local,desi',
    strawImage: '/semen/straw-yellow.png', calfImage: '/semen/calf-jersey.png', status: 'ACTIVE',
  },
  {
    id: 3, semenId: 'sahiwal-pure', bullId: 'SAH-7789', breedName: 'Sahiwal Premium', breedCode: 'SW',
    absScore: 'ABS 5', colorHex: '#EF4444', colorLabel: 'Red Straw', semenCode: 'SW3302-D',
    milkPotential: '12–18 L/day', fat: '4.5–5.5%',
    benefits: 'Heat Tolerant,Disease Resistant,Low Maintenance',
    successRate: 65, pregnancyRate: 58, femaleCalfPct: 70, price: 550,
    technicianCount: 3, fastestArrival: '40–60 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'COW', bestFor: 'sahiwal,local,desi,gir,tharparkar',
    strawImage: '/semen/straw-red.png', calfImage: '/semen/calf-sahiwal.png', status: 'ACTIVE',
  },
  {
    id: 4, semenId: 'gir-a2', bullId: 'GIR-3345', breedName: 'Gir Pure A2', breedCode: 'GR',
    absScore: 'ABS 4', colorHex: '#10B981', colorLabel: 'Green Straw', semenCode: 'GR5501-C',
    milkPotential: '15–20 L/day', fat: '4.5–5.5%',
    benefits: 'A2 Milk,Heat Tolerant,Longer Lactation',
    successRate: 60, pregnancyRate: 55, femaleCalfPct: 65, price: 550,
    technicianCount: 2, fastestArrival: '45–60 mins',
    slots: '6:30 AM – 8:30 AM,4:30 PM – 6:30 PM',
    animalType: 'COW', bestFor: 'gir,a2,desi,sahiwal,tharparkar,kankrej',
    strawImage: '/semen/straw-green.png', calfImage: '/semen/calf-gir.png', status: 'ACTIVE',
  },
  {
    id: 5, semenId: 'hf-power', bullId: 'HF-8856', breedName: 'Holstein Power', breedCode: 'HP',
    absScore: 'ABS 5', colorHex: '#8B5CF6', colorLabel: 'Purple Straw', semenCode: 'HF8856-G',
    milkPotential: '30–38 L/day', fat: '3.2–3.8%',
    benefits: 'Very High Milk,Good Conformation,Fast Growth',
    successRate: 70, pregnancyRate: 63, femaleCalfPct: 85, price: 700,
    technicianCount: 5, fastestArrival: '25–40 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'COW', bestFor: 'hf,holstein,cross,mixed',
    strawImage: '/semen/straw-purple.png', calfImage: '/semen/calf-holstein.png', status: 'ACTIVE',
  },
  {
    id: 6, semenId: 'murrah-elite', bullId: 'MR-7701', breedName: 'Murrah Buffalo', breedCode: 'MR',
    absScore: 'ABS 7', colorHex: '#0EA5E9', colorLabel: 'Cyan Straw', semenCode: 'MR7701-E',
    milkPotential: '18–25 L/day', fat: '7.0–8.5%',
    benefits: 'Highest Fat Buffalo,Premium Ghee,High Demand',
    successRate: 74, pregnancyRate: 64, femaleCalfPct: 78, price: 700,
    technicianCount: 5, fastestArrival: '30–45 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'BUFFALO', bestFor: 'murrah,buffalo,surti,jaffarabadi,nili',
    strawImage: '/semen/straw-blue.png', calfImage: '/semen/calf-holstein.png', status: 'ACTIVE',
  },
  {
    id: 7, semenId: 'surti-buffalo', bullId: 'SR-4403', breedName: 'Surti Buffalo', breedCode: 'SR',
    absScore: 'ABS 5', colorHex: '#F97316', colorLabel: 'Orange Straw', semenCode: 'SR4403-F',
    milkPotential: '14–20 L/day', fat: '6.5–7.5%',
    benefits: 'Easy Calving,Calm Temperament,Good Fat Content',
    successRate: 67, pregnancyRate: 58, femaleCalfPct: 72, price: 580,
    technicianCount: 4, fastestArrival: '35–55 mins',
    slots: '7:00 AM – 9:00 AM,5:00 PM – 7:00 PM',
    animalType: 'BUFFALO', bestFor: 'surti,buffalo,local buffalo,murrah',
    strawImage: '/semen/straw-yellow.png', calfImage: '/semen/calf-jersey.png', status: 'ACTIVE',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const animalType = searchParams.get('animalType') || '';

  try {
    const url = `${BACKEND}/api/semen-catalog${animalType ? `?animalType=${animalType}` : ''}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      // Forward auth header if present
      ...(request.headers.get('authorization')
        ? { headers: { Authorization: request.headers.get('authorization')! } }
        : {}),
      next: { revalidate: 60 }, // cache for 60s
    });

    if (!res.ok) throw new Error(`Backend returned ${res.status}`);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    // Backend unavailable — return fallback static catalog
    console.warn('[semen-catalog] backend unavailable, using fallback:', err);
    const filtered = animalType
      ? FALLBACK_CATALOG.filter(
          (s) => s.animalType === animalType.toUpperCase() || s.animalType === 'ANY'
        )
      : FALLBACK_CATALOG;
    return NextResponse.json(filtered);
  }
}
