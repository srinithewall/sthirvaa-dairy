'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import {
  Plus, X, Activity, Calendar, Trash2, Edit2, Archive, Clock,
  CheckCircle, AlertTriangle, Syringe, Baby, Droplets, Leaf,
  ChevronRight, ShieldCheck, Heart, TrendingUp, AlarmClock,
  PlusCircle, Info
} from 'lucide-react';
import RegisterAnimalModal from '@/components/RegisterAnimalModal';
import { useNotification } from '@/components/NotificationContext';

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
  imageUrl?: string;
}

interface HerdEvent {
  id: number;
  herdId: number;
  eventDate: string;
  eventType: string;
  title: string;
  details?: string;
  createdAt: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  SEMEN_GIVEN:         { icon: Syringe,       color: 'text-purple-600',  bg: 'bg-purple-100',  label: 'AI / Semen' },
  PREGNANCY_CONFIRMED: { icon: Heart,          color: 'text-pink-600',    bg: 'bg-pink-100',    label: 'Pregnancy' },
  CALF_DELIVERED:      { icon: Baby,           color: 'text-green-600',   bg: 'bg-green-100',   label: 'Calving' },
  DRY_PERIOD_STARTED:  { icon: Leaf,           color: 'text-amber-600',   bg: 'bg-amber-100',   label: 'Dry Period' },
  LACTATION_STARTED:   { icon: Droplets,       color: 'text-blue-600',    bg: 'bg-blue-100',    label: 'Lactation' },
  VACCINATION_DUE:     { icon: ShieldCheck,    color: 'text-teal-600',    bg: 'bg-teal-100',    label: 'Vaccination' },
  DEWORMING_DUE:       { icon: AlarmClock,     color: 'text-orange-600',  bg: 'bg-orange-100',  label: 'Deworming' },
  PREGNANCY_CHECK_DUE: { icon: CheckCircle,    color: 'text-indigo-600',  bg: 'bg-indigo-100',  label: 'PD Check' },
};

const REMINDER_TYPES = ['VACCINATION_DUE', 'DEWORMING_DUE', 'PREGNANCY_CHECK_DUE'];

export default function HerdsPage() {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHerd, setSelectedHerd] = useState<Herd | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDisposedModal, setShowDisposedModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ 'COW': true });
  const [userRole, setUserRole] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const { showToast, confirm } = useNotification();

  // Events & Timeline
  const [events, setEvents] = useState<HerdEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'repro' | 'timeline'>('info');

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDeleteHerd = (id: number) => {
    confirm('Are you sure you want to permanently delete this animal record?', async () => {
      try {
        await api.delete(`/herds/${id}`);
        showToast('Animal record deleted successfully!');
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
      setActiveTab('info');
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

  /* ─────────────────────────── CATEGORY ROW ─────────────────────────── */
  const CategoryRow = ({ title, count, items, isSub = false, canExpand = false, type = '' }: any) => {
    const isExpanded = expandedRows[type];
    return (
      <div className={`flex flex-col md:flex-row border-b border-border-custom transition-colors overflow-visible ${isSub ? 'bg-surface2/10' : 'hover:bg-surface'}`}>
        <div className="flex items-center justify-between md:contents">
          <div
            className={`flex-1 md:flex-none md:w-[220px] py-4 px-4 font-bold text-text md:border-r border-border-custom flex items-center gap-3 ${isSub ? 'pl-8 md:pl-10 text-[12px] md:text-[13px] font-medium' : 'text-[14px]'} ${canExpand ? 'cursor-pointer' : ''}`}
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
          <div className="w-[60px] py-4 text-center border-l md:border-l-0 md:border-r border-border-custom font-bold text-text bg-surface md:bg-transparent text-[14px]">
            {count || 0}
          </div>
        </div>
        <div className="flex-1 p-3 flex flex-wrap gap-2 items-start justify-start bg-white/50 overflow-visible">
          {items.map((item: Herd) => {
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
                className={`relative w-[48px] md:w-[52px] h-[48px] md:h-[52px] rounded-lg overflow-hidden border border-black/10 shadow-sm cursor-pointer transition-all duration-250 ease-out active:scale-95 group z-0 hover:z-50 hover:scale-[2.4] hover:shadow-2xl flex items-center justify-center select-none ${tagColor}`}
              >
                {imgUrl
                  ? <img src={imgUrl} alt={item.animalName || item.tagNumber} onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))} className="w-full h-full object-cover" />
                  : <span className="text-[12px] md:text-[13px] font-black text-white uppercase drop-shadow tracking-tighter pb-1">{initials}</span>}
                <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-white shadow-sm z-10 ${item.healthStatus === 'HEALTHY' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-0.5 text-center z-10 backdrop-blur-[0.5px]">
                  <div className="text-[7.5px] font-black text-white truncate uppercase tracking-tighter leading-none scale-[0.95] origin-center">
                    {item.animalName || '—'}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="text-[11px] text-text3 italic py-1 pl-2">No records found</div>}
        </div>
      </div>
    );
  };

  const activeHerds = herds.filter(h => h.status !== 'DISPOSED');

  /* ─────────────────────────── MAIN RENDER ─────────────────────────── */
  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="px-1">
          <h1 className="text-xl md:text-2xl font-black text-text tracking-tight uppercase">Herd Management</h1>
          <p className="text-[12px] text-text3 mt-0.5 underline font-medium">Sthirvaa Farms Dashboard</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowDisposedModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border-custom bg-white hover:bg-surface text-text3 hover:text-brand rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm"
            title="View Disposed Animals Archive"
          >
            <Archive size={14} />
            <span>Disposed ({herds.filter(h => h.status === 'DISPOSED').length})</span>
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
        {/* Milk Production Section */}
        <div>
          <div className="bg-[#FFCCBC] py-2.5 px-5 font-black text-[#BF360C] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Milk Production Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <CategoryRow title="Lactation Cows" type="COW" canExpand={true}
              count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING').length}
              items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING')} />
            {expandedRows['COW'] && (
              <>
                <CategoryRow title="Remaining Cows" isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && h.animalStatus !== 'CALF').length}
                  items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && h.animalStatus !== 'CALF')} />
                <CategoryRow title="Calf" isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF').length}
                  items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF')} />
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
          <div className="bg-[#E1F5FE] py-2.5 px-5 font-black text-[#0277BD] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Meat / Poultry Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <CategoryRow title="Chicken" count={activeHerds.filter(h => h.animalType === 'CHICKEN').length} items={activeHerds.filter(h => h.animalType === 'CHICKEN')} />
            <CategoryRow title="Fishes"  count={activeHerds.filter(h => h.animalType === 'FISH').length}    items={activeHerds.filter(h => h.animalType === 'FISH')} />
            <CategoryRow title="Duck"    count={activeHerds.filter(h => h.animalType === 'DUCK').length}    items={activeHerds.filter(h => h.animalType === 'DUCK')} />
          </div>
        </div>
      </div>

      {/* ═══════════════════ ANIMAL DETAIL MODAL ═══════════════════ */}
      {showModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:rounded-[2rem] shadow-2xl sm:max-w-4xl sm:mx-4 flex flex-col sm:flex-row animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden"
               style={{ maxHeight: '96dvh' }}>

            {/* ── Left: Animal Hero Panel ── */}
            <div className={`relative w-full sm:w-[38%] sm:flex-shrink-0 flex flex-col justify-end bg-slate-900 overflow-hidden`}
                 style={{ minHeight: '200px', maxHeight: '280px' }}>
              {/* Background image or color */}
              {selectedHerd.imageUrl && !failedImages[selectedHerd.id]
                ? <img src={formatImageUrl(selectedHerd.imageUrl)} alt={selectedHerd.animalName}
                       onError={() => setFailedImages(prev => ({ ...prev, [selectedHerd.id]: true }))}
                       className="absolute inset-0 w-full h-full object-cover opacity-80" />
                : <div className={`absolute inset-0 flex items-center justify-center ${getAnimalColor(selectedHerd)}`}>
                    <Activity size={72} className="text-white/20 animate-pulse" />
                  </div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              {/* Hero text */}
              <div className="relative z-10 p-5 sm:p-7 text-white">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="px-2.5 py-0.5 bg-brand text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-md">
                    {selectedHerd.animalType}
                  </span>
                  <span className={`px-2.5 py-0.5 text-white text-[9px] font-black rounded-full uppercase tracking-widest backdrop-blur-sm ${
                    selectedHerd.animalStatus === 'LACTATING' ? 'bg-blue-500/70'
                    : selectedHerd.animalStatus === 'CALF'    ? 'bg-green-500/70'
                    : 'bg-white/25'
                  }`}>
                    {selectedHerd.animalStatus}
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest ${
                    selectedHerd.healthStatus === 'HEALTHY' ? 'bg-green-500/70 text-white' : 'bg-red-500/70 text-white'
                  }`}>
                    {selectedHerd.healthStatus}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight drop-shadow-lg">
                  {selectedHerd.animalName || 'Unnamed'}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-white/60 font-mono">{selectedHerd.tagNumber}</span>
                  {selectedHerd.breed && <span className="text-[10px] text-white/50">• {selectedHerd.breed} {selectedHerd.milkType && selectedHerd.milkType !== 'N/A' ? `(${selectedHerd.milkType})` : ''}</span>}
                </div>
                {selectedHerd.age && (
                  <div className="mt-2 text-[11px] text-white/70 font-semibold">🎂 {selectedHerd.age}</div>
                )}
              </div>
            </div>

            {/* ── Right: Tabbed Content ── */}
            <div className="flex-1 flex flex-col overflow-hidden sm:h-auto" style={{ maxHeight: 'calc(96dvh - 200px)', minHeight: 0 }}>
              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 z-[50] sm:z-[30] bg-black/40 sm:bg-surface/80 text-white sm:text-text3 hover:text-brand p-2 rounded-xl transition-all backdrop-blur-sm"
              >
                <X size={16} />
              </button>

              {/* Tabs */}
              <div className="flex border-b border-border-custom bg-surface/60 gap-0.5 p-1.5 flex-shrink-0">
                {(['info', 'repro', 'timeline'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                      activeTab === tab ? 'bg-white text-brand shadow-sm border border-border-custom' : 'text-text3 hover:text-text'
                    }`}
                  >
                    {tab === 'info'     && <Info size={11} />}
                    {tab === 'repro'    && <Heart size={11} />}
                    {tab === 'timeline' && <Activity size={11} />}
                    <span>{tab === 'info' ? 'General' : tab === 'repro' ? 'Repro' : 'Timeline'}</span>
                    {tab === 'timeline' && events.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'timeline' ? 'bg-brand/10 text-brand' : 'bg-black/5 text-text3'}`}>
                        {events.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content - scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0">

                {/* ── TAB: General Info ── */}
                {activeTab === 'info' && (
                  <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5 bg-surface/50 p-5 rounded-2xl border border-border-custom">
                      {[
                        { label: 'Animal Name',  value: selectedHerd.animalName || 'N/A' },
                        { label: 'Breed',        value: `${selectedHerd.breed || 'N/A'} ${selectedHerd.milkType && selectedHerd.milkType !== 'N/A' ? `(${selectedHerd.milkType})` : ''}`.trim() },
                        { label: 'Age',          value: selectedHerd.age || 'N/A', highlight: true },
                        { label: 'Birth Date',   value: selectedHerd.birthDate || 'N/A' },
                        { label: 'Procured Date',value: selectedHerd.procuredDate || '—' },
                        { label: 'Source',       value: selectedHerd.source || '—' },
                      ].map(({ label, value, highlight }) => (
                        <div key={label}>
                          <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">{label}</label>
                          <div className={`text-[13px] sm:text-[14px] font-${highlight ? 'extrabold text-brand-dark' : 'semibold text-text2'}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Status badges */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-border-custom rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedHerd.healthStatus === 'HEALTHY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                        <div>
                          <div className="text-[8px] font-black text-text3 uppercase tracking-widest">Health</div>
                          <div className={`text-[12px] font-black uppercase ${selectedHerd.healthStatus === 'HEALTHY' ? 'text-green-700' : 'text-danger'}`}>{selectedHerd.healthStatus}</div>
                        </div>
                      </div>
                      <div className="bg-white border border-border-custom rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedHerd.status !== 'DISPOSED' ? 'bg-brand' : 'bg-amber-400'}`} />
                        <div>
                          <div className="text-[8px] font-black text-text3 uppercase tracking-widest">Record</div>
                          <div className="text-[12px] font-black uppercase text-text">{selectedHerd.status || 'ACTIVE'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {userRole === 'ADMIN' && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => { setShowModal(false); setShowEditModal(true); }}
                          className="bg-brand/10 text-brand border border-brand/20 py-3 rounded-2xl font-black uppercase tracking-wider hover:bg-brand/20 transition-all text-[10px] sm:text-[11px] active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <Edit2 size={13} /> Edit Animal
                        </button>
                        <button
                          onClick={() => handleDeleteHerd(selectedHerd.id)}
                          className="bg-danger/10 text-danger border border-danger/20 py-3 rounded-2xl font-black uppercase tracking-wider hover:bg-danger/20 transition-all text-[10px] sm:text-[11px] active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB: Reproduction ── */}
                {activeTab === 'repro' && (() => {
                  const stats = getReproductionStats();
                  const reminders = events.filter(e => REMINDER_TYPES.includes(e.eventType));
                  const gestation = selectedHerd.animalType === 'BUFFALO' ? 310 : 283;

                  return (
                    <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
                      {/* Pregnancy Status Card */}
                      <div className={`rounded-2xl p-5 border ${stats.isPregnant ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200' : 'bg-surface/50 border-border-custom'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-text2">
                            <Heart size={13} className={stats.isPregnant ? 'text-pink-500' : 'text-text3'} />
                            Reproduction Status
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            stats.isPregnant ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {stats.isPregnant ? '🤰 Pregnant' : 'Not Pregnant'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                            <div className="text-[8px] font-black text-text3 uppercase tracking-widest mb-1">AI Attempts</div>
                            <div className="text-[20px] font-black text-text">{stats.aiAttempts}</div>
                            <div className="text-[9px] text-text3">since last calving</div>
                          </div>
                          <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                            <div className="text-[8px] font-black text-text3 uppercase tracking-widest mb-1">Last AI Date</div>
                            <div className="text-[13px] font-bold text-text2">{stats.lastAi || '—'}</div>
                            <div className="text-[9px] text-text3">insemination</div>
                          </div>
                          {stats.isPregnant && stats.expectedDelivery && (
                            <div className="bg-purple-100/60 rounded-xl p-3 border border-purple-200/50 col-span-2 sm:col-span-1">
                              <div className="text-[8px] font-black text-purple-500 uppercase tracking-widest mb-1">Expected Calving</div>
                              <div className="text-[13px] font-bold text-purple-700">{stats.expectedDelivery}</div>
                              <div className="text-[9px] text-purple-400">{stats.daysPregnant} days pregnant</div>
                            </div>
                          )}
                        </div>

                        {/* Gestation progress bar */}
                        {stats.isPregnant && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-black text-text3 uppercase tracking-widest">Gestation Progress</span>
                              <span className="text-[10px] font-black text-purple-600">{stats.gestationPct}%</span>
                            </div>
                            <div className="h-3 bg-white/60 rounded-full border border-purple-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-700 relative"
                                style={{ width: `${stats.gestationPct}%` }}
                              >
                                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                              </div>
                            </div>
                            <div className="flex justify-between mt-1 text-[8px] text-text3">
                              <span>Insemination</span>
                              <span>{gestation} days total</span>
                              <span>Calving</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Upcoming Reminders */}
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-text2 mb-3">
                          <AlarmClock size={13} className="text-amber-500" />
                          Upcoming Reminders
                          {reminders.length > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold border border-amber-200">{reminders.length}</span>
                          )}
                        </h3>
                        {reminders.length === 0 ? (
                          <div className="p-5 text-center text-xs text-text3 italic bg-surface/30 rounded-2xl border border-dashed border-border-custom">
                            No upcoming reminders scheduled for this animal.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {reminders.map(rem => {
                              const cfg = EVENT_CONFIG[rem.eventType] || EVENT_CONFIG.VACCINATION_DUE;
                              const Icon = cfg.icon;
                              const isPast = new Date(rem.eventDate) < new Date();
                              return (
                                <div key={rem.id} className={`rounded-2xl p-4 flex items-start gap-3 relative group border ${
                                  isPast ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                                }`}>
                                  <div className={`p-2 rounded-xl flex-shrink-0 ${isPast ? 'bg-red-100 text-red-600' : `${cfg.bg} ${cfg.color}`}`}>
                                    <Icon size={15} />
                                  </div>
                                  <div className="flex-1 min-w-0 pr-8">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-[13px] text-text">{rem.title}</span>
                                      {isPast && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">Overdue</span>}
                                    </div>
                                    <div className="text-[11px] text-text3 font-semibold mt-0.5">📅 {rem.eventDate}</div>
                                    {rem.details && <div className="text-[11px] text-text2 mt-1.5 bg-white/60 p-2 rounded-xl leading-relaxed">{rem.details}</div>}
                                  </div>
                                  {userRole === 'ADMIN' && (
                                    <button
                                      onClick={() => handleDeleteEvent(rem.id)}
                                      className="absolute right-3 top-3 p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── TAB: Timeline ── */}
                {activeTab === 'timeline' && (
                  <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-text2">
                        <Activity size={13} className="text-brand" />
                        Events Timeline
                        <span className="text-[9px] text-text3 font-semibold normal-case tracking-normal">(newest first)</span>
                      </h3>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setEventDate(new Date().toISOString().split('T')[0]);
                            setEventType('SEMEN_GIVEN');
                            setEventDetailsText('');
                            setShowAddEventModal(true);
                          }}
                          className="bg-brand text-white flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-brand-dark transition-all shadow active:scale-95"
                        >
                          <Plus size={12} /> Add Event
                        </button>
                      )}
                    </div>

                    {loadingEvents ? (
                      <div className="py-10 text-center">
                        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <div className="text-xs text-text3">Loading events...</div>
                      </div>
                    ) : events.length === 0 ? (
                      <div className="py-10 text-center">
                        <Activity size={32} className="text-border-custom mx-auto mb-2" />
                        <div className="text-xs text-text3 font-semibold">No timeline events logged yet.</div>
                        {userRole === 'ADMIN' && (
                          <button
                            onClick={() => { setEventDate(new Date().toISOString().split('T')[0]); setEventType('SEMEN_GIVEN'); setShowAddEventModal(true); }}
                            className="mt-3 text-xs text-brand font-bold underline underline-offset-2 hover:text-brand-dark"
                          >
                            + Add the first event
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="relative pl-7 border-l-2 border-border-custom space-y-5">
                        {events.map(evt => {
                          const cfg = EVENT_CONFIG[evt.eventType] || { icon: Calendar, color: 'text-text3', bg: 'bg-surface', label: evt.eventType };
                          const Icon = cfg.icon;
                          const isReminder = REMINDER_TYPES.includes(evt.eventType);
                          const isPast = isReminder && new Date(evt.eventDate) < new Date();
                          return (
                            <div key={evt.id} className="relative group">
                              {/* Node */}
                              <div className={`absolute -left-[37px] top-1 w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                                <Icon size={13} />
                              </div>
                              {/* Card */}
                              <div className={`rounded-2xl p-4 border relative pr-10 transition-all ${
                                isPast   ? 'bg-red-50 border-red-200' :
                                isReminder ? 'bg-amber-50 border-amber-200' : 'bg-white border-border-custom hover:border-brand/30 hover:shadow-sm'
                              }`}>
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                    <span className="font-extrabold text-[13px] text-text">{evt.title}</span>
                                    {isPast && <span className="text-[8px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200 uppercase">Overdue</span>}
                                  </div>
                                  <span className="text-[10px] font-bold text-text3 font-mono flex-shrink-0">📅 {evt.eventDate}</span>
                                </div>
                                {evt.details && (
                                  <p className="text-[11px] text-text2 mt-2 bg-black/3 p-2.5 rounded-xl border border-black/5 leading-relaxed">
                                    {evt.details}
                                  </p>
                                )}
                                {userRole === 'ADMIN' && (
                                  <button
                                    onClick={() => handleDeleteEvent(evt.id)}
                                    className="absolute right-3 top-3 p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete Event"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Close Button */}
              <div className="p-3 sm:p-4 border-t border-border-custom bg-surface/40 flex-shrink-0">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-brand-dark text-white py-3 rounded-2xl font-black uppercase tracking-[0.15em] hover:bg-black transition-all shadow-md text-[11px] active:scale-[0.98]"
                >
                  Close Animal Record
                </button>
              </div>
            </div>
          </div>
        </div>
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
                <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Details & Remarks</label>
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
                    <span className="text-[8px] font-black uppercase bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">{item.animalType}</span>
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
