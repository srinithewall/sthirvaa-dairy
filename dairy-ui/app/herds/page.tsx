'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import {
  Plus, X, Activity, Calendar, Trash2, Edit2, Archive, Clock,
  CheckCircle, AlertTriangle, Syringe, Baby, Droplets, Leaf,
  ChevronRight, ShieldCheck, Heart, TrendingUp, AlarmClock,
  PlusCircle, Info, ShieldAlert, AlertCircle
} from 'lucide-react';
import RegisterAnimalModal from '@/components/RegisterAnimalModal';
import AnimalWorkspace from '@/components/AnimalWorkspace';
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
  const [showAllEventsModal, setShowAllEventsModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ 'COW': true });
  const [userRole, setUserRole] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
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

  /* ──────────────────────────────── MAIN RENDER ──────────────────────────────── */
  return (
    <AppLayout noPadding={showModal && !!selectedHerd}>
      {/* ══ ANIMAL WORKSPACE (replaces herd list when animal is selected) ══ */}
      {showModal && selectedHerd ? (
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
          onImageError={(id) => setFailedImages(prev => ({ ...prev, [id]: true }))}
        />
      ) : (
      <>
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
                            <span className="text-[10px] font-bold uppercase bg-surface border border-border-custom text-text3 px-1 py-0.5 rounded">{herd.animalStatus.replace('_', ' ')}{herd.age ? ` • ${herd.age}` : ''}</span>
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
