'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import {
  Plus, X, Activity, Calendar, Trash2, Edit2, Archive, Clock,
  CheckCircle, AlertTriangle, Syringe, Baby, Droplets, Leaf,
  ChevronRight, ShieldCheck, Heart, TrendingUp, AlarmClock,
  PlusCircle, Info, ShieldAlert, AlertCircle, Egg, Bird
} from 'lucide-react';
import RegisterAnimalModal from '@/components/RegisterAnimalModal';
import AnimalWorkspace from '@/components/AnimalWorkspace';
import PoultryWorkspace from '@/components/PoultryWorkspace';
import BatchIcon from '@/components/BatchIcon';
import { BATCH_TYPES, batchType, isPoultryType, liveBirds } from '@/lib/poultry';
import { DIM_STAGES, DIM_GRADIENT, dimStage } from '@/lib/dimStages';
import { useNotification } from '@/components/NotificationContext';
import { BcsBadge, BcsPickerModal, bcsTodayIso } from '@/components/BcsPicker';
import { bullIdOf as bullIdFromDetails, notesOf, withBullId, PD_AFTER_AI_DAYS } from '@/lib/breeding';

interface Herd {
  id: number;
  tagNumber: string;
  animalType: string;
  animalName: string;
  breed: string;
  milkType: string;
  healthStatus: string;
  source: string;
  birthDate: string;
  procuredDate: string;
  animalStatus: string;
  status: string;
  age: string;
  calculatedAge?: string;
  imageUrl?: string;
  heartGirth?: number;
  avgMilk30Days?: number;
  milkPotential?: number;
  milkPotentialConfidence?: string;
  lactationNumber?: number;
  calculatedWeight?: number;
  weightStatus?: string;
  bcs?: number | null;
  bcsDate?: string | null;
  birdCount?: number;
  purpose?: string;
  lastDewormingDate?: string | null;
  nextDewormingDate?: string | null;
  nextDewormingDose?: number | null;
}

interface HerdEvent {
  id: number;
  herdId: number;
  eventDate: string;
  eventType: string;
  title: string;
  details?: string;
  quantity?: number | null;
  createdAt: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  SEMEN_GIVEN:         { icon: Syringe,       color: 'text-purple-600',  bg: 'bg-purple-100',  label: 'AI / Semen' },
  PREGNANCY_CONFIRMED: { icon: Heart,          color: 'text-pink-600',    bg: 'bg-pink-100',    label: 'Pregnancy' },
  CALF_DELIVERED:      { icon: Baby,           color: 'text-green-600',   bg: 'bg-green-100',   label: 'Calving' },
  DRY_PERIOD_STARTED:  { icon: Leaf,           color: 'text-amber-600',   bg: 'bg-amber-100',   label: 'Dry Period' },
  LACTATION_STARTED:   { icon: Droplets,       color: 'text-blue-600',    bg: 'bg-blue-100',    label: 'Lactation' },
  VACCINATION_DUE:     { icon: ShieldCheck,    color: 'text-teal-600',    bg: 'bg-teal-100',    label: 'Vaccination' },
  DEWORMED:            { icon: CheckCircle,    color: 'text-green-600',   bg: 'bg-green-100',   label: 'Dewormed' },
  DEWORMING_DUE:       { icon: AlarmClock,     color: 'text-orange-600',  bg: 'bg-orange-100',  label: 'Deworming' },
  PREGNANCY_CHECK_DUE: { icon: CheckCircle,    color: 'text-indigo-600',  bg: 'bg-indigo-100',  label: 'PD Check' },
};

const REMINDER_TYPES = ['VACCINATION_DUE', 'DEWORMING_DUE', 'PREGNANCY_CHECK_DUE'];

/** Groups of figures the phone table view can show, one group at a time. */
type PhoneGroup = 'milk' | 'breeding' | 'weight' | 'health' | 'next';
const PHONE_GROUPS: { key: PhoneGroup; label: string }[] = [
  { key: 'milk', label: 'Milk' },
  { key: 'breeding', label: 'Breeding' },
  { key: 'weight', label: 'Weight' },
  { key: 'health', label: 'Health' },
  { key: 'next', label: 'Next event' },
];

/** "26 Oct" for an ISO date; the year is left out to fit a phone column. */
const shortDate = (iso?: string | null) =>
  iso && iso !== '—' ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';


export default function HerdsPage() {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHerd, setSelectedHerd] = useState<Herd | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDisposedModal, setShowDisposedModal] = useState(false);
  const [showAllEventsModal, setShowAllEventsModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  // Table view on phones: one group of figures at a time instead of a 15-column sideways scroll.
  const [phoneGroup, setPhoneGroup] = useState<PhoneGroup>('milk');
  const [bcsTarget, setBcsTarget] = useState<Herd | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBreedingModal, setShowBreedingModal] = useState(false);
  const { showToast, confirm } = useNotification();

  // Events & Timeline
  const [events, setEvents] = useState<HerdEvent[]>([]);
  const [allGlobalEvents, setAllGlobalEvents] = useState<HerdEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'breeding' | 'health' | 'history' | 'details'>('overview');

  // Add Event Modal
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventType, setEventType] = useState('SEMEN_GIVEN');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTitle, setEventTitle] = useState('Semen Given (AI)');
  const [eventDetailsText, setEventDetailsText] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try { setUserRole(JSON.parse(userStr).role || ''); } catch {}
      }
    }
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      SEMEN_GIVEN: 'Semen Given (AI)',
      PREGNANCY_CONFIRMED: 'Pregnancy Confirmed (PD)',
      CALF_DELIVERED: 'Calf Delivered',
      DRY_PERIOD_STARTED: 'Dry Period Started',
      LACTATION_STARTED: 'Lactation Started',
      VACCINATION_DUE: 'Vaccination Due',
      DEWORMED: 'Deworming Done',
      DEWORMING_DUE: 'Deworming Due',
      PREGNANCY_CHECK_DUE: 'Pregnancy Check Due',
    };
    setEventTitle(titles[eventType] || eventType);
  }, [eventType]);

  useEffect(() => { fetchHerds(); }, []);

  const fetchHerds = async () => {
    try {
      const res = await api.get('/herds');
      setHerds(res.data.herds || []);
      const eventsRes = await api.get('/herds/events/all');
      setAllGlobalEvents(eventsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Body Condition Score: show the new score at once, roll back if the save fails
  const saveBcs = async (herd: Herd, bcs: number | null) => {
    setBcsTarget(null);
    const prev = { bcs: herd.bcs, bcsDate: herd.bcsDate };
    setHerds(hs => hs.map(h => h.id === herd.id ? { ...h, bcs } : h));
    try {
      const res = await api.patch(`/herds/${herd.id}/bcs`, { bcs });
      // Removing today's score falls back to the previous reading
      setHerds(hs => hs.map(h => h.id === herd.id ? { ...h, bcs: res.data.bcs, bcsDate: res.data.bcsDate } : h));
      api.get('/herds/events/all').then(r => setAllGlobalEvents(r.data || [])).catch(console.error);
    } catch {
      setHerds(hs => hs.map(h => h.id === herd.id ? { ...h, ...prev } : h));
      showToast('Failed to save BCS.', 'error');
    }
  };

  const handleDeleteHerd = (id: number) => {
    const target = herds.find(h => h.id === id);
    const isBatch = isPoultryType(target?.animalType);
    confirm(isBatch
      ? 'Delete this poultry batch with all its death and egg records? This cannot be undone.'
      : 'Are you sure you want to permanently delete this animal record?', async () => {
      try {
        await api.delete(`/herds/${id}`);
        showToast(isBatch ? 'Batch deleted' : 'Animal record deleted successfully!');
        setShowModal(false);
        fetchHerds();
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to delete animal record.', 'error');
      }
    }, 'danger');
  };

  const toggleExpand = (type: string) =>
    setExpandedRows(prev => ({ ...prev, [type]: !prev[type] }));

  const getAnimalColor = (herd: Herd) => {
    if (herd.animalType === 'COW') {
      if (herd.milkType === 'A2') return 'bg-[#FFB703]';
      if (herd.milkType === 'A1') return 'bg-[#7B2CBF]';
      return 'bg-[#FFFACD]';
    }
    if (herd.animalType === 'BUFFALO') return 'bg-[#808080]';
    if (herd.animalType === 'GOAT') return 'bg-[#FFD166]';
    return 'bg-[#BDE0FE]';
  };

  const handleHerdClick = async (id: number) => {
    try {
      const res = await api.get(`/herds/${id}`);
      setSelectedHerd(res.data);
      setActiveTab('overview');
      setShowModal(true);
      setLoadingEvents(true);
      const eventsRes = await api.get(`/herds/${id}/events`);
      setEvents(eventsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingEvents(false); }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHerd) return;
    try {
      const res = await api.post(`/herds/${selectedHerd.id}/events`, {
        eventDate, eventType, title: eventTitle, details: eventDetailsText,
      });
      showToast('Event added successfully!');
      setEvents(prev => [res.data, ...prev]);
      setShowAddEventModal(false);
      setEventDetailsText('');
    } catch (err: any) {
      showToast('Failed to add event.', 'error');
    }
  };

  const handleDeleteEvent = (id: number) => {
    confirm('Are you sure you want to delete this event from the timeline?', async () => {
      try {
        await api.delete(`/herds/events/${id}`);
        showToast('Event deleted successfully!');
        setEvents(prev => prev.filter(e => e.id !== id));
      } catch (err: any) {
        showToast('Failed to delete event.', 'error');
      }
    }, 'danger');
  };

  const getReproductionStats = () => {
    if (!selectedHerd) return { lastAi: null, isPregnant: false, daysPregnant: 0, expectedDelivery: null, aiAttempts: 0, gestationPct: 0 };
    const aiEvents   = events.filter(e => e.eventType === 'SEMEN_GIVEN');
    const pdEvents   = events.filter(e => e.eventType === 'PREGNANCY_CONFIRMED');
    const calvEvents = events.filter(e => e.eventType === 'CALF_DELIVERED');

    const lastAi      = aiEvents[0]?.eventDate ?? null;
    const lastPd      = pdEvents[0]?.eventDate ?? null;
    const lastCalving = calvEvents[0]?.eventDate ?? null;

    let isPregnant = false, daysPregnant = 0, gestationPct = 0, expectedDelivery: string | null = null;
    if (lastPd && (!lastCalving || new Date(lastPd) > new Date(lastCalving))) {
      isPregnant = true;
      if (lastAi) {
        daysPregnant = Math.ceil((Date.now() - new Date(lastAi).getTime()) / 86400000);
        const gestation = selectedHerd.animalType === 'BUFFALO' ? 310 : 283;
        gestationPct    = Math.min(100, Math.round((daysPregnant / gestation) * 100));
        const d = new Date(lastAi);
        d.setDate(d.getDate() + gestation);
        expectedDelivery = d.toISOString().split('T')[0];
      }
    }

    let aiAttempts = lastCalving
      ? aiEvents.filter(e => new Date(e.eventDate) > new Date(lastCalving)).length
      : aiEvents.length;

    return { lastAi, isPregnant, daysPregnant, expectedDelivery, aiAttempts: aiAttempts || aiEvents.length, gestationPct };
  };

  /* ─────────────────────────────── CATEGORY ROW ─────────────────────────────── */
  const CategoryRow = ({ title, count, items, isSub = false, canExpand = false, type = '', compact = false }: any) => {
    const isExpanded = expandedRows[type];
    return (
      <div className={`flex flex-col md:flex-row border-b border-border-custom transition-colors overflow-visible ${isSub ? 'bg-surface2/10' : 'hover:bg-surface'}`}>
        <div className="flex items-center justify-between md:contents">
          <div
            className={`flex-1 md:flex-none md:w-[220px] ${compact ? 'py-2' : 'py-4'} px-4 font-bold text-text md:border-r border-border-custom flex items-center gap-3 ${isSub ? 'pl-8 md:pl-10 text-[12px] md:text-[13px] font-medium' : 'text-[14px]'} ${canExpand ? 'cursor-pointer' : ''}`}
            onClick={() => canExpand && toggleExpand(type)}
          >
            {canExpand && (
              <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center border-2 rounded transition-all shadow-sm ${isExpanded ? 'bg-brand border-brand text-white' : 'bg-white border-brand text-brand'}`}>
                {isExpanded
                  ? <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"/></svg>
                  : <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M5 5V1a1 1 0 012 0v4h4a1 1 0 010 2H7v4a1 1 0 01-2 0V7H1a1 1 0 010-2h4z"/></svg>}
              </div>
            )}
            <span className="uppercase tracking-wide">{title}</span>
          </div>
          <div className={`w-[60px] ${compact ? 'py-2' : 'py-4'} text-center border-l md:border-l-0 md:border-r border-border-custom font-bold text-text bg-surface md:bg-transparent text-[14px]`}>
            {count || 0}
          </div>
        </div>
        <div className={`flex-1 ${compact ? 'px-3 py-1.5 items-center' : 'p-3 items-start'} flex flex-wrap gap-2 justify-start bg-white/50 overflow-visible`}>
          {items.map((item: Herd) => {
            const isCalf = item.animalStatus === 'CALF';
            const isPoultry = isPoultryType(item.animalType);
            if (isPoultry) {
              const bt = batchType(item.animalType);
              const ageDays = item.birthDate ? Math.max(0, Math.floor((Date.now() - new Date(item.birthDate).getTime()) / 86400000)) : null;
              const ageLbl = ageDays == null ? '' : ageDays >= 60 ? ` · ${Math.floor(ageDays / 30)} mo` : ` · ${ageDays} d`;
              return (
                <button key={item.id} type="button" onClick={() => handleHerdClick(item.id)}
                  title={item.purpose ? `Purpose: ${item.purpose.toLowerCase()}` : undefined}
                  className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-left transition-colors ${bt.chip}`}>
                  <BatchIcon type={item.animalType} size={16} className={`${bt.icon} shrink-0`} />
                  <span className="text-[12px] font-bold text-text truncate max-w-[120px]">{item.animalName || item.tagNumber}</span>
                  <span className="text-[11px] text-text3 whitespace-nowrap">{liveBirds(item.birdCount, allGlobalEvents, item.id)} {bt.unit}{ageLbl}</span>
                </button>
              );
            }
            const showAge = isCalf || item.animalStatus === 'HEIFER';
            
            // Get animal events
            const herdEvents = allGlobalEvents.filter(e => e.herdId === item.id);
            
            // 1. Semen Injection Check (Syringe)
            // Semen is considered given if they have a SEMEN_GIVEN event as the latest breeding event.
            const breedingEvents = herdEvents
              .filter(e => ['SEMEN_GIVEN', 'AI_DONE', 'PREGNANCY_CONFIRMED', 'CALF_DELIVERED'].includes(e.eventType))
              .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
            // NONE: no breeding since last calving; GIVEN: semen/AI done, awaiting PD; PD: pregnancy confirmed
            const latestBreeding = breedingEvents[0]?.eventType;
            const semenState: 'NONE' | 'GIVEN' | 'PD' =
              latestBreeding === 'PREGNANCY_CONFIRMED' ? 'PD'
              : latestBreeding === 'SEMEN_GIVEN' || latestBreeding === 'AI_DONE' ? 'GIVEN'
              : 'NONE';

            // 2. DIM Check (Days in Milk)
            const lastCalving = herdEvents
              .filter(e => e.eventType === 'CALF_DELIVERED')
              .sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];
            let dim = 0;
            if (item.animalStatus === 'LACTATING' && lastCalving) {
              const diffTime = Math.abs(Date.now() - new Date(lastCalving.eventDate).getTime());
              dim = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const stage = dim > 0 ? dimStage(dim) : null;
            let dimColor = stage ? stage.text : 'text-slate-400';
            let dimTitle = stage ? stage.label : 'No calving recorded';

            // Near expected calving check
            let eddTitle: string | undefined;
            const lastPd = breedingEvents.find(e => e.eventType === 'PREGNANCY_CONFIRMED');
            const lastAi = breedingEvents.find(e => e.eventType === 'SEMEN_GIVEN' || e.eventType === 'AI_DONE');
            if (lastPd && (!lastCalving || new Date(lastPd.eventDate) > new Date(lastCalving.eventDate))) {
              if (lastAi) {
                const gestation = item.animalType === 'BUFFALO' ? 310 : 283;
                const expectedDelivery = new Date(lastAi.eventDate);
                expectedDelivery.setDate(expectedDelivery.getDate() + gestation);
                const daysToCalving = Math.ceil((expectedDelivery.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                // Remaining Cows: show EDD on hover when PD-confirmed and calving within 90 days
                if (item.animalStatus !== 'LACTATING' && !isYoungStock(item) && daysToCalving >= 0 && daysToCalving <= 90) {
                  const edd = expectedDelivery.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  eddTitle = `ED: ${edd} (in ${daysToCalving} days)`;
                }
                if (daysToCalving <= 60 && daysToCalving >= 0) {
                  dimColor = 'text-red-500';
                  dimTitle = `${dimTitle} — Dry-off action required`;
                }
              }
            }

            // 3. Age in Months (for Calf)
            let ageInMonths = 0;
            if (item.birthDate) {
              const birth = new Date(item.birthDate);
              const today = new Date();
              ageInMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
              if (ageInMonths < 0) ageInMonths = 0;
            }

            const tagColor = getAnimalColor(item);
            const isImageFailed = failedImages[item.id];
            const imgUrl = (item.imageUrl && !isImageFailed) ? formatImageUrl(item.imageUrl) : null;
            const initials = item.animalName
              ? item.animalName.trim().substring(0, 2).toUpperCase()
              : item.tagNumber ? item.tagNumber.substring(0, 2).toUpperCase() : '??';

            return (
              <div
                key={item.id}
                onClick={() => handleHerdClick(item.id)}
                title={eddTitle}
                className="flex flex-col w-[85px] md:w-[105px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-95 select-none"
              >
                {/* Photo Section */}
                <div className={`relative h-[65px] md:h-[80px] w-full flex items-center justify-center overflow-hidden ${isPoultry ? (item.animalType === 'DUCK' ? 'bg-sky-100' : 'bg-amber-100') : tagColor}`}>
                  {isPoultry ? (
                    item.animalType === 'DUCK'
                      ? <Bird size={30} className="text-sky-600 -mt-3" />
                      : <Egg size={30} className="text-amber-600 -mt-3" />
                  ) : imgUrl ? (
                    <img 
                      src={imgUrl} 
                      alt={item.animalName || item.tagNumber} 
                      onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="text-[12px] md:text-[13px] font-black text-white uppercase drop-shadow-sm">{initials}</span>
                  )}
                  
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-0.5 px-1 text-center backdrop-blur-[0.5px]">
                    <div className="text-[7.5px] md:text-[9px] font-black text-white truncate uppercase tracking-tight">
                      {item.animalName || '—'}
                    </div>
                  </div>

                  {/* Syringe Injection status */}
                  {!isPoultry && !(showAge && ageInMonths < 12) && semenState === 'GIVEN' && (
                    <div className="absolute top-1 right-1 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]" title="Semen given — PD pending">
                      <Syringe size={12} className="text-slate-600" strokeWidth={2.25} />
                    </div>
                  )}
                  {!isPoultry && !(showAge && ageInMonths < 12) && semenState === 'PD' && (
                    <div className="absolute top-1 right-1 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-emerald-600 ring-2 ring-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]" title="Pregnancy confirmed">
                      <Syringe size={12} className="text-white" strokeWidth={2.25} />
                    </div>
                  )}
                </div>

                {/* Info / DIM Section */}
                <div 
                  className="py-0.5 px-1 text-center bg-white border-t border-slate-100 flex items-center justify-center gap-1 min-h-[20px] md:min-h-[22px]"
                  title={eddTitle ?? (showAge ? undefined : dimTitle)}
                >
                  {isPoultry ? (
                    <span className="text-[8.5px] md:text-[10px] font-bold text-slate-600 uppercase tracking-tight"
                      title={item.purpose ? `Purpose: ${item.purpose.toLowerCase()}` : undefined}>
                      {item.birdCount ?? 0} birds{item.birthDate ? ` · ${ageInMonths > 0 ? `${ageInMonths} Mo` : `${Math.max(0, Math.floor((Date.now() - new Date(item.birthDate).getTime()) / 86400000))} d`}` : ''}
                    </span>
                  ) : showAge ? (
                    <span className="text-[8.5px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      {ageInMonths} Mo
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <svg 
                        className={`w-3 h-3 md:w-3.5 md:h-3.5 flex-shrink-0 ${dim > 0 ? dimColor : 'text-slate-400'}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6M10 3v3m4-3v3M8 6h8a2 2 0 012 2v10a4 4 0 01-4 4H10a4 4 0 01-4-4V8a2 2 0 012-2z" />
                      </svg>
                      <span className={`text-[8.5px] md:text-[10px] font-bold uppercase tracking-tight ${dim > 0 ? dimColor : 'text-slate-400'}`}>
                        {dim > 0 ? `${dim} DIM` : '—'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="text-[11px] text-text3 italic py-1 pl-2">No records found</div>}
        </div>
      </div>
    );
  };

  // Poultry is stored one record per batch; a batch without a count counts as one bird.
  const birdTotal = (type: string) =>
    activeHerds.filter(h => h.animalType === type)
      .reduce((t, h) => t + (h.birdCount == null ? 1 : liveBirds(h.birdCount, allGlobalEvents, h.id)), 0);

  // Oldest first (no birth date last)
  const byAgeDesc = (a: Herd, b: Herd) =>
    (a.birthDate || '9999').localeCompare(b.birthDate || '9999');
  // Days since latest calving; lowest DIM first (unknown last)
  const dimOf = (h: Herd) => {
    const last = allGlobalEvents
      .filter(e => e.herdId === h.id && e.eventType === 'CALF_DELIVERED')
      .reduce((m, e) => (e.eventDate > m ? e.eventDate : m), '');
    return last ? Date.now() - new Date(last).getTime() : Infinity;
  };
  const byDimAsc = (a: Herd, b: Herd) => dimOf(a) - dimOf(b);

  // Calf/Heifer row: young stock until first AI or 15 months of age, then Remaining Cows
  const isYoungStock = (h: Herd) => {
    if (h.animalStatus !== 'CALF' && h.animalStatus !== 'HEIFER') return false;
    if (allGlobalEvents.some(e => e.herdId === h.id && e.eventType === 'SEMEN_GIVEN')) return false;
    if (h.birthDate) {
      const b = new Date(h.birthDate), t = new Date();
      if ((t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth()) >= 15) return false;
    }
    return true;
  };

  let activeHerds = herds.filter(h => h.status !== 'DISPOSED');

  // Sorting Logic
  if (sortColumn) {
    activeHerds.sort((a, b) => {
      let valA: any = a[sortColumn as keyof Herd] || 0;
      let valB: any = b[sortColumn as keyof Herd] || 0;

      // Helper to compute derived values
      const getDerived = (item: Herd, col: string) => {
        if (col === 'age') {
          // Compare by birthDate if present, else convert age string "Yy Mm" to approximate days
          if (item.birthDate) return new Date(item.birthDate).getTime() * -1; // Negative because older (smaller timestamp) = larger age
          if (item.age) {
            const y = item.age.match(/(\d+)y/);
            const m = item.age.match(/(\d+)m/);
            return ((y ? parseInt(y[1]) : 0) * 365) + ((m ? parseInt(m[1]) : 0) * 30);
          }
          return 0;
        }
        if (col === 'milkPotential') return item.milkPotential || 0;
        if (col === 'avgMilk') return item.avgMilk30Days || 0;
        if (col === 'targetMissed') {
          const pot = item.milkPotential || 0;
          const avg = item.avgMilk30Days || 0;
          return (pot > 0 && avg > 0) ? (pot - avg) : -999;
        }
        if (col === 'weight') return item.calculatedWeight || 0;
        if (col === 'weightStatus') return item.weightStatus || '';
        if (col === 'heartGirth') return item.heartGirth || 0;
        if (col === 'calvingDate') {
          const evts = allGlobalEvents.filter(e => e.herdId === item.id && e.eventType === 'CALF_DELIVERED')
                                       .sort((x, y) => y.eventDate.localeCompare(x.eventDate));
          return evts.length > 0 ? new Date(evts[0].eventDate).getTime() : 0;
        }
        if (col === 'aiDate') {
          const evts = allGlobalEvents.filter(e => e.herdId === item.id && e.eventType === 'SEMEN_GIVEN')
                                       .sort((x, y) => y.eventDate.localeCompare(x.eventDate));
          return evts.length > 0 ? new Date(evts[0].eventDate).getTime() : 0;
        }
        if (col === 'dim') {
          if (item.animalStatus !== 'LACTATING') return -1;
          const evts = allGlobalEvents.filter(e => e.herdId === item.id && e.eventType === 'CALF_DELIVERED')
                                       .sort((x, y) => y.eventDate.localeCompare(x.eventDate));
          if (evts.length === 0) return -1;
          return Math.abs(Date.now() - new Date(evts[0].eventDate).getTime()); // DIM is basically time since calving
        }
        return item[col as keyof Herd] || 0;
      };

      valA = getDerived(a, sortColumn);
      valB = getDerived(b, sortColumn);

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <span className="ml-1 opacity-20">↕</span>;
    return sortDirection === 'asc' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>;
  };

  /** Figures for one cow in the table view: used by the full table and by the phone list. */
  const cowFigures = (item: Herd) => {
    const hGirth = item.heartGirth || 0;
    const weight = item.calculatedWeight || 0;
    
    let weightStatus = item.weightStatus || 'Unknown';
    let wColor = 'bg-gray-100 text-gray-600';
    
    if (weightStatus === 'Very Low' || weightStatus === 'Low' || weightStatus === 'Underweight') wColor = 'bg-orange-100 text-orange-700';
    else if (weightStatus === 'Below Avg' || weightStatus === 'Avg' || weightStatus === 'Healthy' || weightStatus === 'Above Avg') wColor = 'bg-green-100 text-green-700';
    else if (weightStatus === 'Slightly Overweight' || weightStatus === 'Overweight') wColor = 'bg-red-100 text-red-700';
    else if (item.healthStatus && item.healthStatus.toUpperCase() !== 'HEALTHY') {
      wColor = 'bg-red-100 text-red-700';
      if (weightStatus === 'Unknown') weightStatus = item.healthStatus;
    }

    // Events
    const herdEvents = allGlobalEvents.filter(e => e.herdId === item.id);
    const semenEvents = herdEvents.filter(e => e.eventType === 'SEMEN_GIVEN').sort((a,b) => b.eventDate.localeCompare(a.eventDate));
    let daysSinceAI = 0;
    if (semenEvents[0]) {
      const diffTime = Math.abs(Date.now() - new Date(semenEvents[0].eventDate).getTime());
      daysSinceAI = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    const fmtDate = (iso?: string | null) => iso
      ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    const latestDeworm = item.lastDewormingDate ? fmtDate(item.lastDewormingDate) : (item.nextDewormingDate ? 'Never' : '—');
    let dewormDue: { text: string; cls: string } | null = null;
    if (item.nextDewormingDate) {
      const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
      const daysTo = Math.round((new Date(item.nextDewormingDate + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000);
      const doseLbl = item.nextDewormingDose ? ` · dose ${item.nextDewormingDose}` : '';
      if (daysTo < 0) dewormDue = { text: `Overdue ${-daysTo}d${doseLbl}`, cls: 'bg-red-100 text-red-700' };
      else if (daysTo === 0) dewormDue = { text: `Today${doseLbl}`, cls: 'bg-amber-100 text-amber-700' };
      else dewormDue = { text: `${fmtDate(item.nextDewormingDate)}${doseLbl}`, cls: daysTo <= 7 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600' };
    }

    // DIM & Calving Date
    const lastCalving = herdEvents.filter(e => e.eventType === 'CALF_DELIVERED').sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];
    let dim = 0;
    if (item.animalStatus === 'LACTATING' && lastCalving) {
      const diffTime = Math.abs(Date.now() - new Date(lastCalving.eventDate).getTime());
      dim = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    const calvingDateStr = lastCalving ? lastCalving.eventDate : '—';

    // Next Event
    const futureEvents = herdEvents.filter(e => new Date(e.eventDate) >= new Date()).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    let nextEventStr = '—';
    if (futureEvents.length > 0) {
       const ne = futureEvents[0];
       const eConf = EVENT_CONFIG[ne.eventType];
       nextEventStr = `${eConf ? eConf.label : ne.title} - ${ne.eventDate}`;
    }

    // Calculations
    const avgMilk = item.avgMilk30Days || 0;
    const pot = item.milkPotential || 0;
    const conf = item.milkPotentialConfidence || 'Low';
    let targetMissed: any = '—';
    if (pot > 0 && avgMilk > 0) {
       targetMissed = (pot - avgMilk).toFixed(1);
    }

    const isImageFailed = failedImages[item.id];
    const imgUrl = (item.imageUrl && !isImageFailed) ? formatImageUrl(item.imageUrl) : null;
    const initials = item.animalName ? item.animalName.substring(0, 2).toUpperCase() : item.tagNumber.substring(0,2);
    return { hGirth, weight, weightStatus, wColor, daysSinceAI, fmtDate, latestDeworm, dewormDue, dim, calvingDateStr,
      nextEventStr, avgMilk, pot, conf, targetMissed, imgUrl, initials, item };
  };

  /** Columns of the phone table view for a group: heading, sort key (same as the full table), width, cell. */
  type CowFigures = ReturnType<typeof cowFigures>;
  const phoneColumns = (group: PhoneGroup): { label: string; sort?: string; width: string; render: (f: CowFigures) => React.ReactNode }[] => {
    const dash = <span className="text-text3 font-normal">—</span>;
    switch (group) {
      case 'milk': return [
        { label: 'Avg', sort: 'avgMilk', width: 'w-[58px]', render: f => f.avgMilk > 0 ? `${f.avgMilk.toFixed(1)} L` : dash },
        { label: 'Target', sort: 'milkPotential', width: 'w-[58px]', render: f => f.pot > 0 ? `${f.pot} L` : dash },
        { label: 'Missed', sort: 'targetMissed', width: 'w-[62px]', render: f => f.targetMissed !== '—' ? <span className="text-red-600">{f.targetMissed} L</span> : dash },
      ];
      case 'breeding': return [
        { label: 'DIM', sort: 'dim', width: 'w-[44px]', render: f => f.dim > 0 ? f.dim : dash },
        { label: 'AI days', sort: 'aiDate', width: 'w-[56px]', render: f => f.daysSinceAI > 0 ? f.daysSinceAI : dash },
        { label: 'Calved', sort: 'calvingDate', width: 'w-[60px]', render: f => f.calvingDateStr !== '—' ? shortDate(f.calvingDateStr) : dash },
      ];
      case 'weight': return [
        { label: 'Girth', sort: 'heartGirth', width: 'w-[48px]', render: f => f.hGirth > 0 ? `${f.hGirth} cm` : dash },
        // Weight status sits under the weight so the name keeps room next to BCS
        { label: 'Weight', sort: 'weight', width: 'w-[66px]', render: f => (
          <div className="flex flex-col items-end gap-0.5">
            {f.weight > 0 ? <span className="text-brand">{f.weight} kg</span> : dash}
            <span className={`px-1.5 rounded-full text-[8px] font-black uppercase leading-[14px] whitespace-nowrap ${f.wColor}`}>{f.weightStatus}</span>
          </div>
        ) },
        { label: 'BCS', sort: 'bcs', width: 'w-[40px]', render: f => (
          <BcsBadge bcs={f.item.bcs} size={34} onClick={e => { e.stopPropagation(); setBcsTarget(f.item); }} />
        ) },
      ];
      case 'health': return [
        { label: 'Dewormed', width: 'w-[78px]', render: f => <span className="text-xs">{f.latestDeworm}</span> },
        { label: 'Due', width: 'w-[92px]', render: f => f.dewormDue
          ? <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-tight ${f.dewormDue.cls}`}>{f.dewormDue.text}</span> : dash },
      ];
      case 'next': return [
        { label: 'Next event', width: 'w-[150px]', render: f => <span className="text-xs font-semibold leading-tight">{f.nextEventStr}</span> },
      ];
    }
  };

  /* ──────────────────────────────── MAIN RENDER ──────────────────────────────── */
  return (
    <AppLayout noPadding={showModal && !!selectedHerd}>
      {/* ══ ANIMAL WORKSPACE (replaces herd list when animal is selected) ══ */}
      {showModal && selectedHerd && isPoultryType(selectedHerd.animalType) ? (
        <PoultryWorkspace
          herd={selectedHerd}
          events={events}
          loadingEvents={loadingEvents}
          onBack={() => { setShowModal(false); setSelectedHerd(null); }}
          onEdit={() => { setShowModal(false); setShowEditModal(true); }}
          onDelete={() => handleDeleteHerd(selectedHerd.id)}
          onEventAdded={(evt) => { setEvents(prev => [evt as any, ...prev]); fetchHerds(); }}
          onEventDeleted={(id) => { setEvents(prev => prev.filter(e => e.id !== id)); fetchHerds(); }}
        />
      ) : showModal && selectedHerd ? (
        <AnimalWorkspace
          herd={selectedHerd}
          events={events}
          loadingEvents={loadingEvents}
          userRole={userRole}
          failedImages={failedImages}
          onBack={() => { setShowModal(false); setSelectedHerd(null); }}
          onEdit={() => { setShowModal(false); setShowEditModal(true); }}
          onDelete={() => handleDeleteHerd(selectedHerd.id)}
          onEventAdded={(evt) => {
            setEvents(prev => [evt, ...prev]);
            fetchHerds();
            if (selectedHerd) {
              api.get(`/herds/${selectedHerd.id}`).then(res => setSelectedHerd(res.data)).catch(console.error);
            }
          }}
          onEventDeleted={(id) => {
            setEvents(prev => prev.filter(e => e.id !== id));
            fetchHerds();
            if (selectedHerd) {
              api.get(`/herds/${selectedHerd.id}`).then(res => setSelectedHerd(res.data)).catch(console.error);
            }
          }}
          onEventUpdated={(evt) => {
            setEvents(prev => prev.map(e => e.id === evt.id ? evt : e).sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
            fetchHerds();
          }}
          onBcsScored={async (bcs) => {
            try {
              const res = await api.patch(`/herds/${selectedHerd.id}/bcs`, { bcs });
              setSelectedHerd(res.data);
              const ev = await api.get(`/herds/${selectedHerd.id}/events`);
              setEvents(ev.data || []);
              fetchHerds();
            } catch { showToast('Failed to save BCS.', 'error'); }
          }}
          onImageError={(id) => setFailedImages(prev => ({ ...prev, [id]: true }))}
        />
      ) : (
      <>
      <div className="flex items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div className="px-1">
          <h1 className="text-xl md:text-2xl font-black text-text tracking-tight uppercase">Herd Management</h1>
          <p className="text-[12px] text-text3 mt-0.5 underline font-medium">Sthirvaa Farms Dashboard</p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <div className="flex bg-surface p-1 rounded-xl border border-border-custom shadow-sm md:mr-2">
            <button
              onClick={() => setViewMode('card')}
              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold uppercase transition-all ${viewMode === 'card' ? 'bg-white text-brand shadow-sm' : 'text-text3 hover:text-text'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold uppercase transition-all ${viewMode === 'table' ? 'bg-white text-brand shadow-sm' : 'text-text3 hover:text-text'}`}
            >
              Table
            </button>
          </div>
          <button
            onClick={() => setShowBreedingModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm"
            title="Upcoming deliveries and AI cows"
          >
            <Baby size={14} />
          </button>
          <button
            onClick={() => setShowDisposedModal(true)}
            className="flex items-center px-3 py-2 border border-border-custom bg-white hover:bg-surface text-text3 hover:text-brand rounded-xl transition-all shadow-sm"
            title={`Disposed animals (${herds.filter(h => h.status === 'DISPOSED').length})`}
            aria-label="Disposed animals"
          >
            <Archive size={14} />
          </button>
          <button onClick={() => setShowAllEventsModal(true)} className="flex items-center gap-1.5 px-3 py-2 border border-brand/20 bg-brand/5 hover:bg-brand/10 text-brand rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm">
            <Calendar size={14} />
            <span className="hidden md:inline">All Events</span>
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-brand text-white flex items-center gap-2 py-2 px-3 md:px-5 rounded-xl font-black text-[11px] md:text-[13px] hover:bg-brand-dark transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            <span className="hidden md:inline">Register Animal</span>
          </button>
        </div>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {viewMode === 'table' ? (
          <>
          {/* Phones: rows only scroll up and down; the chips pick which figures each row shows. */}
          <div className="md:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4">
              {PHONE_GROUPS.map(g => (
                <button key={g.key} onClick={() => setPhoneGroup(g.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    phoneGroup === g.key ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {(() => {
              const cows = activeHerds.filter(h => h.animalType === 'COW');
              const cols = phoneColumns(phoneGroup);
              return (
                <div className="bg-white border border-border-custom rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border-custom text-[10px] font-black text-text3 uppercase tracking-wider">
                    <span className="flex-1">Name</span>
                    {cols.map(c => (
                      <button key={c.label} disabled={!c.sort} onClick={() => c.sort && handleSort(c.sort)}
                        className={`${c.width} text-right uppercase ${c.sort ? 'hover:text-brand' : 'cursor-default'}`}>
                        {c.label}{c.sort && getSortIcon(c.sort)}
                      </button>
                    ))}
                  </div>
                  <ul className="divide-y divide-border-custom/50">
                    {cows.map(item => {
                      const f = cowFigures(item);
                      return (
                        <li key={item.id} onClick={() => handleHerdClick(item.id)}
                          className="flex items-center gap-2 px-3 py-2.5 active:bg-brand/5 cursor-pointer">
                          {f.imgUrl ? (
                            <img src={f.imgUrl} onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))}
                              className="w-9 h-9 shrink-0 rounded-lg object-cover border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-black text-gray-500">{f.initials}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-text truncate">{item.animalName || '—'}</p>
                            <p className="text-[11px] text-text3 truncate capitalize">{(item.animalStatus || '—').toLowerCase().replace(/_/g, ' ')}</p>
                          </div>
                          {cols.map(c => (
                            <div key={c.label} className={`${c.width} text-right text-[13px] font-bold`}>{c.render(f)}</div>
                          ))}
                        </li>
                      );
                    })}
                    {cows.length === 0 && <li className="py-8 text-center text-text3 italic text-sm">No cows found in herd.</li>}
                  </ul>
                </div>
              );
            })()}
          </div>

          <div className="hidden md:block bg-white border border-border-custom rounded-xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
              <table className="w-full text-left border-collapse" style={{ transform: 'rotateX(180deg)' }}>
                <thead>
                  <tr className="bg-surface border-b border-border-custom">
                    <th className="sticky left-0 z-10 bg-surface py-3 px-3 md:px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Name</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Breed</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('age')}>Age {getSortIcon('age')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Stage</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" title="Confidence: Low/Med/High" onClick={() => handleSort('milkPotential')}>Potential {getSortIcon('milkPotential')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('avgMilk')}>Avg Milk {getSortIcon('avgMilk')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('targetMissed')}>Target Missed {getSortIcon('targetMissed')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('dim')}>DIM {getSortIcon('dim')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('aiDate')}>AI {getSortIcon('aiDate')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('heartGirth')}>Heart Girth {getSortIcon('heartGirth')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('weight')}>Weight {getSortIcon('weight')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-center cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('weightStatus')}>Weight Status {getSortIcon('weightStatus')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-center cursor-pointer hover:text-brand whitespace-nowrap" title="Body Condition Score 1-5, tap to set" onClick={() => handleSort('bcs')}>BCS {getSortIcon('bcs')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Next Event</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider cursor-pointer hover:text-brand whitespace-nowrap" onClick={() => handleSort('calvingDate')}>Calving Date {getSortIcon('calvingDate')}</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Last Deworming</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider whitespace-nowrap">Deworming Due</th>
                    <th className="py-3 px-4 text-[11px] font-black text-text3 uppercase tracking-wider text-right whitespace-nowrap">Parity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom/50">
                  {activeHerds.filter(h => h.animalType === 'COW').map(item => {
                    const { hGirth, weight, weightStatus, wColor, daysSinceAI, fmtDate, latestDeworm, dewormDue, dim, calvingDateStr,
                      nextEventStr, avgMilk, pot, conf, targetMissed, imgUrl, initials } = cowFigures(item);

                    return (
                      <tr key={item.id} onClick={() => handleHerdClick(item.id)} className="group hover:bg-brand/5 cursor-pointer transition-colors">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-[#f3f8f5] py-2.5 md:py-3 px-3 md:px-4 whitespace-nowrap min-w-[150px] md:min-w-[200px] shadow-[1px_0_0_rgba(0,0,0,0.06)]">
                          <div className="flex items-center gap-3">
                            {imgUrl ? (
                              <img src={imgUrl} onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))} className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 rounded-lg object-cover border border-slate-200" />
                            ) : (
                              <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-black text-gray-500">{initials}</div>
                            )}
                            <div className="truncate">
                              <div className="font-bold text-sm text-text truncate">{item.animalName || '—'}</div>
                              <div className="text-[10px] text-text3 font-mono">{item.tagNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-text whitespace-nowrap min-w-[120px]">{item.breed || '—'}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-text3 whitespace-nowrap">{item.calculatedAge || item.age || '—'}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-text whitespace-nowrap">{item.animalStatus || '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap" title={`Confidence: ${conf}`}>{pot > 0 ? `${pot} L/day` : '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{avgMilk > 0 ? `${avgMilk.toFixed(1)} L/day` : '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-red-600 text-right whitespace-nowrap">{targetMissed !== '—' ? `${targetMissed} L` : '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{dim > 0 ? dim : '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{daysSinceAI > 0 ? daysSinceAI : '—'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{hGirth > 0 ? `${hGirth} cm` : '—'}</td>
                        <td className="py-3 px-4 text-sm font-black text-brand text-right whitespace-nowrap">{weight > 0 ? `${weight} kg` : '—'}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wide rounded-full ${wColor}`}>
                            {weightStatus}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-center whitespace-nowrap">
                          <BcsBadge bcs={item.bcs} onClick={e => { e.stopPropagation(); setBcsTarget(item); }} />
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-text whitespace-nowrap">{nextEventStr}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-text whitespace-nowrap">{calvingDateStr}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-text whitespace-nowrap">{latestDeworm}</td>
                        <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap" title={item.nextDewormingDate ? `Next deworming: ${fmtDate(item.nextDewormingDate)}` : undefined}>
                          {dewormDue ? <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${dewormDue.cls}`}>{dewormDue.text}</span> : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{item.lactationNumber || 0}</td>
                      </tr>
                    );
                  })}
                  {activeHerds.filter(h => h.animalType === 'COW').length === 0 && (
                    <tr><td colSpan={18} className="py-8 text-center text-text3 italic">No cows found in herd.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
        ) : (
          <>
        {/* Milk Production Section */}
        <div>
          <div className="bg-[#FFCCBC] py-2.5 px-5 font-black text-[#BF360C] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Milk Production Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
              <span className="text-[10px] uppercase tracking-wide font-black text-text3">DIM</span>
              <div className="relative flex w-64 h-2 rounded-full overflow-hidden" style={{ background: DIM_GRADIENT }}>
                {DIM_STAGES.map(st => (
                  <div key={st.label} title={st.label} className="border-r border-white/80 last:border-r-0" style={{ flexGrow: st.days, flexBasis: 0 }} />
                ))}
              </div>
            </div>
            <CategoryRow title="Lactation Cows" type="COW" canExpand={true}
              count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING').length}
              items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING').sort(byDimAsc)} />
            {expandedRows['COW'] && (
              <>
                <CategoryRow title="Remaining Cows" isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && !isYoungStock(h)).length}
                  items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && !isYoungStock(h))} />
                <CategoryRow title="Calf/Heifer" isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && isYoungStock(h)).length}
                  items={activeHerds.filter(h => h.animalType === 'COW' && isYoungStock(h)).sort(byAgeDesc)} />
              </>
            )}
            <CategoryRow title="Buffalo"
              count={activeHerds.filter(h => h.animalType === 'BUFFALO').length}
              items={activeHerds.filter(h => h.animalType === 'BUFFALO')} />
            <CategoryRow title="Goat"
              count={activeHerds.filter(h => h.animalType === 'GOAT').length}
              items={activeHerds.filter(h => h.animalType === 'GOAT')} />
          </div>
        </div>

        {/* Meat Section */}
        <div>
          <button type="button" onClick={() => toggleExpand('MEAT')} aria-expanded={!!expandedRows['MEAT']}
            className={`w-full flex items-center gap-3 bg-[#E1F5FE] py-2.5 px-5 font-black text-[#0277BD] text-[12px] uppercase tracking-[1.5px] border-b border-white/20 shadow-sm text-left ${expandedRows['MEAT'] ? 'rounded-t-xl' : 'rounded-xl'}`}>
            <span className="flex-1">Meat / Poultry Section</span>
            <span className="text-[11px] font-bold normal-case tracking-normal text-[#0277BD]/80">
              {BATCH_TYPES.filter(bt => birdTotal(bt.type) > 0).map(bt => `${bt.label} ${birdTotal(bt.type)}`).join(' · ')}
            </span>
          </button>
          {expandedRows['MEAT'] && (
            <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
              {BATCH_TYPES.map(bt => (
                <CategoryRow key={bt.type} compact title={bt.type === 'FISH' ? 'Fishes' : bt.label}
                  count={birdTotal(bt.type)} items={activeHerds.filter(h => h.animalType === bt.type)} />
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
      </>
      )}


      {/* Register Animal Modal */}
      {showRegisterModal && (
        <RegisterAnimalModal onClose={() => setShowRegisterModal(false)} onSuccess={fetchHerds} />
      )}
      {showEditModal && selectedHerd && (
        <RegisterAnimalModal
          onClose={() => { setShowEditModal(false); setSelectedHerd(null); }}
          onSuccess={fetchHerds}
          herdToEdit={selectedHerd}
        />
      )}

      {/* ══════════ ADD EVENT MODAL ══════════ */}
      {showAddEventModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border-custom"
                 style={{ background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)' }}>
              <div>
                <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Record New Event</h2>
                <p className="text-[10px] text-white/80 font-bold uppercase mt-0.5">
                  Logging for {selectedHerd.animalName || selectedHerd.tagNumber}
                </p>
              </div>
              <button onClick={() => setShowAddEventModal(false)} className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="p-6 space-y-4 text-left">
              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Event Type</label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-semibold text-xs text-text focus:outline-none focus:border-brand transition-all"
                  required
                >
                  <option value="SEMEN_GIVEN">Artificial Insemination (AI)</option>
                  <option value="PREGNANCY_CONFIRMED">Pregnancy Confirmed (PD)</option>
                  <option value="CALF_DELIVERED">Calf Delivered</option>
                  <option value="DRY_PERIOD_STARTED">Dry Period Started</option>
                  <option value="LACTATION_STARTED">Lactation Started</option>
                  <option value="VACCINATION_DUE">Vaccination Reminder</option>
                  <option value="DEWORMING_DUE">Deworming Reminder</option>
                  <option value="PREGNANCY_CHECK_DUE">Pregnancy Check Reminder</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Event Date</label>
                  <input
                    type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-semibold text-xs text-text focus:outline-none focus:border-brand transition-all font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Event Title</label>
                  <input
                    type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-bold text-xs text-text focus:outline-none focus:border-brand transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Details &amp; Remarks</label>
                <textarea
                  value={eventDetailsText} onChange={e => setEventDetailsText(e.target.value)}
                  placeholder="e.g. Bull Tag: GIR-505, Technician Name, Calf gender, dosage details..."
                  className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-semibold text-xs text-text focus:outline-none focus:border-brand transition-all h-24 resize-none leading-relaxed"
                  maxLength={1000}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button type="button" onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit"
                  className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95">
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disposed Animals Modal */}
      {showDisposedModal && (
        <DisposedAnimalsModal
          isOpen={showDisposedModal}
          onClose={() => setShowDisposedModal(false)}
          herds={herds}
          onAnimalClick={handleHerdClick}
        />
      )}

      {/* Body Condition Score picker */}
      {bcsTarget && (
        <BcsPickerModal
          animalName={bcsTarget.animalName || bcsTarget.tagNumber}
          value={bcsTarget.bcs}
          scoredToday={bcsTarget.bcsDate === bcsTodayIso()}
          onSelect={bcs => saveBcs(bcsTarget, bcs)}
          onClose={() => setBcsTarget(null)}
        />
      )}

      {/* Breeding Modal: upcoming deliveries + AI cows */}
      {showBreedingModal && (
        <BreedingModal
          onClose={() => setShowBreedingModal(false)}
          events={allGlobalEvents}
          herds={herds}
          onAnimalClick={handleHerdClick}
        />
      )}

      {/* All Events Modal */}
      {showAllEventsModal && (
        <AllEventsModal
          isOpen={showAllEventsModal}
          onClose={() => setShowAllEventsModal(false)}
          events={allGlobalEvents}
          herds={herds}
          onAnimalClick={handleHerdClick}
          onRefresh={fetchHerds}
        />
      )}
    </AppLayout>
  );
}

/* ─── Disposed Animals Archive Modal ─── */
function DisposedAnimalsModal({ isOpen, onClose, herds, onAnimalClick }: {
  isOpen: boolean; onClose: () => void; herds: any[]; onAnimalClick: (id: number) => void;
}) {
  if (!isOpen) return null;
  const disposed = herds.filter(h => h.status === 'DISPOSED');
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border-custom"
             style={{ background: 'linear-gradient(135deg,#5c677d 0%,#334155 100%)' }}>
          <div>
            <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Disposed Animals Archive</h2>
            <p className="text-[10px] text-white/70 font-semibold uppercase mt-0.5">Inactive / sold / archived records</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {disposed.length === 0 ? (
            <div className="py-16 text-center text-text3 italic">No disposed animal records found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {disposed.map(item => {
                const initials = item.animalName ? item.animalName.substring(0, 2).toUpperCase() : '??';
                return (
                  <div key={item.id}
                    onClick={() => { onAnimalClick(item.id); onClose(); }}
                    className="bg-surface hover:bg-[#F1F5F9] border border-border-custom rounded-xl p-4 cursor-pointer transition-all hover:shadow text-center flex flex-col items-center gap-2 group">
                    {item.imageUrl
                      ? <img src={formatImageUrl(item.imageUrl)} alt={item.animalName} className="w-12 h-12 rounded-lg object-cover border" />
                      : <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center text-white font-black text-sm uppercase">{initials}</div>}
                    <div>
                      <p className="font-bold text-text text-[13px] truncate max-w-[120px]">{item.animalName || 'Unnamed'}</p>
                      <p className="text-[10px] text-text3 font-mono mt-0.5">{item.tagNumber}</p>
                    </div>
                    <span className="text-[9px] font-bold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                      Date: {(() => {
                        const ds = item.disposedDate || item.updatedAt?.slice(0, 10);
                        if (!ds) return '—';
                        const [y, m, d] = ds.split('-').map(Number);
                        return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y}`;
                      })()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md">
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Breeding Modal: upcoming deliveries + AI cows ─── */
function BreedingModal({ onClose, events, herds, onAnimalClick }: {
  onClose: () => void; events: HerdEvent[]; herds: Herd[]; onAnimalClick: (id: number) => void;
}) {
  const [tab, setTab] = useState<'deliveries' | 'ai'>('deliveries');

  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const toDate = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00');
  const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
  // dd-mm-yyyy
  const fmt = (d: Date | string) => {
    const x = typeof d === 'string' ? toDate(d) : d;
    return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`;
  };
  const isAi = (t: string) => t === 'SEMEN_GIVEN' || t === 'AI_DONE';
  const { showToast } = useNotification();
  // Bull IDs added from this window, by AI event id, so they show without reloading the herd.
  const [addedBullIds, setAddedBullIds] = useState<Record<number, string>>({});
  const [bullDraft, setBullDraft] = useState<{ eventId: number; value: string } | null>(null);
  const bullIdOf = (e?: HerdEvent) => (e && addedBullIds[e.id]) || bullIdFromDetails(e?.details);

  const saveBullId = async (e: HerdEvent) => {
    const value = bullDraft?.value.trim() ?? '';
    if (!value) { setBullDraft(null); return; }
    try {
      // Same storage as the AI form: "Bull ID: X." in front of the notes; date and title stay as recorded.
      await api.put(`/herds/events/${e.id}`, { details: withBullId(value, notesOf(e.details)) });
      setAddedBullIds(prev => ({ ...prev, [e.id]: value }));
      setBullDraft(null);
      showToast('Bull ID saved');
    } catch {
      showToast('Could not save the bull ID', 'error');
    }
  };

  /** Bull ID, or (when the AI was recorded without one) a small "+ Add" that edits it in place. */
  const bullCell = (e: HerdEvent) => {
    const id = bullIdOf(e);
    if (id) return id;
    if (bullDraft?.eventId === e.id) {
      return (
        // Shrinks to fit the narrow phone cards; Enter or ✓ saves, Esc cancels.
        <span className="flex items-center gap-1 w-full" onClick={ev => ev.stopPropagation()}>
          <input autoFocus value={bullDraft.value} placeholder="HF-2204" aria-label="Bull ID"
            onChange={ev => setBullDraft({ eventId: e.id, value: ev.target.value })}
            onKeyDown={ev => { if (ev.key === 'Enter') saveBullId(e); if (ev.key === 'Escape') setBullDraft(null); }}
            className="flex-1 min-w-0 max-w-[96px] px-1.5 py-1 border border-brand rounded-md text-[11px] font-mono font-bold focus:outline-none" />
          <button onClick={() => saveBullId(e)} aria-label="Save bull ID"
            className="shrink-0 w-6 h-6 rounded-md bg-brand text-white text-[12px] font-bold">✓</button>
        </span>
      );
    }
    return (
      <button onClick={ev => { ev.stopPropagation(); setBullDraft({ eventId: e.id, value: '' }); }}
        className="text-brand font-bold font-sans hover:underline">+ Add</button>
    );
  };

  // Current breeding cycle per animal: AI / PD events after the latest calving
  const rows = herds
    .filter(h => h.status !== 'DISPOSED' && (h.animalType === 'COW' || h.animalType === 'BUFFALO'))
    .map(h => {
      const evs = events.filter(e => e.herdId === h.id);
      const lastCalving = evs.filter(e => e.eventType === 'CALF_DELIVERED')
        .reduce((m, e) => (e.eventDate > m ? e.eventDate : m), '');
      const cycle = evs.filter(e => e.eventDate > lastCalving);
      // Latest first; a detailed record wins over a blank one on the same day
      const ais = cycle.filter(e => isAi(e.eventType))
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || (bullIdOf(b) ? 1 : 0) - (bullIdOf(a) ? 1 : 0));
      const pdDate = cycle.filter(e => e.eventType === 'PREGNANCY_CONFIRMED')
        .map(e => e.eventDate.slice(0, 10)).sort().pop() ?? null;
      const latestAi = ais[0] ?? null;
      // PD due: a PD check scheduled on/after the latest AI, else AI + PD_AFTER_AI_DAYS
      let pdDue: Date | null = null;
      if (latestAi) {
        const scheduled = cycle.filter(e => e.eventType === 'PREGNANCY_CHECK_DUE' && e.eventDate >= latestAi.eventDate)
          .map(e => e.eventDate.slice(0, 10)).sort()[0];
        pdDue = scheduled ? toDate(scheduled) : new Date(toDate(latestAi.eventDate).getTime() + PD_AFTER_AI_DAYS * DAY);
      }
      // Conceiving AI: latest AI on or before the PD
      const conceivingAi = pdDate ? ais.find(e => e.eventDate.slice(0, 10) <= pdDate) ?? null : null;
      const gestationLen = h.animalType === 'BUFFALO' ? 310 : 283;
      let edd: Date | null = null, gestationDays = 0, daysToEdd = 0;
      if (conceivingAi) {
        const ai = toDate(conceivingAi.eventDate);
        edd = new Date(ai.getTime() + gestationLen * DAY);
        gestationDays = daysBetween(ai, today);
        daysToEdd = daysBetween(today, edd);
      }
      return { h, latestAi, pdDue, pdDate, conceivingAi, edd, gestationDays, gestationLen, daysToEdd };
    });

  // What needs attention first goes on top: the nearest calving, and the nearest (or overdue) PD check.
  const deliveries = rows.filter(r => r.conceivingAi)
    .sort((a, b) => a.edd!.getTime() - b.edd!.getTime());
  const aiCows = rows.filter(r => r.latestAi && !r.pdDate)
    .sort((a, b) => a.pdDue!.getTime() - b.pdDue!.getTime());

  const Name = ({ h }: { h: Herd }) => (
    <div className="flex items-center gap-2.5 min-w-0">
      {h.imageUrl
        ? <img src={formatImageUrl(h.imageUrl)} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
        : <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center text-[11px] font-black text-gray-500 shrink-0">
            {(h.animalName || h.tagNumber).substring(0, 2).toUpperCase()}
          </div>}
      <div className="min-w-0">
        <div className="font-bold text-[13px] text-text truncate">{h.animalName || '—'}</div>
        <div className="text-[10px] text-text3 font-mono truncate">{h.tagNumber}</div>
      </div>
    </div>
  );
  const dueBadge = (d: number, what: string) => {
    const cls = d <= 0 ? 'bg-red-100 text-red-700' : d <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
    const text = d < 0 ? `${what} overdue ${-d}d` : d === 0 ? `${what} today` : `${what} in ${d}d`;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>{text}</span>;
  };
  const stat = (label: string, value: React.ReactNode) => (
    <div className="bg-surface rounded-lg px-2.5 py-1.5 min-w-0">
      <div className="text-text3 font-semibold uppercase text-[9px]">{label}</div>
      <div className="font-bold text-text truncate">{value}</div>
    </div>
  );
  const open = (id: number) => { onAnimalClick(id); onClose(); };
  const th = 'py-2.5 px-4 text-[10px] font-black text-text3 uppercase tracking-wider whitespace-nowrap';
  const empty = (msg: string) => <div className="py-16 text-center text-text3 italic text-sm">{msg}</div>;

  return (
    // Phone: full screen. Desktop: centred dialog that grows with its rows.
    <div className="fixed inset-0 z-[2000] bg-white md:bg-black/75 md:backdrop-blur-sm flex md:items-center md:justify-center md:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white w-full h-full md:h-auto md:max-w-3xl md:max-h-[88vh] md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
        <div className="px-4 md:px-5 py-3.5 md:py-4 pt-[max(0.875rem,env(safe-area-inset-top))] flex items-center justify-between shrink-0"
             style={{ background: 'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-1.5 rounded-lg"><Baby size={16} className="text-white" /></div>
            <div>
              <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Breeding</h2>
              <p className="text-[10px] text-white/75 font-semibold uppercase mt-0.5">Current cycle since last calving</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 md:p-1.5 rounded-full transition-all" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 py-2.5 border-b border-border-custom bg-surface/40 shrink-0">
          {([['deliveries', 'Upcoming Deliveries', deliveries.length], ['ai', 'AI Cows', aiCows.length]] as const).map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 md:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition-all ${tab === k ? 'bg-brand text-white shadow-sm' : 'bg-white border border-border-custom text-text2 hover:text-brand'}`}>
              {k === 'deliveries' ? <><span className="hidden sm:inline">Upcoming </span>Deliveries</> : label} <span className="opacity-60">({n})</span>
            </button>
          ))}
        </div>

        {/* Phone: fills the screen and scrolls. Desktop: grows with the list, scrolls past 5 rows (57px rows + 36px header) */}
        <div className="flex-1 md:flex-none min-h-0 overflow-y-auto overscroll-contain md:max-h-[322px] pb-[env(safe-area-inset-bottom)]">
          {tab === 'deliveries' ? (deliveries.length === 0 ? empty('No PD-confirmed animals.') : (
            <>
              <table className="hidden md:table w-full text-left">
                <thead className="sticky top-0 bg-surface border-b border-border-custom">
                  <tr><th className={th}>Cow</th><th className={th}>AI Date</th><th className={th}>Bull ID</th><th className={`${th} text-right`}>Gestation</th><th className={th}>EDD</th><th className={th}></th></tr>
                </thead>
                <tbody className="divide-y divide-border-custom/50">
                  {deliveries.map(r => (
                    <tr key={r.h.id} onClick={() => open(r.h.id)} className="hover:bg-brand/5 cursor-pointer">
                      <td className="py-2.5 px-4"><Name h={r.h} /></td>
                      <td className="py-2.5 px-4 text-xs font-semibold text-text2 whitespace-nowrap">{fmt(r.conceivingAi!.eventDate)}</td>
                      <td className="py-2.5 px-4 text-xs font-bold text-text font-mono whitespace-nowrap">{bullCell(r.conceivingAi!)}</td>
                      <td className="py-2.5 px-4 text-sm font-bold text-text text-right whitespace-nowrap">{r.gestationDays} <span className="text-[10px] text-text3 font-semibold">/ {r.gestationLen} d</span></td>
                      <td className="py-2.5 px-4 text-sm font-bold text-text whitespace-nowrap">{fmt(r.edd!)}</td>
                      <td className="py-2.5 px-4 text-right">{dueBadge(r.daysToEdd, 'Calving')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="md:hidden divide-y divide-border-custom/60">
                {deliveries.map(r => (
                  <div key={r.h.id} onClick={() => open(r.h.id)} className="px-4 py-3.5 active:bg-brand/5">
                    <div className="flex items-center justify-between gap-2">
                      <Name h={r.h} />
                      {dueBadge(r.daysToEdd, 'Calving')}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                      {stat('Gestation', `${r.gestationDays} / ${r.gestationLen}`)}
                      {stat('EDD', fmt(r.edd!))}
                      {stat('Bull ID', bullCell(r.conceivingAi!))}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-pink-400" style={{ width: `${Math.min(100, Math.round(r.gestationDays / r.gestationLen * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )) : (aiCows.length === 0 ? empty('No cows awaiting PD.') : (
            <>
              <table className="hidden md:table w-full text-left">
                <thead className="sticky top-0 bg-surface border-b border-border-custom">
                  <tr><th className={th}>Cow</th><th className={th}>AI Date</th><th className={th}>Bull ID</th><th className={th}>PD Due</th><th className={th}></th></tr>
                </thead>
                <tbody className="divide-y divide-border-custom/50">
                  {aiCows.map(r => (
                    <tr key={r.h.id} onClick={() => open(r.h.id)} className="hover:bg-brand/5 cursor-pointer">
                      <td className="py-2.5 px-4"><Name h={r.h} /></td>
                      <td className="py-2.5 px-4 text-xs font-semibold text-text2 whitespace-nowrap">{fmt(r.latestAi!.eventDate)}</td>
                      <td className="py-2.5 px-4 text-xs font-bold text-text font-mono whitespace-nowrap">{bullCell(r.latestAi!)}</td>
                      <td className="py-2.5 px-4 text-sm font-bold text-text whitespace-nowrap">{fmt(r.pdDue!)}</td>
                      <td className="py-2.5 px-4 text-right">{dueBadge(daysBetween(today, r.pdDue!), 'PD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="md:hidden divide-y divide-border-custom/60">
                {aiCows.map(r => (
                  <div key={r.h.id} onClick={() => open(r.h.id)} className="px-4 py-3.5 active:bg-brand/5">
                    <div className="flex items-center justify-between gap-2">
                      <Name h={r.h} />
                      {dueBadge(daysBetween(today, r.pdDue!), 'PD')}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                      {stat('AI Date', fmt(r.latestAi!.eventDate))}
                      {stat('Bull ID', bullCell(r.latestAi!))}
                      {stat('PD Due', fmt(r.pdDue!))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── All Events Modal ─── */
function AllEventsModal({ isOpen, onClose, events, herds, onAnimalClick, onRefresh }: any) {
  const [filterMode, setFilterMode] = useState<'All' | 'Overdue' | 'Due Soon' | 'Upcoming' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCowId, setSelectedCowId] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  if (!isOpen) return null;

  // Date and Time utility formatting to match AnimalWorkspace
  const fmtDate = (ds: string) => {
    if (!ds) return '—';
    const [y, m, d] = ds.split('-').map(Number);
    return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] || m} ${y}`;
  };

  const getHerdObj = (herdId: number) => herds.find((h: any) => h.id === herdId) || null;

  const { confirm, showToast } = useNotification();

  const markAsDone = async (event: any) => {
    confirm('Mark this task as completed? This will remove the reminder.', async () => {
      try {
        await api.delete(`/herds/events/${event.id}`);
        setSelectedEvent(null);
        showToast('Task marked as completed.', 'success');
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error(err);
        showToast('Failed to mark task as done.', 'error');
      }
    });
  };

  const daysFromNow = (dateStr: string) => {
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - t.getTime()) / 86400000);
  };

  const isReminder = (type: string) => ['VACCINATION_DUE', 'DEWORMING_DUE', 'PREGNANCY_CHECK_DUE'].includes(type);

  const categorize = (e: any) => {
    const d = daysFromNow(e.eventDate);
    if (d < 0 && isReminder(e.eventType)) return 'Overdue';
    if (d >= 0 && d <= 7 && isReminder(e.eventType)) return 'Due Soon';
    if (d < 0 && !isReminder(e.eventType)) return 'Completed';
    return 'Upcoming';
  };

  // Filter out disposed cows
  const nonDisposedEvents = events.filter((e: any) => {
    const herd = getHerdObj(e.herdId);
    if (!herd) return false;
    return herd.status !== 'DISPOSED';
  });

  const activeEvents = nonDisposedEvents;

  const activeCows = herds.filter((h: any) => h.status !== 'DISPOSED');

  const counts = { All: 0, Overdue: 0, 'Due Soon': 0, Upcoming: 0, Completed: 0 };
  activeEvents.forEach((e: any) => {
    const c = categorize(e);
    if (c === 'Overdue') counts.Overdue++;
    else if (c === 'Due Soon') counts['Due Soon']++;
    else if (c === 'Upcoming') counts.Upcoming++;
    else if (c === 'Completed') counts.Completed++;
    if (c !== 'Completed') counts.All++;
  });

  const filteredEvents = activeEvents.filter((e: any) => {
    const herd = getHerdObj(e.herdId);
    if (selectedCowId !== 'All' && String(e.herdId) !== selectedCowId) return false;

    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (herd?.animalName || '').toLowerCase().includes(q) || (herd?.tagNumber || '').toLowerCase().includes(q);
    if (!matchSearch) return false;

    const cat = categorize(e);
    if (filterMode === 'All') return cat !== 'Completed';
    return cat === filterMode;
  }).sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  const cfg = (type: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
      SEMEN_GIVEN:         { icon: Syringe,    color: 'text-purple-600', bg: 'bg-purple-50' },
      PREGNANCY_CONFIRMED: { icon: Heart,       color: 'text-pink-600',   bg: 'bg-pink-50' },
      CALF_DELIVERED:      { icon: Baby,        color: 'text-green-600',  bg: 'bg-green-50' },
      DRY_PERIOD_STARTED:  { icon: Leaf,        color: 'text-amber-600',  bg: 'bg-amber-50' },
      LACTATION_STARTED:   { icon: Droplets,    color: 'text-blue-600',   bg: 'bg-blue-50' },
      VACCINATION_DUE:     { icon: ShieldCheck, color: 'text-teal-600',   bg: 'bg-teal-50' },
      DEWORMING_DUE:       { icon: AlarmClock,  color: 'text-orange-600', bg: 'bg-orange-50' },
      PREGNANCY_CHECK_DUE: { icon: CheckCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    };
    return map[type] || { icon: Activity, color: 'text-text3', bg: 'bg-surface' };
  };

  const StatusBadge = ({ event }: { event: any }) => {
    const d = daysFromNow(event.eventDate);
    const cat = categorize(event);
    if (cat === 'Overdue') return <span className="text-[10px] font-bold text-danger bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">Overdue {Math.abs(d)}d</span>;
    if (cat === 'Due Soon') return <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">{d === 0 ? 'Due Today' : `Due in ${d}d`}</span>;
    if (cat === 'Completed') return <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">Completed</span>;
    return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">In {d}d</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[2000] flex items-center justify-center p-2 md:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] md:max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0"
             style={{ background: 'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-1.5 rounded-lg"><Calendar size={16} className="text-white" /></div>
            <div>
              <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Events</h2>
              <p className="text-[10px] text-white/75 font-semibold uppercase mt-0.5">Manage important events and take action on pending tasks.</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-full transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ── Left: List ── */}
          <div className={`flex flex-col flex-1 overflow-hidden min-w-0 ${selectedEvent ? 'hidden md:flex' : 'flex'}`}>

            {/* Compact stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-border-custom bg-surface/40 shrink-0">
              {[
                { label: 'Overdue Tasks',     count: counts.Overdue,        icon: ShieldAlert,  color: 'text-danger',      bg: 'bg-red-50',    sub: 'Require immediate action' },
                { label: 'Due Soon (7 Days)', count: counts['Due Soon'],    icon: Clock,        color: 'text-orange-600',  bg: 'bg-orange-50', sub: 'Action needed soon' },
                { label: 'Upcoming Tasks',    count: counts.Upcoming,       icon: Calendar,     color: 'text-blue-600',    bg: 'bg-blue-50',   sub: 'Scheduled events' },
                { label: 'Total Active',      count: counts.All,            icon: Activity,     color: 'text-brand',       bg: 'bg-green-50',  sub: 'Active tasks total' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white rounded-xl p-2 md:p-2.5 border border-border-custom shadow-sm">
                    <div className="flex items-center gap-1.5 mb-0.5 md:mb-1">
                      <div className={`${card.bg} p-0.5 md:p-1 rounded-md`}><Icon size={12} className={card.color} /></div>
                      <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider leading-tight ${card.color}`}>{card.label}</span>
                    </div>
                    <div className="text-lg md:text-2xl font-black text-text leading-none">{card.count}</div>
                    <div className="text-[9px] md:text-[10px] text-text3 font-medium mt-0.5 truncate">{card.sub}</div>
                  </div>
                );
              })}
            </div>

            {/* Search + Filter tabs */}
            <div className="px-4 py-2.5 flex gap-2 items-center border-b border-border-custom shrink-0 bg-white flex-wrap">
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:flex-none">
                  <input
                    type="text"
                    placeholder="Search cow name or ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-surface border border-border-custom rounded-lg py-1.5 pl-7 pr-3 text-[12px] font-semibold focus:outline-none focus:border-brand w-full sm:w-44"
                  />
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <select
                  value={selectedCowId}
                  onChange={e => { setSelectedCowId(e.target.value); setSelectedEvent(null); }}
                  className="bg-surface border border-border-custom rounded-lg py-1.5 px-3 text-[12px] font-semibold focus:outline-none focus:border-brand flex-1 sm:flex-none sm:w-48 text-text truncate"
                >
                  <option value="All">All Animals</option>
                  {activeCows.map((cow: any) => (
                    <option key={cow.id} value={String(cow.id)}>
                      {cow.animalName || 'Unnamed'} ({cow.tagNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto flex-1 py-1 sm:py-0">
                {(['All', 'Overdue', 'Due Soon', 'Upcoming', 'Completed'] as const).map(tab => (
                  <button
                     key={tab}
                     onClick={() => { setFilterMode(tab); setSelectedEvent(null); }}
                     className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                       filterMode === tab
                         ? 'bg-brand text-white shadow-sm'
                         : 'bg-surface border border-border-custom text-text2 hover:text-brand hover:border-brand'
                     }`}
                  >
                    {tab} <span className="opacity-60">({counts[tab as keyof typeof counts]})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div className="hidden md:grid px-4 py-2 border-b border-border-custom bg-surface/50 shrink-0 text-[10px] font-black uppercase tracking-widest text-text3"
                 style={{ gridTemplateColumns: '1.1fr 1.6fr 100px 130px 80px' }}>
              <div>COW</div><div>EVENT & STATUS</div><div>EVENT DATE</div><div>DUE / OVERDUE</div><div className="text-center">ACTION</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-custom">
              {filteredEvents.length === 0 ? (
                <div className="py-10 text-center text-text3 text-sm font-medium">No events found.</div>
              ) : filteredEvents.map((event: any) => {
                const herd = getHerdObj(event.herdId);
                const d = daysFromNow(event.eventDate);
                const cat = categorize(event);
                const isSelected = selectedEvent?.id === event.id;
                const { icon: EvIcon, color: evColor, bg: evBg } = cfg(event.eventType);
                const initials = herd?.animalName ? herd.animalName.substring(0, 2).toUpperCase() : '??';
                const imgUrl = herd?.imageUrl ? formatImageUrl(herd.imageUrl) : null;

                return (
                  <React.Fragment key={event.id}>
                    {/* Desktop Row */}
                    <div
                      onClick={() => setSelectedEvent(isSelected ? null : event)}
                      className={`hidden md:grid px-4 py-3 cursor-pointer transition-colors items-center border-l-2 ${
                        isSelected ? 'bg-brand/5 border-brand' : 'hover:bg-surface/60 border-transparent'
                      }`}
                      style={{ gridTemplateColumns: '1.1fr 1.6fr 100px 130px 80px' }}
                    >
                      {/* Cow */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 border flex items-center justify-center bg-gray-200 font-black text-[11px] text-white ${
                          cat === 'Overdue' ? 'border-red-300' : cat === 'Due Soon' ? 'border-orange-300' : 'border-border-custom'
                        }`}>
                          {imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-500">{initials}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-[12px] uppercase truncate text-text">{herd?.animalName || 'Unknown'}</div>
                          <div className="text-[10px] font-mono text-text3 truncate">ID: {herd?.tagNumber}</div>
                          {herd?.animalStatus && (
                            <span className="text-[10px] font-bold uppercase bg-surface border border-border-custom text-text3 px-1 py-0.5 rounded">{herd.animalStatus.replace('_', ' ')}{(herd.calculatedAge || herd.age) ? ` • ${herd.calculatedAge || herd.age}` : ''}</span>
                          )}
                        </div>
                      </div>

                      {/* Event */}
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${evBg}`}>
                          <EvIcon size={13} className={evColor} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[12px] text-text truncate">{event.title}</div>
                          <div className="text-[11px] text-text3 truncate">{event.details || event.eventType.replace(/_/g, ' ')}</div>
                          {cat === 'Overdue' && <span className="text-[10px] font-bold bg-red-100 text-danger px-1 py-0.5 rounded mt-0.5 inline-block">Action Required</span>}
                          {cat === 'Due Soon' && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1 py-0.5 rounded mt-0.5 inline-block">Due Soon</span>}
                          {cat === 'Completed' && <span className="text-[10px] font-bold bg-green-100 text-green-600 px-1 py-0.5 rounded mt-0.5 inline-block">Completed</span>}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="text-[12px] font-semibold text-text2">
                        {fmtDate(event.eventDate)}
                      </div>

                      {/* Due/Overdue */}
                      <div>
                        {cat === 'Overdue' && <><div className="font-black text-[12px] text-danger">Overdue by {Math.abs(d)} days</div><div className="text-[10px] text-text3">Action required</div></>}
                        {cat === 'Due Soon' && <><div className="font-black text-[12px] text-orange-500">{d === 0 ? 'Due Today' : `Due in ${d}d`}</div><div className="text-[10px] text-text3">Scheduled</div></>}
                        {cat === 'Completed' && <><div className="font-black text-[12px] text-green-600">Completed</div><div className="text-[10px] text-text3">on {fmtDate(event.eventDate).substring(0, 6)}</div></>}
                        {cat === 'Upcoming' && <><div className="font-black text-[12px] text-blue-600">In {d} days</div><div className="text-[10px] text-text3">Scheduled</div></>}
                      </div>

                      {/* Action */}
                      <div className="flex items-center justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedEvent(isSelected ? null : event); }}
                          className="flex items-center gap-0.5 px-2.5 py-1.5 border border-brand text-brand hover:bg-brand hover:text-white rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
                        >
                          View <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Card View */}
                    <div
                      onClick={() => setSelectedEvent(isSelected ? null : event)}
                      className={`md:hidden p-4 flex flex-col gap-3 relative border-l-2 transition-colors cursor-pointer bg-white ${
                        isSelected ? 'bg-brand/5 border-brand' : 'hover:bg-surface/40 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border flex items-center justify-center bg-gray-200 font-black text-[11px] text-white ${
                            cat === 'Overdue' ? 'border-red-300' : cat === 'Due Soon' ? 'border-orange-300' : 'border-border-custom'
                          }`}>
                            {imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-500">{initials}</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-[12px] uppercase truncate text-text">{herd?.animalName || 'Unknown'}</div>
                            <div className="text-[10px] font-mono text-text3 truncate">ID: {herd?.tagNumber}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-text2">{fmtDate(event.eventDate)}</div>
                          <div className="mt-0.5"><StatusBadge event={event} /></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-surface/50 p-2.5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${evBg}`}>
                            <EvIcon size={12} className={evColor} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[11px] text-text truncate">{event.title}</div>
                            <div className="text-[10px] text-text3 truncate mt-0.5">{event.details || event.eventType.replace(/_/g, ' ')}</div>
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedEvent(isSelected ? null : event); }}
                          className="flex items-center gap-0.5 px-2 py-1.5 border border-brand text-brand hover:bg-brand hover:text-white rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                        >
                          View <ChevronRight size={10} />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border-custom bg-white flex justify-between items-center shrink-0">
              <span className="text-[11px] text-text3 font-medium">Showing {filteredEvents.length} of {activeEvents.length} tasks</span>
              <button onClick={onClose} className="bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-colors shadow-sm">
                CLOSE PANEL
              </button>
            </div>
          </div>

          {/* ── Right: Detail Panel ── */}
          {selectedEvent && (() => {
            const herd = getHerdObj(selectedEvent.herdId);
            const d = daysFromNow(selectedEvent.eventDate);
            const cat = categorize(selectedEvent);
            const { icon: EvIcon, color: evColor, bg: evBg } = cfg(selectedEvent.eventType);
            const initials = herd?.animalName ? herd.animalName.substring(0, 2).toUpperCase() : '??';
            const imgUrl = herd?.imageUrl ? formatImageUrl(herd.imageUrl) : null;
            return (
              <div className="w-full md:w-64 md:shrink-0 border-l border-border-custom flex flex-col bg-white overflow-hidden">
                {/* Detail header */}
                <div className="p-3 border-b border-border-custom flex items-center gap-2 bg-surface/30">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-border-custom flex items-center justify-center bg-gray-200 font-black text-[12px] shrink-0">
                    {imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-gray-500">{initials}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-[13px] uppercase truncate text-text">{herd?.animalName || 'Unknown'}</div>
                    <div className="text-[10px] font-mono text-text3">ID: {herd?.tagNumber}</div>
                    <StatusBadge event={selectedEvent} />
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="text-text3 hover:text-text shrink-0 ml-auto"><X size={14} /></button>
                </div>

                {/* Event Info */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[12px]">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${evBg}`}>
                      <EvIcon size={14} className={evColor} />
                    </div>
                    <div>
                      <div className="font-bold text-[13px] text-text">{selectedEvent.title}</div>
                      {cat === 'Overdue' && <span className="text-[10px] font-bold bg-red-100 text-danger px-1.5 py-0.5 rounded">Action Required</span>}
                    </div>
                  </div>

                  <div className="space-y-0 divide-y divide-border-custom">
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-1.5 text-text3 font-semibold"><Calendar size={11} /> Event Date</div>
                      <div className="font-bold text-text">{fmtDate(selectedEvent.eventDate)}</div>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-1.5 text-text3 font-semibold"><Clock size={11} /> Status</div>
                      <StatusBadge event={selectedEvent} />
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-1.5 text-text3 font-semibold"><AlertTriangle size={11} /> Due</div>
                      <div className={`font-bold ${d < 0 ? 'text-danger' : d === 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `in ${d} days`}
                      </div>
                    </div>
                    {selectedEvent.details && (
                      <div className="py-2">
                        <div className="text-text3 font-semibold mb-1 text-[11px]">Details</div>
                        <div className="text-text2 font-medium bg-surface rounded-lg p-2 text-[11px] leading-relaxed">{selectedEvent.details}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-3 border-t border-border-custom shrink-0 space-y-2">
                  <button
                    onClick={() => markAsDone(selectedEvent)}
                    className="w-full flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all"
                  >
                    <CheckCircle size={12} /> Mark as Done
                  </button>
                  <button
                    onClick={() => { if (herd) { onAnimalClick(herd.id); onClose(); } }}
                    className="w-full flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all"
                  >
                    <Activity size={12} /> Go to Animal Timeline
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
