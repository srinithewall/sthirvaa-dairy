'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Edit2, Syringe, Heart, Baby, Leaf,
  Droplets, ShieldCheck, Bug, Pill, Activity, Microscope, Clock,
  AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, MoreVertical,
  AlertCircle, Phone, Star, ChevronRight, Info, Home, ImageIcon, CheckCircle, Zap, Film
} from 'lucide-react';
import api, { formatImageUrl } from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

/* ─── Types ─────────────────────────────────────── */
interface Herd {
  id: number; tagNumber: string; animalType: string; animalName: string;
  breed: string; milkType: string; healthStatus: string; source: string;
  birthDate: string; procuredDate: string; animalStatus: string;
  status: string; age: string; imageUrl?: string;
}
interface HerdEvent {
  id: number; herdId: number; eventDate: string; eventType: string;
  title: string; details?: string; createdAt: string;
}
interface Props {
  herd: Herd; events: HerdEvent[]; loadingEvents: boolean; userRole: string;
  failedImages: Record<number, boolean>; onBack: () => void; onEdit: () => void;
  onDelete: () => void; onEventAdded: (e: HerdEvent) => void;
  onEventDeleted: (id: number) => void; onImageError: (id: number) => void;
}

/* ─── Semen Catalog ──────────────────────────────
   Each entry maps to real-world bull semen available in India.
   bestFor: breed keywords that make this a recommended match.
   colorCode: visible swatch on card.
   slots: default AI service slots (overridable from settings).
────────────────────────────────────────────────── */
interface SemenEntry {
  id: string;
  bullId: string;
  breedName: string;
  breedCode: string;
  absScore: string;
  colorHex: string;
  colorLabel: string;
  milkPotential: string;
  fat: string;
  benefits: string[] | string;
  successRate: number;
  pregnancyRate: number;
  femaleCalfPct: number;
  price: number;
  semenCode: string;
  technicianCount: number;
  fastestArrival: string;
  slots: string[] | string;
  animalType: 'COW' | 'BUFFALO' | 'ANY';
  bestFor: string[] | string;
  emoji?: string;
  bgFrom?: string;
  bgTo?: string;
  strawImage?: string;
  calfImage?: string;
}

const SEMEN_CATALOG: SemenEntry[] = [
  {
    id: 'hf-elite',
    bullId: 'HF-2204',
    breedName: 'HF Elite',
    breedCode: 'HF',
    absScore: 'ABS 7',
    colorHex: '#3B82F6',
    colorLabel: 'Blue Straw',
    milkPotential: '28–35 L/day',
    fat: '3.5–4.0%',
    benefits: ['High Milk Yield', 'Good Fertility', 'Heat Tolerant'],
    successRate: 78,
    pregnancyRate: 68,
    femaleCalfPct: 90,
    price: 650,
    semenCode: 'HF2204-A',
    technicianCount: 6,
    fastestArrival: '30–45 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'COW',
    bestFor: ['hf', 'holstein', 'cross', 'mixed'],
    emoji: '🔵',
    bgFrom: '#EFF6FF',
    bgTo: '#DBEAFE',
  },
  {
    id: 'jersey-fat',
    bullId: 'JER-1458',
    breedName: 'Jersey High Fat',
    breedCode: 'JR',
    absScore: 'ABS 6',
    colorHex: '#F59E0B',
    colorLabel: 'Yellow Straw',
    milkPotential: '16–22 L/day',
    fat: '5.0–6.0%',
    benefits: ['High Fat %', 'Better SNF', 'Ideal for Butter'],
    successRate: 72,
    pregnancyRate: 62,
    femaleCalfPct: 80,
    price: 600,
    semenCode: 'JR1108-B',
    technicianCount: 4,
    fastestArrival: '35–50 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'COW',
    bestFor: ['jersey', 'gir', 'sahiwal', 'local', 'desi'],
    emoji: '🟡',
    bgFrom: '#FFFBEB',
    bgTo: '#FEF3C7',
  },
  {
    id: 'sahiwal-pure',
    bullId: 'SAH-7789',
    breedName: 'Sahiwal Premium',
    breedCode: 'SW',
    absScore: 'ABS 5',
    colorHex: '#EF4444',
    colorLabel: 'Red Straw',
    milkPotential: '12–18 L/day',
    fat: '4.5–5.5%',
    benefits: ['Heat Tolerant', 'Disease Resistant', 'Low Maintenance'],
    successRate: 65,
    pregnancyRate: 58,
    femaleCalfPct: 70,
    price: 550,
    semenCode: 'SW3302-D',
    technicianCount: 3,
    fastestArrival: '40–60 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'COW',
    bestFor: ['sahiwal', 'local', 'desi', 'gir', 'tharparkar'],
    emoji: '🔴',
    bgFrom: '#FFF1F2',
    bgTo: '#FFE4E6',
  },
  {
    id: 'gir-a2',
    bullId: 'GIR-3345',
    breedName: 'Gir Pure A2',
    breedCode: 'GR',
    absScore: 'ABS 4',
    colorHex: '#10B981',
    colorLabel: 'Green Straw',
    milkPotential: '15–20 L/day',
    fat: '4.5–5.5%',
    benefits: ['A2 Milk', 'Heat Tolerant', 'Longer Lactation'],
    successRate: 60,
    pregnancyRate: 55,
    femaleCalfPct: 65,
    price: 550,
    semenCode: 'GR5501-C',
    technicianCount: 2,
    fastestArrival: '45–60 mins',
    slots: ['6:30 AM – 8:30 AM', '4:30 PM – 6:30 PM'],
    animalType: 'COW',
    bestFor: ['gir', 'a2', 'desi', 'sahiwal', 'tharparkar', 'kankrej'],
    emoji: '🟢',
    bgFrom: '#F0FDF4',
    bgTo: '#DCFCE7',
  },
  {
    id: 'hf-power',
    bullId: 'HF-8856',
    breedName: 'Holstein Power',
    breedCode: 'HP',
    absScore: 'ABS 5',
    colorHex: '#8B5CF6',
    colorLabel: 'Purple Straw',
    milkPotential: '30–38 L/day',
    fat: '3.2–3.8%',
    benefits: ['Very High Milk', 'Good Conformation', 'Fast Growth'],
    successRate: 70,
    pregnancyRate: 63,
    femaleCalfPct: 85,
    price: 700,
    semenCode: 'HF8856-G',
    technicianCount: 5,
    fastestArrival: '25–40 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'COW',
    bestFor: ['hf', 'holstein', 'cross', 'mixed'],
    emoji: '🟣',
    bgFrom: '#F5F3FF',
    bgTo: '#EDE9FE',
  },
  {
    id: 'murrah-elite',
    bullId: 'MR-7701',
    breedName: 'Murrah Buffalo',
    breedCode: 'MR',
    absScore: 'ABS 7',
    colorHex: '#0EA5E9',
    colorLabel: 'Cyan Straw',
    milkPotential: '18–25 L/day',
    fat: '7.0–8.5%',
    benefits: ['Highest Fat Buffalo', 'Premium Ghee', 'High Demand'],
    successRate: 74,
    pregnancyRate: 64,
    femaleCalfPct: 78,
    price: 700,
    semenCode: 'MR7701-E',
    technicianCount: 5,
    fastestArrival: '30–45 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'BUFFALO',
    bestFor: ['murrah', 'buffalo', 'surti', 'jaffarabadi', 'nili'],
    emoji: '🔵',
    bgFrom: '#F0F9FF',
    bgTo: '#E0F2FE',
  },
  {
    id: 'surti-buffalo',
    bullId: 'SR-4403',
    breedName: 'Surti Buffalo',
    breedCode: 'SR',
    absScore: 'ABS 5',
    colorHex: '#F97316',
    colorLabel: 'Orange Straw',
    milkPotential: '14–20 L/day',
    fat: '6.5–7.5%',
    benefits: ['Easy Calving', 'Calm Temperament', 'Good Fat Content'],
    successRate: 67,
    pregnancyRate: 58,
    femaleCalfPct: 72,
    price: 580,
    semenCode: 'SR4403-F',
    technicianCount: 4,
    fastestArrival: '35–55 mins',
    slots: ['7:00 AM – 9:00 AM', '5:00 PM – 7:00 PM'],
    animalType: 'BUFFALO',
    bestFor: ['surti', 'buffalo', 'local buffalo', 'murrah'],
    emoji: '🟠',
    bgFrom: '#FFF7ED',
    bgTo: '#FFEDD5',
  },
];

/* ─── Breed → Recommendation Engine ─────────────
   Returns catalog IDs in recommended order for a given animal.
────────────────────────────────────────────────── */
function getRecommendations(herd: Herd): string[] {
  const breedLower = (herd.breed || '').toLowerCase();
  const isBuffalo   = herd.animalType === 'BUFFALO';

  // Filter by animal type first
  const eligible = SEMEN_CATALOG.filter(s =>
    s.animalType === herd.animalType || s.animalType === 'ANY'
  );

  // Score each semen entry
  const scored = eligible.map(s => {
    let score = 0;
    for (const kw of s.bestFor) {
      if (breedLower.includes(kw)) score += 10;
    }
    // Bonus: A2 milk type boosts indigenous breeds
    if (herd.milkType === 'A2' && (s.id === 'gir-a2' || s.id === 'sahiwal-pure')) score += 5;
    return { id: s.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.id);
}

/* ─── Event Config ───────────────────────────── */
const REMINDER_TYPES  = ['VACCINATION_DUE', 'DEWORMING_DUE', 'PREGNANCY_CHECK_DUE'];
const EV: Record<string, { icon: React.ElementType; color: string; bg: string; label: string; emoji: string }> = {
  SEMEN_GIVEN:          { icon: Syringe,     color: 'text-violet-700',  bg: 'bg-violet-100',  label: 'AI Performed',        emoji: '💉' },
  PREGNANCY_CONFIRMED:  { icon: Heart,       color: 'text-rose-700',    bg: 'bg-rose-100',    label: 'PD Positive',         emoji: '🤰' },
  CALF_DELIVERED:       { icon: Baby,        color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Calving',             emoji: '🐄' },
  DRY_PERIOD_STARTED:   { icon: Leaf,        color: 'text-amber-700',   bg: 'bg-amber-100',   label: 'Dry Period',          emoji: '🍂' },
  LACTATION_STARTED:    { icon: Droplets,    color: 'text-sky-700',     bg: 'bg-sky-100',     label: 'Lactation',           emoji: '🥛' },
  VACCINATION_DUE:      { icon: ShieldCheck, color: 'text-teal-700',    bg: 'bg-teal-100',    label: 'Vaccination',         emoji: '💊' },
  VACCINATION_DONE:     { icon: ShieldCheck, color: 'text-teal-700',    bg: 'bg-teal-100',    label: 'Vaccinated',          emoji: '✅' },
  DEWORMING_DUE:        { icon: Bug,         color: 'text-orange-700',  bg: 'bg-orange-100',  label: 'Deworming',           emoji: '🐛' },
  DEWORMING_DONE:       { icon: Bug,         color: 'text-orange-700',  bg: 'bg-orange-100',  label: 'Dewormed',            emoji: '✅' },
  PREGNANCY_CHECK_DUE:  { icon: Microscope,  color: 'text-indigo-700',  bg: 'bg-indigo-100',  label: 'PD Check',            emoji: '🔬' },
  TREATMENT:            { icon: Pill,        color: 'text-red-700',     bg: 'bg-red-100',     label: 'Treatment',           emoji: '💊' },
};
const DEF_EV = { icon: Activity, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Event', emoji: '📋' };

/* ─── Helpers ────────────────────────────────────── */
function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysFromNow(ds: string) {
  const [y,m,d] = ds.split('-').map(Number);
  const t = new Date(y,m-1,d); t.setHours(0,0,0,0);
  const n = new Date(); n.setHours(0,0,0,0);
  return Math.round((t.getTime()-n.getTime())/86400000);
}
function fmtDate(ds: string) {
  if (!ds) return '—';
  const [y,m,d] = ds.split('-').map(Number);
  return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`;
}
function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
}
function groupByDate(evts: HerdEvent[]) {
  const g: Record<string,HerdEvent[]> = {};
  const today = localDateStr();
  const yday  = (()=>{ const d=new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  for (const e of evts) {
    const lbl = e.eventDate===today?'Today':e.eventDate===yday?'Yesterday':fmtDate(e.eventDate);
    (g[lbl]=g[lbl]||[]).push(e);
  }
  return g;
}

/* ─── Semen Details Modal ────────────────────────── */
function SemenDetailsModal({ semen, onClose, onBook }: {
  semen: SemenEntry; onClose: () => void; onBook: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#2d6a4f,#1b4332)' }}>
          <div>
            <h3 className="text-[15px] font-bold text-white uppercase">Semen Details</h3>
            <p className="text-[10px] text-white/60 mt-0.5">{semen.breedName} ({semen.semenCode})</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all">
            <XCircle size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Main Info */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow border border-slate-200">
                <span className="text-[24px]">💉</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: semen.colorHex }} />
            </div>
            <div>
              <div className="text-[15px] font-bold text-slate-800">{semen.breedName}</div>
              <div className="text-[11px] text-slate-500 font-medium">Bull ID: {semen.bullId} · Code: {semen.semenCode}</div>
            </div>
          </div>

          {/* Straw Color Code Explanation */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Straw Color Code</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: semen.colorHex }} />
              <div>
                <div className="text-[13px] font-bold text-slate-700">{semen.colorLabel}</div>
                <div className="text-[11px] text-slate-500">Color-coded straw for quick identification at the farm.</div>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-center">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Success Rate</div>
              <div className="text-[15px] font-bold text-emerald-800">{semen.successRate}%</div>
            </div>
            <div className="bg-sky-50 rounded-2xl p-3 border border-sky-100 text-center">
              <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-0.5">Milk Potential</div>
              <div className="text-[13px] font-bold text-sky-800 leading-tight">{semen.milkPotential}</div>
            </div>
            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 text-center">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Fat Content</div>
              <div className="text-[13px] font-bold text-amber-800 leading-tight">{semen.fat}</div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">✨ Breed Benefits</div>
            <div className="grid grid-cols-1 gap-2">
              {(Array.isArray(semen.benefits) ? semen.benefits : (semen.benefits as string).split(',').map((b:string)=>b.trim())).map(b => (
                <div key={b} className="flex items-center gap-2 bg-emerald-50/50 px-3 py-2 rounded-xl border border-emerald-100">
                  <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-[12px] font-bold text-slate-700">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slots & Availability */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🕐 Service Slots & Technicians</div>
            <div className="space-y-2">
              {(Array.isArray(semen.slots) ? semen.slots : (semen.slots as string).split(',').map((s:string)=>s.trim())).map((slot, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
                  <Clock size={15} className="text-brand flex-shrink-0" />
                  <div>
                    <div className="text-[12px] font-bold text-slate-700">{slot}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Slot Configured in Settings</div>
                  </div>
                  <span className="ml-auto text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    {semen.technicianCount} Technicians
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with Price and Book */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Price</div>
            <div className="text-[22px] font-bold text-slate-800 leading-tight">₹{semen.price}</div>
          </div>
          <button
            onClick={() => {
              onBook();
              onClose();
            }}
            className="flex-1 py-3.5 rounded-2xl font-bold text-[13px] uppercase tracking-wider text-white shadow-md active:scale-[0.97] transition-all bg-gradient-to-r from-brand to-brand-dark flex items-center justify-center gap-2"
          >
            <span>Book AI Service</span>
            <Zap size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Compact Task Row ───────────────────────────── */
function TaskRow({ event }: { event: HerdEvent }) {
  const cfg = EV[event.eventType] || DEF_EV;
  const Icon = cfg.icon;
  const days = daysFromNow(event.eventDate);
  const overdue = days < 0;
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 ${overdue ? 'bg-red-50 border-red-200' : days <= 3 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-red-100' : cfg.bg}`}>
        <Icon size={18} className={overdue ? 'text-red-600' : cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-slate-800">{event.title}</div>
        <div className={`text-[11px] font-bold mt-0.5 ${overdue ? 'text-red-600' : days === 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
          {overdue ? `⚠ Overdue by ${Math.abs(days)} day${Math.abs(days)>1?'s':''}` :
           days === 0 ? '🔴 Due Today' :
           days <= 7 ? `⚡ Due in ${days} days` :
           `📅 Due in ${days} days`}
        </div>
      </div>
    </div>
  );
}

/* ─── WhatsApp Chat Bubble ───────────────────────── */
function ChatBubble({ event, canDelete, onDelete }: { event: HerdEvent; canDelete: boolean; onDelete: () => void }) {
  const cfg = EV[event.eventType] || DEF_EV;
  return (
    <div className="flex gap-2.5 items-end group">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${cfg.bg} border-2 border-white shadow-sm`}>
        <span className="text-[16px]">{cfg.emoji}</span>
      </div>
      <div className="flex-1 max-w-[86%]">
        <div className="bg-white rounded-t-2xl rounded-br-2xl rounded-bl-sm shadow-sm border border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${cfg.color}`}>{cfg.label}</div>
              <div className="text-[13px] font-bold text-slate-800 leading-snug">{event.title}</div>
              {event.details && <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{event.details}</p>}
            </div>
            {canDelete && (
              <button onClick={onDelete} className="p-1.5 text-red-300 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 ml-2 flex items-center gap-1">
          {fmtTime(event.createdAt) && <span>{fmtTime(event.createdAt)}</span>}
          <span>{!fmtTime(event.createdAt) && fmtDate(event.eventDate)}</span>
          <CheckCircle size={10} className="text-sky-400" />
        </div>
      </div>
    </div>
  );
}

/* ─── Service Button ─────────────────────────────── */
function ServiceBtn({ icon: Icon, label, sub, color, bg, onClick }: {
  icon: React.ElementType; label: string; sub: string; color: string; bg: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl ${bg} active:scale-[0.96] transition-all border-2 border-transparent`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color.replace('text-','bg-').replace('-700','-100').replace('-600','-100')}`}>
        <Icon size={22} className={color} />
      </div>
      <div className="text-center">
        <div className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</div>
        <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{sub}</div>
      </div>
    </button>
  );
}

/* ─── Timeline Row ───────────────────────────── */
function TimelineRow({ event, canDelete, onDelete }: { event: HerdEvent; canDelete: boolean; onDelete: () => void }) {
  const cfg = EV[event.eventType] || DEF_EV;
  const Icon = cfg.icon;
  const [showMenu, setShowMenu] = React.useState(false);
  const isReminder = REMINDER_TYPES.includes(event.eventType);
  const days = daysFromNow(event.eventDate);
  const isOverdue = days < 0 && isReminder;

  return (
    <div className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors group relative">
      {/* Date/Time */}
      <div className="w-[68px] flex-shrink-0 text-right pt-0.5">
        <div className="text-[11px] font-bold text-text2">{fmtDate(event.eventDate)}</div>
        {event.createdAt && <div className="text-[10px] text-text3">{fmtTime(event.createdAt)}</div>}
      </div>

      {/* Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
        <Icon size={14} className={cfg.color}/>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-text leading-tight">{event.title}</div>
            {event.details && <div className="text-[11px] text-text3 mt-0.5 leading-relaxed">{event.details}</div>}
          </div>
          {/* Status badge */}
          {isOverdue
            ? <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>
            : <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed</span>
          }
        </div>
      </div>

      {/* 3-dot menu */}
      {canDelete && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-1.5 rounded-lg text-text3 opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-[50]" onClick={() => setShowMenu(false)}/>
              <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden min-w-[130px]">
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={12}/> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Action Required Panel ──────────────────── */
function ActionRequiredPanel({ reminders, onOpenAction, onViewAll }: {
  reminders: HerdEvent[]; onOpenAction: (type: string) => void; onViewAll: () => void;
}) {
  const overdue = reminders.filter(r => daysFromNow(r.eventDate) < 0);
  const upcoming = reminders.filter(r => daysFromNow(r.eventDate) >= 0 && daysFromNow(r.eventDate) <= 30);
  const all = [...overdue, ...upcoming].slice(0, 3);

  if (all.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-3">
        <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0"/>
        <div>
          <div className="text-[13px] font-bold text-emerald-700">All Clear!</div>
          <div className="text-[10px] text-text3 mt-0.5">No pending tasks</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-text uppercase tracking-wide">Action Required</h3>
        <button onClick={onViewAll} className="text-[10px] font-bold text-brand hover:underline">
          View All ({reminders.length})
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {all.map(r => {
          const cfg = EV[r.eventType] || DEF_EV;
          const days = daysFromNow(r.eventDate);
          const overdue = days < 0;
          const doneType = r.eventType.replace('_DUE', '_DONE');
          return (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${overdue ? 'bg-red-500' : 'bg-slate-300'}`}/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-800 truncate">{r.title.replace(' Reminder','').replace(' Due','')}</div>
                <div className={`text-[10px] font-semibold mt-0.5 ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                  {overdue ? `Overdue by ${Math.abs(days)} days` : `In ${days} days (${fmtDate(r.eventDate)})`}
                </div>
              </div>
              <button
                onClick={() => onOpenAction(doneType)}
                className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                {overdue ? 'Mark Done' : 'Schedule'}
              </button>
            </div>
          );
        })}
      </div>

      {/* What's Next */}
      {upcoming.length > 0 && (
        <div className="mx-4 mb-4 mt-1 p-3 rounded-xl bg-brand/5 border border-brand/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Clock size={13} className="text-brand"/>
            </div>
            <div>
              <div className="text-[10px] font-bold text-brand uppercase tracking-wide">What's Next?</div>
              <div className="text-[12px] font-bold text-text leading-tight">{upcoming[0].title.replace(' Reminder','')}</div>
            </div>
          </div>
          <div className="text-[10px] text-text3 ml-9">{fmtDate(upcoming[0].eventDate)} (in {daysFromNow(upcoming[0].eventDate)} days)</div>
          <button
            onClick={() => onOpenAction('DEWORMING_DUE')}
            className="mt-2 ml-9 text-[10px] font-bold text-brand border border-brand/30 bg-brand/10 hover:bg-brand/20 px-3 py-1 rounded-lg transition-colors"
          >
            Set Reminder
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Animal Info Panel ──────────────────────── */
function AnimalInfoPanel({ herd, events, reproStats, onEdit }: {
  herd: Herd; events: HerdEvent[]; reproStats: any; onEdit?: () => void;
}) {
  // Compute days in milk
  const lastCalving = events.filter(e => e.eventType === 'CALF_DELIVERED').sort((a,b) => b.eventDate.localeCompare(a.eventDate))[0];
  const dim = lastCalving ? Math.ceil((Date.now() - new Date(lastCalving.eventDate).getTime()) / 86400000) : null;

  // Milk yield from herd data or a reasonable estimate
  const milkYield = (herd as any).milkYield || (herd as any).avgMilkYield || null;
  const bodyWeight = (herd as any).bodyWeight || (herd as any).weight || null;

  const parity = reproStats.calvingCount > 0
    ? `${reproStats.calvingCount}${reproStats.calvingCount === 1 ? 'st' : reproStats.calvingCount === 2 ? 'nd' : reproStats.calvingCount === 3 ? 'rd' : 'th'} Lactation`
    : 'Heifer';

  const stats = [
    { label: 'Breed', value: herd.breed || '—', icon: '🐄' },
    { label: 'Age', value: herd.age || '—', icon: '📅' },
    { label: 'Parity', value: parity, icon: '🔢' },
    { label: 'Last Calving', value: lastCalving ? fmtDate(lastCalving.eventDate) : '—', icon: '🐣' },
    { label: 'Milk Yield', value: milkYield ? `${milkYield} L/day` : '—', icon: '🥛' },
    { label: 'Body Weight', value: bodyWeight ? `${bodyWeight} Kg` : '—', icon: '⚖️' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-text uppercase tracking-wide">Animal Information</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-[10px] font-bold text-brand hover:underline">Edit</button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-0 divide-x divide-y divide-slate-100">
        {stats.map(s => (
          <div key={s.label} className="px-3 py-2.5 text-center">
            <div className="text-[10px] text-text3 font-semibold">{s.label}</div>
            <div className="text-[11px] font-bold text-text mt-0.5 leading-tight break-words">{s.value}</div>
          </div>
        ))}
      </div>
      {dim !== null && (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-brand/5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-text3">Days in Milk:</span>
          <span className="text-[13px] font-bold text-brand">{dim} Days</span>
        </div>
      )}
    </div>
  );
}

/* ─── Actions Dropdown Menu ──────────────────── */
function ActionsMenu({ onEdit, onDelete, onAddEvent }: {
  onEdit?: () => void; onDelete?: () => void; onAddEvent?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const actions = [
    onAddEvent && { label: 'Add Event',     icon: <Plus size={14}/>, fn: onAddEvent, color: 'text-slate-700' },
    onEdit     && { label: 'Edit Animal',   icon: <Edit2 size={14}/>, fn: onEdit,     color: 'text-slate-700' },
    onDelete   && { label: 'Delete Animal', icon: <Trash2 size={14}/>, fn: onDelete,   color: 'text-red-600'   },
  ].filter(Boolean) as { label: string; icon: React.ReactNode; fn: () => void; color: string }[];

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        title="More Actions"
      >
        <MoreVertical size={16}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-[60] overflow-hidden min-w-[160px] py-1">
            {actions.map(a => (
              <button
                key={a.label}
                onClick={() => { setOpen(false); a.fn(); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-bold hover:bg-slate-50 transition-colors ${a.color}`}
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


function AddEventModal({ herd, prefill, onClose, onSaved }: {
  herd: Herd; prefill?: string; onClose: () => void; onSaved: (e: HerdEvent) => void;
}) {
  const titleMap: Record<string,string> = {
    SEMEN_GIVEN:'AI Performed', PREGNANCY_CONFIRMED:'PD Positive', CALF_DELIVERED:'Calf Delivered',
    DRY_PERIOD_STARTED:'Dry Period Started', LACTATION_STARTED:'Lactation Started',
    VACCINATION_DUE:'Vaccination Scheduled', VACCINATION_DONE:'Vaccination Done',
    DEWORMING_DUE:'Deworming Scheduled', DEWORMING_DONE:'Deworming Done',
    PREGNANCY_CHECK_DUE:'PD Check Scheduled', TREATMENT:'Treatment / Medication',
  };

  const titleOptionsMap: Record<string, string[]> = {
    SEMEN_GIVEN: ['AI Performed', 'Natural Service', 'Inseminated'],
    PREGNANCY_CONFIRMED: ['Pregnancy Confirmed (PD)', 'PD Positive (60 Days)', 'PD Positive (90 Days)'],
    CALF_DELIVERED: ['Calf Delivered', 'Stillborn', 'Abortion'],
    DRY_PERIOD_STARTED: ['Dry Period Started', 'Force Dry', 'Natural Dry'],
    LACTATION_STARTED: ['Lactation Started', 'First Lactation', 'Second Lactation'],
    VACCINATION_DONE: ['FMD Vaccine Done', 'HS-BQ Vaccine Done', 'Brucellosis Done', 'Routine Vaccination Done'],
    VACCINATION_DUE: ['FMD Vaccine Scheduled', 'HS-BQ Vaccine Scheduled', 'Brucellosis Scheduled'],
    DEWORMING_DONE: ['Deworming Done (Routine)', 'Deworming Done (Fenbendazole)', 'Deworming Done (Ivermectin)'],
    DEWORMING_DUE: ['Deworming Scheduled', 'Routine Deworming Due'],
    PREGNANCY_CHECK_DUE: ['PD Check Scheduled', 'Follow-up PD Check'],
    TREATMENT: ['Mastitis Treatment', 'Fever Treatment', 'Indigestion Treatment', 'Wound Treatment', 'General Vet Checkup']
  };

  const [type, setType]       = useState(prefill||'SEMEN_GIVEN');
  const [date, setDate]       = useState(localDateStr());
  const [title, setTitle]     = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [showCustomTitleInput, setShowCustomTitleInput] = useState(false);
  const [details, setDetails] = useState('');
  
  // Follow-up reminder state
  const [setReminder, setSetReminder] = useState(false);
  const [reminderType, setReminderType] = useState('PREGNANCY_CHECK_DUE');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTitle, setReminderTitle] = useState('PD Check Scheduled');

  const [saving, setSaving]   = useState(false);
  const { showToast } = useNotification();

  const groups = [
    { label:'🧬 Breeding', opts:[
      {v:'SEMEN_GIVEN',l:'AI Performed'},{v:'PREGNANCY_CONFIRMED',l:'PD Positive'},
      {v:'CALF_DELIVERED',l:'Calf Delivered'},{v:'DRY_PERIOD_STARTED',l:'Dry Period Started'},{v:'LACTATION_STARTED',l:'Lactation Started'}]},
    { label:'🩺 Health', opts:[
      {v:'VACCINATION_DONE',l:'Vaccination Done'},{v:'VACCINATION_DUE',l:'Schedule Vaccination'},
      {v:'DEWORMING_DONE',l:'Deworming Done'},{v:'DEWORMING_DUE',l:'Schedule Deworming'},
      {v:'PREGNANCY_CHECK_DUE',l:'Schedule PD Check'},{v:'TREATMENT',l:'Treatment / Medication'}]},
  ];

  // Adjust defaults when event type or event date changes
  useEffect(() => {
    const opts = titleOptionsMap[type] || ['Custom Event'];
    setTitle(opts[0]);
    setCustomTitle('');
    setShowCustomTitleInput(false);

    // Dynamic future offset calculations for follow-up reminders
    const baseDate = new Date(date);
    if (isNaN(baseDate.getTime())) return;

    if (type === 'SEMEN_GIVEN') {
      setReminderType('PREGNANCY_CHECK_DUE');
      setReminderTitle('PD Check Scheduled');
      baseDate.setDate(baseDate.getDate() + 60); // PD Check in 60 days
      setReminderDate(baseDate.toISOString().split('T')[0]);
    } else if (type === 'PREGNANCY_CONFIRMED') {
      setReminderType('CALF_DELIVERED');
      setReminderTitle('Expected Calving Due');
      baseDate.setDate(baseDate.getDate() + 220); // typical remaining gestation before dry/calving
      setReminderDate(baseDate.toISOString().split('T')[0]);
    } else if (type === 'DEWORMING_DONE') {
      setReminderType('DEWORMING_DUE');
      setReminderTitle('Deworming Scheduled');
      baseDate.setDate(baseDate.getDate() + 90); // Next deworming in 90 days
      setReminderDate(baseDate.toISOString().split('T')[0]);
    } else if (type === 'VACCINATION_DONE') {
      setReminderType('VACCINATION_DUE');
      setReminderTitle('Vaccination Scheduled');
      baseDate.setDate(baseDate.getDate() + 180); // Next vaccination in 180 days
      setReminderDate(baseDate.toISOString().split('T')[0]);
    } else {
      setReminderType('TREATMENT');
      setReminderTitle('Follow-up Checkup');
      baseDate.setDate(baseDate.getDate() + 7); // Follow-up checkup in 7 days
      setReminderDate(baseDate.toISOString().split('T')[0]);
    }
  }, [type, date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setSaving(true);
    try {
      const finalTitle = showCustomTitleInput ? customTitle : title;
      // 1. Save main event
      const res = await api.post(`/herds/${herd.id}/events`, {
        eventDate: date,
        eventType: type,
        title: finalTitle,
        details
      });

      // 2. Optional follow-up reminder event
      if (setReminder && reminderDate) {
        await api.post(`/herds/${herd.id}/events`, {
          eventDate: reminderDate,
          eventType: reminderType,
          title: reminderTitle,
          details: `Scheduled follow-up task related to: ${finalTitle}.`
        });
      }

      showToast('Event saved!'); 
      onSaved(res.data);
    } catch { 
      showToast('Failed.','error'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{background:'linear-gradient(135deg,#2d6a4f,#1b4332)'}}>
          <div>
            <h3 className="text-[15px] font-bold text-white uppercase">Record Event</h3>
            <p className="text-[10px] text-white/60 mt-0.5">{herd.animalName}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all"><XCircle size={20}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Event Category</label>
            <select value={type} onChange={e=>{setType(e.target.value);}}
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-brand" required>
              {groups.map(g=><optgroup key={g.label} label={g.label}>{g.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>)}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} required
                className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-800 focus:outline-none focus:border-brand"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Title</label>
              <select value={title} onChange={e => {
                if (e.target.value === 'OTHER') {
                  setShowCustomTitleInput(true);
                  setTitle('OTHER');
                } else {
                  setShowCustomTitleInput(false);
                  setTitle(e.target.value);
                }
              }} required
                className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-800 focus:outline-none focus:border-brand">
                {(titleOptionsMap[type] || ['Custom Event']).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="OTHER">Other / Custom...</option>
              </select>
            </div>
          </div>

          {showCustomTitleInput && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Custom Title</label>
              <input type="text" value={customTitle} onChange={e=>setCustomTitle(e.target.value)} required
                placeholder="Enter custom title"
                className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[12px] font-bold text-slate-800 focus:outline-none focus:border-brand"/>
            </div>
          )}

          <textarea rows={2} value={details} onChange={e=>setDetails(e.target.value)}
            placeholder="Notes (vet name, dose, semen batch, technician...)"
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[12px] text-slate-800 focus:outline-none focus:border-brand resize-none placeholder:text-slate-300"/>

          {/* Schedule Follow-up Reminder Section */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={setReminder} onChange={e=>setSetReminder(e.target.checked)}
                className="w-4 h-4 rounded text-brand focus:ring-brand border-slate-300"/>
              <span className="text-[12px] font-bold text-slate-700">Schedule Follow-up Reminder</span>
            </label>
            
            {setReminder && (
              <div className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reminder Date</label>
                    <input type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)} required
                      className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:border-brand"/>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reminder Action</label>
                    <select value={reminderType} onChange={e=>{
                      setReminderType(e.target.value);
                      setReminderTitle(titleMap[e.target.value] || 'Scheduled Event');
                    }} required
                      className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:border-brand">
                      <option value="PREGNANCY_CHECK_DUE">Schedule PD Check</option>
                      <option value="DEWORMING_DUE">Schedule Deworming</option>
                      <option value="VACCINATION_DUE">Schedule Vaccination</option>
                      <option value="TREATMENT">Follow-up Treatment</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reminder Title</label>
                  <input type="text" value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} required
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:border-brand"/>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-[12px] uppercase tracking-wider">Cancel</button>
            <button type="submit" disabled={saving} className="flex-[2] py-4 rounded-2xl text-white font-bold text-[13px] uppercase tracking-wider disabled:opacity-60" style={{background:'linear-gradient(135deg,#2d6a4f,#1b4332)'}}>
              {saving?'Saving...':'Save →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Workaround: pass herd into SemenCard via closure — defined outside but used inside
// The SemenCard needs access to herd.breed for the recommended badge label
// We'll render SemenCard inside the main component where herd is in scope

/* ─── MAIN COMPONENT ─────────────────────────────── */
export default function AnimalWorkspace({
  herd, events, loadingEvents, userRole, failedImages,
  onBack, onEdit, onDelete, onEventAdded, onEventDeleted, onImageError,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview'|'breeding'|'health'|'history'|'details'>('overview');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showSemenSelection, setShowSemenSelection] = useState(false);
  const [prefillType, setPrefillType] = useState<string|undefined>();
  const [selectedSemen, setSelectedSemen] = useState<SemenEntry | null>(null);
  const [dbCatalog, setDbCatalog] = useState<SemenEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const { showToast, confirm } = useNotification();

  const [showGallery, setShowGallery] = useState(false);
  const [activeMedia, setActiveMedia] = useState<number>(0);

  const [showCompare, setShowCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedBreedCategory, setSelectedBreedCategory] = useState<string>('ALL');
  const [searchSemenQuery, setSearchSemenQuery] = useState<string>('');

  const isAdmin = userRole === 'ADMIN';
  const imgUrl  = (herd.imageUrl && !failedImages[herd.id]) ? formatImageUrl(herd.imageUrl) : null;

  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const mediaGallery = useMemo(() => {
    const breed = (herd.breed || '').toLowerCase();
    const isCow = herd.animalType === 'COW';
    const isBuffalo = herd.animalType === 'BUFFALO';

    const items = [];

    // 1. Primary image (the animal's actual uploaded image, if any)
    if (imgUrl) {
      items.push({ type: 'image', url: imgUrl, title: `${herd.animalName || 'Unnamed'}'s Profile Photo` });
    }

    // 2. Representative pictures based on breed/type
    if (isCow) {
      if (breed.includes('jersey')) {
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=800&q=80', title: 'Jersey Breed Showcase' });
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=800&q=80', title: 'Jersey Grazing' });
      } else if (breed.includes('gir')) {
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1596733430284-f7437764b1a9?auto=format&fit=crop&w=800&q=80', title: 'Gir Cattle Portrait' });
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1527153857715-3908f2bac5e8?auto=format&fit=crop&w=800&q=80', title: 'Gir Cow in Farm' });
      } else if (breed.includes('sahiwal')) {
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1605001011156-cbf0b0f67a51?auto=format&fit=crop&w=800&q=80', title: 'Sahiwal Dairy Cow' });
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1563507316362-e64e56598075?auto=format&fit=crop&w=800&q=80', title: 'Sahiwal Grazing' });
      } else {
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80', title: 'Holstein Cow' });
        items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=800&q=80', title: 'Grazing Field' });
      }
      items.push({
        type: 'video',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-cows-in-a-green-pasture-42352-large.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=400&q=80',
        title: 'Cows in Green Pastures'
      });
    } else if (isBuffalo) {
      items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1589923188900-85dae4400a7c?auto=format&fit=crop&w=800&q=80', title: 'Murrah Buffalo' });
      items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1597843797221-50d8905d11fb?auto=format&fit=crop&w=800&q=80', title: 'Buffalo in Water' });
      items.push({
        type: 'video',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-domestic-water-buffaloes-crossing-a-river-42360-large.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1589923188900-85dae4400a7c?auto=format&fit=crop&w=400&q=80',
        title: 'Water Buffalo Crossing River'
      });
    } else {
      items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=800&q=80', title: 'Farm Animals' });
      items.push({
        type: 'video',
        url: 'https://assets.mixkit.co/videos/preview/mixkit-farm-animals-in-a-stable-42357-large.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=400&q=80',
        title: 'Farm Life'
      });
    }

    if (items.length === 0) {
      items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80', title: 'Farm Showcase' });
    }

    items.push(...uploadedMedia);
    return items;
  }, [herd.breed, herd.animalType, imgUrl, herd.animalName, uploadedMedia]);

  /* Derived */
  const reminders       = useMemo(()=> events.filter(e=>REMINDER_TYPES.includes(e.eventType)).sort((a,b)=>a.eventDate.localeCompare(b.eventDate)),[events]);
  const overdueReminders= reminders.filter(r=>daysFromNow(r.eventDate)<0);
  const todayReminders  = reminders.filter(r=>daysFromNow(r.eventDate)===0);
  const upcomingReminders = reminders.filter(r=>daysFromNow(r.eventDate)>0);
  const urgentTasks     = reminders.filter(r=>daysFromNow(r.eventDate)<=7);

  const reproStats = useMemo(()=>{
    const ai   = events.filter(e=>e.eventType==='SEMEN_GIVEN').sort((a,b)=>b.eventDate.localeCompare(a.eventDate));
    const pd   = events.filter(e=>e.eventType==='PREGNANCY_CONFIRMED').sort((a,b)=>b.eventDate.localeCompare(a.eventDate));
    const calv = events.filter(e=>e.eventType==='CALF_DELIVERED').sort((a,b)=>b.eventDate.localeCompare(a.eventDate));
    const lastAi=ai[0]?.eventDate??null, lastPd=pd[0]?.eventDate??null, lastCalving=calv[0]?.eventDate??null;
    let isPregnant=false,daysPregnant=0,gestationPct=0,expectedDelivery:string|null=null;
    if(lastPd&&(!lastCalving||lastPd>lastCalving)){
      isPregnant=true;
      if(lastAi){
        const g=herd.animalType==='BUFFALO'?310:283;
        const [y,m,d]=lastAi.split('-').map(Number); const aiD=new Date(y,m-1,d);
        daysPregnant=Math.ceil((Date.now()-aiD.getTime())/86400000);
        gestationPct=Math.min(100,Math.round(daysPregnant/g*100));
        const c=new Date(aiD); c.setDate(c.getDate()+g);
        expectedDelivery=`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,'0')}-${String(c.getDate()).padStart(2,'0')}`;
      }
    }
    return {isPregnant,daysPregnant,gestationPct,expectedDelivery,calvingCount:calv.length};
  },[events,herd.animalType]);

  /* ─── Fetch semen catalog from API ─── */
  useEffect(()=>{
    setCatalogLoading(true);
    fetch(`/api/semen-catalog?animalType=${herd.animalType}`)
      .then(r=>r.json())
      .then((data: any[])=>{
        // Normalise: split CSV strings into arrays if needed
        const normalised = data.map((s: any): SemenEntry =>({
          id: s.semenId || String(s.id),
          bullId: s.bullId,
          breedName: s.breedName,
          breedCode: s.breedCode,
          absScore: s.absScore,
          colorHex: s.colorHex,
          colorLabel: s.colorLabel,
          milkPotential: s.milkPotential,
          fat: s.fat,
          benefits: typeof s.benefits==='string' ? s.benefits.split(',').map((b:string)=>b.trim()) : (s.benefits||[]),
          successRate: s.successRate,
          pregnancyRate: s.pregnancyRate,
          femaleCalfPct: s.femaleCalfPct,
          price: s.price,
          semenCode: s.semenCode,
          technicianCount: s.technicianCount,
          fastestArrival: s.fastestArrival,
          slots: typeof s.slots==='string' ? s.slots.split(',').map((t:string)=>t.trim()) : (s.slots||[]),
          animalType: s.animalType,
          bestFor: typeof s.bestFor==='string' ? s.bestFor.split(',').map((b:string)=>b.trim()) : (s.bestFor||[]),
          strawImage: s.strawImage,
          calfImage: s.calfImage,
        }));
        setDbCatalog(normalised);
      })
      .catch(()=>setDbCatalog([]))
      .finally(()=>setCatalogLoading(false));
  },[herd.animalType]);

  const recommendedOrder = useMemo(()=>getRecommendations(herd),[herd]);
  const sortedCatalog = useMemo(()=>{
    const catalog = dbCatalog.length > 0 ? dbCatalog : SEMEN_CATALOG.filter(s=>s.animalType===herd.animalType||s.animalType==='ANY');
    return [...catalog].sort((a,b)=>recommendedOrder.indexOf(a.id)-recommendedOrder.indexOf(b.id));
  },[dbCatalog,herd,recommendedOrder]);

  const filteredCatalogForCompare = useMemo(() => {
    return sortedCatalog.filter((s) => {
      // Category filter
      if (selectedBreedCategory !== 'ALL') {
        const code = (s.breedCode || s.breedName || '').toUpperCase();
        if (selectedBreedCategory === 'HF' && !(code.includes('HF') || code.includes('HOLSTEIN'))) return false;
        if (selectedBreedCategory === 'GIR' && !(code.includes('GR') || code.includes('GIR'))) return false;
        if (selectedBreedCategory === 'SAHIWAL' && !(code.includes('SW') || code.includes('SAHIWAL'))) return false;
        if (selectedBreedCategory === 'JERSEY' && !(code.includes('JR') || code.includes('JERSEY'))) return false;
        if (selectedBreedCategory === 'BUFFALO' && s.animalType !== 'BUFFALO') return false;
      }
      // Search query filter
      if (searchSemenQuery.trim() !== '') {
        const query = searchSemenQuery.toLowerCase();
        const matchesName = (s.breedName || '').toLowerCase().includes(query);
        const matchesBullId = (s.bullId || '').toLowerCase().includes(query);
        const matchesCode = (s.semenCode || '').toLowerCase().includes(query);
        if (!(matchesName || matchesBullId || matchesCode)) return false;
      }
      return true;
    });
  }, [sortedCatalog, selectedBreedCategory, searchSemenQuery]);

  useEffect(() => {
    if (sortedCatalog.length > 0 && compareIds.length === 0) {
      setCompareIds(sortedCatalog.slice(0, 3).map(s => s.id));
    }
  }, [sortedCatalog, compareIds]);

  const historyGroups = useMemo(()=>groupByDate(
    [...events].filter(e=>!REMINDER_TYPES.includes(e.eventType)).sort((a,b)=>b.eventDate.localeCompare(a.eventDate))
  ),[events]);

  const nextAction = reminders[0];

  const dynamicStatus = useMemo(() => {
    if (reproStats.isPregnant) {
      return 'PREGNANT';
    }
    const statusEvents = [...events]
      .filter(e => ['PREGNANCY_CONFIRMED', 'CALF_DELIVERED', 'DRY_PERIOD_STARTED', 'LACTATION_STARTED'].includes(e.eventType))
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate));

    if (statusEvents.length === 0) {
      return herd.animalStatus;
    }

    const latest = statusEvents[0];
    if (latest.eventType === 'PREGNANCY_CONFIRMED') {
      return 'PREGNANT';
    }
    if (latest.eventType === 'CALF_DELIVERED') {
      return 'LACTATING';
    }
    if (latest.eventType === 'DRY_PERIOD_STARTED') {
      return 'DRY';
    }
    if (latest.eventType === 'LACTATION_STARTED') {
      return 'LACTATING';
    }
    return herd.animalStatus;
  }, [events, herd.animalStatus, reproStats.isPregnant]);

  const openAction = (type: string) => { setPrefillType(type); setShowAddEvent(true); };
  const deleteEvent = (id:number)=>confirm('Delete this event?',async()=>{
    try{ await api.delete(`/herds/events/${id}`); showToast('Deleted.'); onEventDeleted(id); }
    catch{ showToast('Failed.','error'); }
  },'danger');

  const statusPill: Record<string,string> = {
    LACTATING:'text-sky-700 bg-sky-100', PREGNANT:'text-violet-700 bg-violet-100',
    DRY:'text-amber-700 bg-amber-100', CALF:'text-emerald-700 bg-emerald-100', HEIFER:'text-pink-700 bg-pink-100',
  };

  const getSemenTraits = (s: SemenEntry, rankIndex: number) => {
    const breed = s.breedName.toLowerCase();
    const isHf = breed.includes('hf') || breed.includes('holstein');
    const isJersey = breed.includes('jersey');
    const isGir = breed.includes('gir');
    const isSahiwal = breed.includes('sahiwal');
    const isBuffalo = s.animalType === 'BUFFALO';

    // 1. Expected Milk & Rating
    const milkVal = s.milkPotential;
    let milkStars = 4;
    if (isHf) milkStars = 5;
    if (isSahiwal || (isBuffalo && !breed.includes('murrah'))) milkStars = 3;

    // 2. Fat % & Rating
    const fatVal = s.fat;
    let fatStars = 3;
    if (isBuffalo) fatStars = 5;
    else if (isJersey || isGir || isSahiwal) fatStars = 4;

    // 3. SNF % & Rating
    let snfVal = '8.5%';
    let snfStars = 3;
    if (isJersey || isGir) { snfVal = '9.0%'; snfStars = 4; }
    else if (isSahiwal) { snfVal = '9.1%'; snfStars = 5; }
    else if (isBuffalo) { snfVal = '9.5%'; snfStars = 5; }

    // 4. Female Calf Chance
    const femaleCalf = `${s.femaleCalfPct}%`;

    // 5. Daughter Height
    let height = 'Medium';
    if (isHf) height = 'Tall';
    if (isGir) height = 'Tall';

    // 6. Body Frame
    let frame = 'Medium';
    if (isHf) frame = 'Large';
    if (isBuffalo) frame = 'Broad';

    // 7. Calving Ease
    let calvingEase = '8/10 Easy';
    let calvingEaseColor = 'bg-amber-50 text-amber-700 border-amber-200';
    if (isJersey) { calvingEase = '9/10 Easy'; calvingEaseColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    if (isHf) { calvingEase = '7/10 Moderate'; calvingEaseColor = 'bg-blue-50 text-blue-700 border-blue-200'; }

    // 8. Heat Tolerance
    let heat = '8/10';
    if (isGir || isSahiwal || isBuffalo) heat = '9/10';
    if (isHf) heat = '6/10';

    // 9. Disease Resistance
    let disease = '8/10';
    if (isGir || isSahiwal) disease = '9/10';
    if (isHf) disease = '7/10';

    // Badge Label
    let badgeLabel = 'BALANCED';
    let badgeColor = 'text-purple-750 bg-purple-50 border-purple-200';
    if (rankIndex === 0) {
      badgeLabel = 'BEST MATCH';
      badgeColor = 'text-emerald-750 bg-emerald-50 border-emerald-200';
    } else if (rankIndex === 1) {
      badgeLabel = '2ND BEST';
      badgeColor = 'text-amber-750 bg-amber-50 border-amber-200';
    } else if (s.price < 600) {
      badgeLabel = 'VALUE OPTION';
      badgeColor = 'text-sky-750 bg-sky-50 border-sky-200';
    }

    return {
      milkVal, milkStars,
      fatVal, fatStars,
      snfVal, snfStars,
      femaleCalf, height, frame,
      calvingEase, calvingEaseColor,
      heat, disease,
      badgeLabel, badgeColor
    };
  };

  const renderStars = (count: number, colorClass: string) => {
    return (
      <div className="flex justify-center gap-0.5 mt-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={11}
            className={`${s <= count ? `${colorClass} fill-current` : 'text-slate-200'}`}
          />
        ))}
      </div>
    );
  };

    /* ─── RENDER ───────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ══ WHITE HEADER ══ */}
      <div className="bg-white border-b border-slate-200 shadow-sm relative z-30">
        {/* Back nav */}
        <div className="px-4 pt-3 pb-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-text3 hover:text-brand text-[11px] font-bold uppercase tracking-wide transition-colors">
            <ArrowLeft size={14}/> Animals
          </button>
        </div>

        {/* Identity row */}
        <div className="px-4 pb-4 flex items-start gap-4">
          {/* Animal image */}
          <button
            onClick={() => setShowGallery(true)}
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-slate-200 hover:border-emerald-500 flex-shrink-0 bg-slate-100 relative shadow-sm transition-all hover:shadow-md"
            title="View gallery"
          >
            {imgUrl
              ? <img src={imgUrl} alt={herd.animalName} onError={() => onImageError(herd.id)} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl font-bold">{(herd.animalName||herd.tagNumber).substring(0,2).toUpperCase()}</div>}
            {/* Online/health dot */}
            <div className={`absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow ${herd.healthStatus==='HEALTHY'?'bg-emerald-500':'bg-amber-500'}`}/>
          </button>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] font-bold text-slate-800 leading-tight">{herd.animalName||'Unnamed'}</h1>
              {isAdmin && (
                <button onClick={onEdit} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Edit">
                  <Edit2 size={14}/>
                </button>
              )}
            </div>

            {/* Tag number */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[12px] text-slate-500 font-mono font-medium">ID: {herd.tagNumber}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(herd.tagNumber); showToast('Tag number copied!'); }}
                className="text-slate-400 hover:text-emerald-600 transition-colors"
                title="Copy ID"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>

            {/* Status badges - clean & neutral */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
                {dynamicStatus}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
                {herd.healthStatus==='HEALTHY'?'Healthy':'Requires Attention'}
              </span>
              {reproStats.isPregnant && reproStats.gestationPct > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm">
                  {reproStats.gestationPct}% gestation · EDD {reproStats.expectedDelivery ? fmtDate(reproStats.expectedDelivery) : '—'}
                </span>
              )}
            </div>

            {/* Pending actions badge */}
            {urgentTasks.length > 0 && (
              <button
                onClick={() => setActiveTab('health')}
                className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md hover:bg-slate-50 transition-colors shadow-sm"
              >
                <AlertTriangle size={12}/> {urgentTasks.length} Pending Action{urgentTasks.length > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Actions & Gallery outside */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowGallery(true)}
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              title="View Gallery"
            >
              <ImageIcon size={14}/>
            </button>
            
            {/* Actions dropdown */}
            <ActionsMenu
              onEdit={isAdmin ? onEdit : undefined}
              onDelete={isAdmin ? onDelete : undefined}
              onAddEvent={isAdmin ? () => setShowAddEvent(true) : undefined}
            />
          </div>
        </div>
      </div>

      {/* ══ TAB BAR ══ */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex w-full">
          {([
            { id: 'overview',  label: 'Home',       icon: <Home size={18} /> },
            { id: 'breeding',  label: 'AI Service', icon: <Syringe size={18} /> },
            { id: 'health',    label: 'Health',     icon: <Heart size={18} /> },
            { id: 'history',   label: 'History',    icon: <Clock size={18} /> },
            { id: 'details',   label: 'Details',    icon: <Info size={18} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wide transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      
      <div className="flex-1">

        {/* ─── HOME / OVERVIEW ─── */}
        {activeTab==='overview' && (
          <div className="p-4 md:p-6 animate-in fade-in duration-200">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* LEFT: Animal Info Panel (Main Focus) */}
                <div className="lg:col-span-2 space-y-5">
                  <AnimalInfoPanel herd={herd} events={events} reproStats={reproStats} onEdit={isAdmin ? onEdit : undefined}/>
                  
                  {/* Services grid moved to overview left side */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h2 className="text-[12px] font-bold text-slate-600 uppercase tracking-wide mb-4">Quick Services</h2>
                    <div className="grid grid-cols-4 gap-2">
                      <ServiceBtn icon={Syringe}     label="AI Service"  sub="Book"         color="text-slate-600" bg="bg-slate-50"  onClick={() => setActiveTab('breeding')}/>
                      <ServiceBtn icon={Pill}        label="Treatment"   sub="Record"        color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('TREATMENT')}/>
                      <ServiceBtn icon={Baby}        label="Calving"     sub="Record"        color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('CALF_DELIVERED')}/>
                      <ServiceBtn icon={ShieldCheck} label="Vaccine"     sub="Record"        color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('VACCINATION_DONE')}/>
                      <ServiceBtn icon={Microscope}  label="PD Check"    sub="Pregnancy"     color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('PREGNANCY_CONFIRMED')}/>
                      <ServiceBtn icon={Bug}         label="Deworming"   sub="Record"        color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('DEWORMING_DONE')}/>
                      <ServiceBtn icon={Leaf}        label="Dry Period"  sub="Start"         color="text-slate-600" bg="bg-slate-50"  onClick={() => openAction('DRY_PERIOD_STARTED')}/>
                      <ServiceBtn icon={Plus}        label="Log Event"   sub="Custom"        color="text-slate-600" bg="bg-slate-50"  onClick={() => setShowAddEvent(true)}/>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Action Required */}
                <div className="space-y-4">
                  <ActionRequiredPanel
                    reminders={reminders}
                    onOpenAction={openAction}
                    onViewAll={() => setActiveTab('health')}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── AI BREEDING SERVICE ─── */}
        {activeTab==='breeding' && (
          <div className="animate-in fade-in duration-200 pb-8">
            {/* Loading */}
            {catalogLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"/>
                <span className="text-[12px] font-bold text-slate-400">Loading AI Recommendations…</span>
              </div>
            )}

            {!catalogLoading && sortedCatalog.length > 0 && (() => {
              const best = sortedCatalog[0];
              const others = sortedCatalog.slice(1);
              const bens = Array.isArray(best.benefits) ? best.benefits as string[] : (best.benefits as string).split(',').map(b=>b.trim());

              const strawMap: Record<string,string> = {
                '#3B82F6':'/semen/straw-blue.png','#F59E0B':'/semen/straw-yellow.png',
                '#EF4444':'/semen/straw-red.png','#8B5CF6':'/semen/straw-purple.png',
                '#10B981':'/semen/straw-green.png','#0EA5E9':'/semen/straw-blue.png',
                '#F97316':'/semen/straw-yellow.png',
              };
              const getStraw = (s: SemenEntry) => s.strawImage || strawMap[s.colorHex] || '/semen/straw-blue.png';

              const calfMap: Record<string,string> = {
                'hf-elite':'/semen/calf-hf.png','hf-power':'/semen/calf-hf.png',
                'jersey-fat':'/semen/calf-jersey.png','gir-a2':'/semen/calf-gir.png',
                'sahiwal-pure':'/semen/calf-sahiwal.png',
              };
              const getCalf = (s: SemenEntry) => s.calfImage || calfMap[s.id] || '/semen/calf-hf.png';

              return (
                <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6 p-4 max-w-6xl mx-auto bg-white">
                  
                  {/* ═══ LEFT COL: AI RECOMMENDATION ═══ */}
                  <div className="lg:col-span-3 bg-[#f8fbf9] border border-[#eef2f0] rounded-2xl p-5 shadow-sm">
                    <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-emerald-50 mb-6 shadow-sm">
                      <span className="text-[14px]">✨</span>
                      <span className="text-[12px] font-bold text-[#064e3b] uppercase tracking-wider">AI Recommendation for {herd.animalName}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                           <h2 className="text-[32px] font-bold text-[#064e3b] leading-none">{best.breedName}</h2>
                           <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm" title="Semen Straw Color Code">
                              <img src={getStraw(best)} alt={best.colorLabel} className="h-4 object-contain"/>
                              <span className="text-[9px] font-bold" style={{color: best.colorHex}}>{best.colorLabel}</span>
                           </div>
                        </div>
                        <div className="mb-6 flex justify-between items-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#059669] px-3 py-1 rounded-full uppercase tracking-wide shadow-sm">
                            <Star size={12} className="fill-white"/> Best Match
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer px-2.5 py-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={compareIds.includes(best.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (compareIds.length >= 4) { showToast('You can compare a maximum of 4 options.', 'warning'); return; }
                                  setCompareIds(prev => [...prev, best.id]);
                                } else {
                                  setCompareIds(prev => prev.filter(id => id !== best.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-[#064e3b] focus:ring-[#064e3b] cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">Compare</span>
                          </label>
                        </div>

                        <p className="text-[14px] font-bold text-slate-800 mb-3">Why this is best for {herd.animalName}?</p>
                        <div className="space-y-2.5">
                          {bens.map(b => (
                            <div key={b} className="flex items-start gap-2.5">
                              <div className="mt-0.5 rounded-full bg-emerald-100 p-0.5 text-emerald-600 flex-shrink-0">
                                <CheckCircle size={14} strokeWidth={3}/>
                              </div>
                              <span className="text-[13px] font-semibold text-[#334155] leading-tight">{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative rounded-2xl overflow-hidden bg-emerald-50 h-64 md:h-auto border border-emerald-100">
                        <img
                          src={getCalf(best)}
                          alt={`${best.breedName} expected daughter`}
                          className="w-full h-full object-cover object-center"
                          onError={e => { (e.target as HTMLImageElement).src='/semen/calf-hf.png'; }}
                        />
                        <div className="absolute top-3 left-0 right-0 flex justify-center">
                          <span className="text-[10px] font-bold text-[#064e3b] bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full uppercase tracking-wide shadow-sm">
                            Expected Daughter
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-6">
                      {[
                        { icon:'♀', label:'Female Calf', value:`${best.femaleCalfPct}%`, color:'text-rose-500' },
                        { icon:<Droplets size={16}/>, label:'Expected Milk', value:best.milkPotential, color:'text-sky-500' },
                        { icon:'💧', label:'Fat %', value:best.fat, color:'text-amber-500' },
                        { icon:'⚖️', label:'Adult Weight', value:'500 kg+', color:'text-emerald-600' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl p-3 flex flex-col items-center justify-center border border-[#eef2f0] shadow-sm">
                          <div className={`text-[18px] mb-1.5 ${stat.color}`}>{stat.icon}</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">{stat.label}</div>
                          <div className="text-[16px] font-bold text-[#0f172a]">{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={() => setSelectedSemen(best)}
                        className="flex-1 py-4 rounded-xl font-bold text-[15px] uppercase tracking-wide text-[#064e3b] border-2 border-[#064e3b] hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => openAction('SEMEN_GIVEN')}
                        className="flex-1 py-4 rounded-xl font-bold text-[15px] uppercase tracking-wide text-white shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-[#064e3b]/90"
                      >
                        Proceed <ChevronRight size={18}/>
                      </button>
                    </div>

                    <button
                      onClick={() => setShowCompare(true)}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-brand hover:text-brand font-bold text-[11px] uppercase tracking-wide transition-all"
                    >
                      Compare All Options ({sortedCatalog.length})
                    </button>
                  </div>

                  {/* ═══ RIGHT COL ═══ */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-[#f8fbf9] border border-[#eef2f0] rounded-2xl p-4 shadow-sm">
                      <h3 className="text-[11px] font-bold text-[#064e3b] uppercase tracking-wide mb-3">Other Options</h3>
                      <div className="space-y-3">
                        {others.slice(0,4).map((s,idx) => {
                          return (
                            <div key={s.id} className="bg-white rounded-xl p-3 border border-[#eef2f0] shadow-sm flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${s.colorHex}20`}}>
                                <span className="text-[14px]">💉</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-bold text-slate-800 truncate">{s.breedName}</div>
                                <div className="text-[10px] text-slate-400 font-bold">{s.milkPotential} · ₹{s.price}</div>
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <button onClick={() => setSelectedSemen(s)} className="px-2 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all">View</button>
                                <button onClick={() => openAction('SEMEN_GIVEN')} className="px-2 py-1.5 bg-brand text-white rounded-lg text-[10px] font-bold hover:bg-brand-dark transition-all">Book</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {others.length > 4 && (
                        <button onClick={() => setShowSemenSelection(true)} className="mt-3 w-full text-[11px] font-bold text-brand uppercase tracking-wide hover:underline">
                          View all {sortedCatalog.length} options →
                        </button>
                      )}
                    </div>

                    {/* Breeding stats */}
                    <div className="bg-[#f8fbf9] border border-[#eef2f0] rounded-2xl p-4 shadow-sm">
                      <h3 className="text-[11px] font-bold text-[#064e3b] uppercase tracking-wide mb-3">Breeding History</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Total AI', value: events.filter(e => e.eventType==='SEMEN_GIVEN').length, color: 'text-violet-700', bg: 'bg-violet-50' },
                          { label: 'Confirmed PD', value: events.filter(e => e.eventType==='PREGNANCY_CONFIRMED').length, color: 'text-pink-700', bg: 'bg-pink-50' },
                          { label: 'Calvings', value: reproStats.calvingCount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                          { label: 'Parity', value: `${reproStats.calvingCount}${reproStats.calvingCount===1?'st':reproStats.calvingCount===2?'nd':reproStats.calvingCount===3?'rd':'th'}`, color: 'text-amber-700', bg: 'bg-amber-50' },
                        ].map(s => (
                          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border border-transparent`}>
                            <div className={`text-[20px] font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!catalogLoading && sortedCatalog.length === 0 && (
              <div className="text-center py-16 text-slate-400 font-bold">No semen catalog available for this animal type.</div>
            )}
          </div>
        )}

        {/* ─── HEALTH TAB ─── */}
        {activeTab==='health' && (
          <div className="p-4 space-y-5 max-w-2xl mx-auto animate-in fade-in duration-200">
            {reminders.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Scheduled Tasks</h2>
                <div className="space-y-3">
                  {reminders.map(r => {
                    const cfg=EV[r.eventType]||DEF_EV; const Icon=cfg.icon; const days=daysFromNow(r.eventDate);
                    const overdue=days<0; const urgent=days>=0&&days<=7;
                    return(
                      <div key={r.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100">
                            <Icon size={18} className="text-slate-500"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-slate-800">{r.title}</div>
                            <div className={`text-[12px] font-bold mt-0.5 ${overdue?'text-red-600':urgent?'text-amber-600':'text-slate-500'}`}>
                              {overdue?`⚠ Overdue by ${Math.abs(days)} day${Math.abs(days)>1?'s':''}`:
                               days===0?'🔴 Due Today':
                               days<=3?`⚡ Due in ${days} days`:
                               `📅 Due in ${days} days`}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(r.eventDate)}</div>
                          </div>
                          {isAdmin&&(
                            <button onClick={() => confirm('Delete?', async () => { try { await api.delete(`/herds/events/${r.id}`); onEventDeleted(r.id); showToast('Deleted.'); } catch { showToast('Failed.','error'); } }, 'danger')}
                              className="p-2 text-red-300 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all flex-shrink-0">
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>
                        {r.details&&<div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">{r.details}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Record Health Event</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {type:'VACCINATION_DONE',label:'Vaccination Done',sub:'Mark completed',icon:ShieldCheck,color:'text-teal-700',bg:'bg-teal-50'},
                  {type:'DEWORMING_DONE',label:'Deworming Done',sub:'Mark completed',icon:Bug,color:'text-orange-700',bg:'bg-orange-50'},
                  {type:'TREATMENT',label:'Treatment',sub:'Record medication',icon:Pill,color:'text-red-700',bg:'bg-red-50'},
                  {type:'VACCINATION_DUE',label:'Schedule Vaccine',sub:'Set reminder date',icon:Clock,color:'text-teal-600',bg:'bg-teal-50'},
                  {type:'DEWORMING_DUE',label:'Schedule Deworm',sub:'Set reminder date',icon:Clock,color:'text-orange-600',bg:'bg-orange-50'},
                  {type:'PREGNANCY_CHECK_DUE',label:'Schedule PD Check',sub:'Set reminder date',icon:Microscope,color:'text-indigo-700',bg:'bg-indigo-50'},
                ].map(a=>(
                  <button key={a.type} onClick={()=>openAction(a.type)}
                    className={`flex items-start gap-3 p-4 rounded-2xl ${a.bg} border-2 border-transparent active:scale-[0.97] transition-all text-left`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color.replace('text-','bg-').replace('-700','-100').replace('-600','-100')}`}>
                      <a.icon size={18} className={a.color}/>
                    </div>
                    <div>
                      <div className={`text-[12px] font-bold ${a.color}`}>{a.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{a.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {activeTab==='history' && (
          <div className="p-4 md:p-6 animate-in fade-in duration-200">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">Events Timeline</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{events.filter(e => !REMINDER_TYPES.includes(e.eventType)).length} events recorded</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddEvent(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Plus size={12}/> Add Event
                    </button>
                  )}
                </div>

                {loadingEvents ? (
                  <div className="py-12 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
                    <span className="text-[12px] text-slate-500">Loading...</span>
                  </div>
                ) : events.filter(e => !REMINDER_TYPES.includes(e.eventType)).length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <Activity size={32} className="text-slate-300 mx-auto mb-2"/>
                    <p className="text-[13px] font-bold text-slate-400">No events recorded yet</p>
                    {isAdmin && <button onClick={() => setShowAddEvent(true)} className="mt-2 text-[12px] text-emerald-600 font-bold">+ Add first event</button>}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {events.filter(e => !REMINDER_TYPES.includes(e.eventType)).map(e => (
                      <TimelineRow key={e.id} event={e} canDelete={isAdmin} onDelete={() => deleteEvent(e.id)}/>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── DETAILS TAB ─── */}
        {activeTab==='details' && (
          <div className="p-4 space-y-4 max-w-2xl mx-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-700">Animal Profile</h3>
                {isAdmin&&<button onClick={onEdit} className="flex items-center gap-1.5 text-brand text-[11px] font-bold uppercase tracking-wider hover:text-brand-dark"><Edit2 size={13}/> Edit</button>}
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  {l:'Name',v:herd.animalName||'—'},{l:'Tag No.',v:herd.tagNumber||'—'},
                  {l:'Breed',v:`${herd.breed||'—'}${herd.milkType&&herd.milkType!=='N/A'?` (${herd.milkType})`:''}`},
                  {l:'Type',v:herd.animalType||'—'},{l:'Age',v:herd.age||'—'},
                  {l:'Birth Date',v:herd.birthDate?fmtDate(herd.birthDate):'—'},
                  {l:'Procured',v:herd.procuredDate?fmtDate(herd.procuredDate):'—'},
                  {l:'Source',v:herd.source||'—'},{l:'Health',v:herd.healthStatus||'—'},
                  {l:'Status',v:herd.animalStatus||'—'},{l:'Record',v:herd.status||'ACTIVE'},
                ].map(({l,v})=>(
                  <div key={l} className="flex items-center px-5 py-3.5">
                    <span className="w-28 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">{l}</span>
                    <span className="text-[13px] font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {isAdmin&&(
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
                <h3 className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-3">⚠ Danger Zone</h3>
                <button onClick={onDelete} className="w-full py-3.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[12px] uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Trash2 size={14}/> Delete Animal Record
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAddEvent&&(
        <AddEventModal herd={herd} prefill={prefillType} onClose={()=>{setShowAddEvent(false);setPrefillType(undefined);}} onSaved={evt=>{onEventAdded(evt);setShowAddEvent(false);setPrefillType(undefined);}}/>
      )}

      {/* ─── SEMEN SELECTION MODAL ─── */}
      {showSemenSelection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-50 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-slate-200">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 uppercase">Select Semen</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{sortedCatalog.length} options for {herd.animalName}</p>
              </div>
              <button onClick={() => setShowSemenSelection(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {catalogLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"/>
                  <span className="text-[11px] font-bold text-slate-400">Loading catalog…</span>
                </div>
              ) : sortedCatalog.length > 0 ? (
                sortedCatalog.map((s, idx) => {
                  const isBest = s.id === recommendedOrder[0];
                  return (
                    <div key={s.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${isBest ? 'border-emerald-500 shadow-emerald-100' : 'border-slate-100'}`}>
                      {isBest && (
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-bold text-white bg-emerald-500 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1"><Star size={12}/> Auto-Recommended</span>
                        </div>
                      )}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <div className="relative w-16 h-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-2">
                             <img src={s.strawImage || `/semen/straw-blue.png`} alt={s.colorLabel} className="h-full object-contain drop-shadow-md" style={{ filter: `drop-shadow(0 4px 6px ${s.colorHex}60)` }} />
                             <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: s.colorHex }} />
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-wide">{s.colorLabel}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-[15px] font-bold text-slate-800 leading-tight">{s.breedName}</h4>
                              <p className="text-[11px] font-bold text-slate-400 mt-0.5">Bull ID: {s.bullId}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-[15px] font-bold text-slate-800">₹{s.price}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase">per straw</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100/50">
                              <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">Success Rate</div>
                              <div className="text-[13px] font-bold text-emerald-800">{s.successRate}%</div>
                            </div>
                            <div className="bg-sky-50 rounded-lg p-2 border border-sky-100/50">
                              <div className="text-[9px] font-bold text-sky-600 uppercase tracking-wide mb-0.5">Milk Potential</div>
                              <div className="text-[13px] font-bold text-sky-800">{s.milkPotential}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                         <button onClick={() => { setShowSemenSelection(false); setSelectedSemen(s); }} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider active:scale-[0.97] transition-all">View Details</button>
                         <button onClick={() => { setShowSemenSelection(false); openAction('SEMEN_GIVEN'); }} className={`flex-1 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider text-white shadow-md active:scale-[0.97] transition-all ${isBest ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand hover:bg-brand-dark'}`}>Book AI</button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-slate-500 text-[13px] font-bold">No semen catalog available.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Semen Details Modal */}
      {selectedSemen && (
        <SemenDetailsModal
          semen={selectedSemen}
          onClose={() => setSelectedSemen(null)}
          onBook={() => { setSelectedSemen(null); openAction('SEMEN_GIVEN'); }}
        />
      )}

      {/* ─── GALLERY MODAL ─── */}
      {showGallery && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[5000] flex flex-col md:flex-row animate-in fade-in duration-300">

          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden bg-black/60 shadow-2xl border border-white/5 flex items-center justify-center relative group">
              {mediaGallery[activeMedia].type === 'video' ? (
                <video key={mediaGallery[activeMedia].url} src={mediaGallery[activeMedia].url} controls autoPlay className="w-full h-full object-contain"/>
              ) : (
                <img src={mediaGallery[activeMedia].url} alt={mediaGallery[activeMedia].title} className="w-full h-full object-contain"/>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">{mediaGallery[activeMedia].type.toUpperCase()}</span>
                <h4 className="text-[16px] font-bold text-white mt-1">{mediaGallery[activeMedia].title}</h4>
              </div>
            </div>
          </div>
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-slate-900/50 p-4 md:p-6 flex flex-col gap-4 overflow-y-auto max-h-[40vh] md:max-h-screen">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[16px] font-bold text-white uppercase tracking-wider">{herd.animalName || 'Unnamed'}'s Gallery</h3>
                <p className="text-[11px] text-white/50 mt-1 uppercase font-bold">{herd.breed} · {herd.tagNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <label className="flex items-center justify-center w-8 h-8 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors cursor-pointer flex-shrink-0" title="Add Media">
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { 
                      if (e.target.files?.length) {
                        const newFiles = Array.from(e.target.files).map(file => ({
                          type: file.type.startsWith('video/') ? 'video' : 'image',
                          url: URL.createObjectURL(file),
                          title: file.name
                        }));
                        setUploadedMedia(prev => [...prev, ...newFiles]);
                        showToast(`Added ${e.target.files.length} media item(s) to gallery`);
                      }
                      e.target.value = '';
                    }} />
                    <Plus size={16} />
                  </label>
                )}
                <button
                  onClick={() => setShowGallery(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all shadow-sm border border-white/10 flex-shrink-0"
                  title="Close Gallery"
                >
                  <XCircle size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-1 gap-3 flex-1">
              {mediaGallery.map((item, idx) => (
                <button key={idx} onClick={() => setActiveMedia(idx)}
                  className={`relative aspect-video rounded-xl overflow-hidden text-left border-2 transition-all ${activeMedia === idx ? 'border-emerald-500 scale-[1.02]' : 'border-white/10 hover:border-white/30'}`}>
                  <img src={item.type === 'video' ? item.thumbnail : item.url} alt={item.title} className="w-full h-full object-cover"/>
                  {item.type === 'video' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/30">▶</div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[8.5px] font-bold text-white truncate">{item.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── DETAILED COMPARISON MODAL ─── */}
      {showCompare && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowCompare(false)} />
          <div className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh] max-h-[680px] animate-in zoom-in-95 duration-200 z-10 border border-slate-200">
            <div className="px-6 py-3.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
              <div>
                <h3 className="text-[16px] font-bold text-white uppercase tracking-wider font-serif">Detailed Comparison</h3>
                <p className="text-[10px] text-emerald-100/80 mt-0.5">Compare dairy traits, success rate, SNF%, and heat tolerances between semen straws.</p>
              </div>
              <button onClick={() => setShowCompare(false)} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all">
                <XCircle size={20} />
              </button>
            </div>

            <div className="bg-slate-50 px-6 py-2 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Breed:</span>
                {['ALL', 'HF', 'GIR', 'SAHIWAL', 'JERSEY', 'BUFFALO'].map((cat) => (
                  <button key={cat} onClick={() => setSelectedBreedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-wide border transition-all ${selectedBreedCategory === cat ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-slate-650 border-slate-200 hover:border-slate-350'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-sm w-full">
                <div className="relative flex-1">
                  <input type="text" value={searchSemenQuery} onChange={(e) => setSearchSemenQuery(e.target.value)} placeholder="Search by name, ID or code..."
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand"/>
                  {searchSemenQuery && <button onClick={() => setSearchSemenQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650">✕</button>}
                </div>
              </div>
            </div>

            <div className="bg-white px-6 py-2 border-b border-slate-100 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wide">Available for Comparison ({filteredCatalogForCompare.length} found · Max 4 selected)</span>
                {compareIds.length > 0 && <button onClick={() => setCompareIds([])} className="text-[9px] font-bold text-red-600 hover:text-red-800 uppercase tracking-wider">Clear All</button>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar">
                {filteredCatalogForCompare.length === 0 ? (
                  <span className="text-[11px] font-bold text-slate-400 py-1">No matching semen options found.</span>
                ) : filteredCatalogForCompare.map((s) => {
                  const isChecked = compareIds.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => {
                      if (isChecked) { setCompareIds(prev => prev.filter(id => id !== s.id)); }
                      else { if (compareIds.length >= 4) { showToast('You can compare a maximum of 4 options.', 'warning'); return; } setCompareIds(prev => [...prev, s.id]); }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-2 flex-shrink-0 text-left ${isChecked ? 'bg-brand/10 text-brand border-brand/40 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-brand border-brand text-white' : 'bg-white border-slate-300'}`}>
                        {isChecked ? <span className="text-[8px] font-bold leading-none">✓</span> : <span className="text-[9px] font-bold leading-none text-slate-400">+</span>}
                      </div>
                      <div>
                        <div className="text-[11px] font-extrabold leading-tight">{s.breedName}</div>
                        <div className="text-[8.5px] font-semibold text-slate-500 mt-0.5 font-mono">{s.semenCode} · ₹{s.price}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-6 custom-scrollbar">
              {compareIds.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold text-[14px]">No semen options selected. Choose options from the bar above to start comparing.</div>
              ) : (
                <table className="w-full min-w-[700px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-1/5">Traits</th>
                      {compareIds.map((id) => {
                        const s = sortedCatalog.find(x => x.id === id);
                        if (!s) return null;
                        const rank = recommendedOrder.indexOf(s.id);
                        const tr = getSemenTraits(s, rank);
                        return (
                          <th key={id} className="py-2 px-3 text-center w-1/5 relative group">
                            <button onClick={() => setCompareIds(prev => prev.filter(x => x !== id))} className="absolute top-1.5 right-1.5 text-slate-300 hover:text-red-500 transition-colors p-1" title="Remove from comparison"><XCircle size={13} /></button>
                            <div className="text-[12px] font-bold text-slate-800 leading-tight">{s.breedName}</div>
                            <span className={`inline-block text-[7.5px] font-bold tracking-widest px-2 py-0.5 rounded border mt-1 uppercase ${s.id === recommendedOrder[0] ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-100 border-slate-200'}`}>
                              {s.id === recommendedOrder[0] ? 'BEST MATCH' : tr.badgeLabel}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11.5px]">
                    {[
                      { key: 'milk', label: 'Expected Milk', desc: '(Litres / day)' },
                      { key: 'fat', label: 'Fat %', desc: '' },
                      { key: 'snf', label: 'SNF %', desc: '' },
                      { key: 'femaleCalf', label: 'Female Calf Chance', desc: '' },
                      { key: 'height', label: 'Daughter Height', desc: '' },
                      { key: 'frame', label: 'Body Frame', desc: '' },
                      { key: 'calving', label: 'Calving Ease', desc: '' },
                      { key: 'heat', label: 'Heat Tolerance', desc: '' },
                      { key: 'disease', label: 'Disease Resistance', desc: '' },
                      { key: 'price', label: 'Price / Straw', desc: '' },
                    ].map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 pr-3 font-bold text-slate-800">
                          <div className="flex flex-col">
                            <span className="text-[11.5px] font-bold text-slate-855">{row.label}</span>
                            {row.desc && <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5">{row.desc}</span>}
                          </div>
                        </td>
                        {compareIds.map((id) => {
                          const s = sortedCatalog.find(x => x.id === id);
                          if (!s) return null;
                          const rank = recommendedOrder.indexOf(s.id);
                          const tr = getSemenTraits(s, rank);
                          if (row.key === 'milk') return <td key={id} className="py-2 px-3 text-center font-bold text-slate-700"><div>{tr.milkVal}</div>{renderStars(tr.milkStars, 'text-amber-500')}</td>;
                          if (row.key === 'fat') return <td key={id} className="py-2 px-3 text-center font-bold text-slate-700"><div>{tr.fatVal}</div>{renderStars(tr.fatStars, 'text-amber-500')}</td>;
                          if (row.key === 'snf') return <td key={id} className="py-2 px-3 text-center font-bold text-slate-700"><div>{tr.snfVal}</div>{renderStars(tr.snfStars, 'text-amber-500')}</td>;
                          if (row.key === 'femaleCalf') return <td key={id} className="py-2 px-3 text-center font-extrabold text-slate-700"><span>{tr.femaleCalf}</span></td>;
                          if (row.key === 'height') return <td key={id} className="py-2 px-3 text-center font-extrabold text-slate-700"><span>{tr.height}</span></td>;
                          if (row.key === 'frame') return <td key={id} className="py-2 px-3 text-center font-extrabold text-slate-700"><span>{tr.frame}</span></td>;
                          if (row.key === 'calving') return <td key={id} className="py-2 px-3 text-center font-extrabold"><span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">{tr.calvingEase}</span></td>;
                          if (row.key === 'heat') return <td key={id} className="py-2 px-3 text-center font-extrabold text-slate-700"><span>{tr.heat}</span></td>;
                          if (row.key === 'disease') return <td key={id} className="py-4 px-4 text-center font-extrabold text-slate-700"><span>{tr.disease}</span></td>;
                          if (row.key === 'price') return <td key={id} className="py-4 px-4 text-center font-bold text-slate-800 text-[14px]"><span>₹{s.price}</span></td>;
                          return null;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
