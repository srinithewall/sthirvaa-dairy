'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import { Plus, X, ChevronDown, ChevronRight, Info, Table as TableIcon, LayoutGrid, Calendar, Activity, Trash2, Edit2, Archive, Clock, FileText, CheckCircle, AlertCircle, PlusCircle, ShieldAlert } from 'lucide-react';
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

export default function HerdsPage() {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [counts, setCounts] = useState<any>({});
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

  // Events & Timeline states
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'repro' | 'timeline'>('info');

  // "+ Add Event" modal states
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventType, setEventType] = useState('SEMEN_GIVEN');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTitle, setEventTitle] = useState('Semen Given (AI)');
  const [eventDetailsText, setEventDetailsText] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          setUserRole(u.role || '');
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (eventType === 'SEMEN_GIVEN') setEventTitle('Semen Given (AI)');
    else if (eventType === 'PREGNANCY_CONFIRMED') setEventTitle('Pregnancy Confirmed (PD)');
    else if (eventType === 'CALF_DELIVERED') setEventTitle('Calf Delivered');
    else if (eventType === 'DRY_PERIOD_STARTED') setEventTitle('Dry Period Started');
    else if (eventType === 'LACTATION_STARTED') setEventTitle('Lactation Started');
    else if (eventType === 'VACCINATION_DUE') setEventTitle('Vaccination Due');
    else if (eventType === 'DEWORMING_DUE') setEventTitle('Deworming Due');
    else if (eventType === 'PREGNANCY_CHECK_DUE') setEventTitle('Pregnancy Check Due');
  }, [eventType]);

  useEffect(() => {
    fetchHerds();
  }, []);

  const fetchHerds = async () => {
    try {
      const res = await api.get('/herds');
      setHerds(res.data.herds || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHerd = (id: number) => {
    confirm("Are you sure you want to permanently delete this animal record?", async () => {
      try {
        await api.delete(`/herds/${id}`);
        showToast('Animal record deleted successfully!');
        setShowModal(false);
        fetchHerds();
      } catch (err: any) {
        console.error(err);
        showToast(err.response?.data?.message || 'Failed to delete animal record.', 'error');
      }
    }, 'danger');
  };

  const toggleExpand = (type: string) => {
    setExpandedRows(prev => ({ ...prev, [type]: !prev[type] }));
  };

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

      // Fetch timeline events
      setLoadingEvents(true);
      const eventsRes = await api.get(`/herds/${id}/events`);
      setEvents(eventsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHerd) return;
    try {
      const newEvent = {
        eventDate,
        eventType,
        title: eventTitle,
        details: eventDetailsText
      };
      const res = await api.post(`/herds/${selectedHerd.id}/events`, newEvent);
      showToast('Event added successfully!');
      setEvents(prev => [res.data, ...prev]);
      setShowAddEventModal(false);
      setEventDetailsText('');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to add event.', 'error');
    }
  };

  const handleDeleteEvent = (id: number) => {
    confirm("Are you sure you want to delete this event from the timeline?", async () => {
      try {
        await api.delete(`/herds/events/${id}`);
        showToast('Event deleted successfully!');
        setEvents(prev => prev.filter(e => e.id !== id));
      } catch (err: any) {
        console.error(err);
        showToast('Failed to delete event.', 'error');
      }
    }, 'danger');
  };

  const getReproductionStats = () => {
    if (!selectedHerd) return { lastAi: null, isPregnant: false, daysPregnant: 0, expectedDelivery: null, aiAttempts: 0 };
    const aiEvents = events.filter(e => e.eventType === 'SEMEN_GIVEN');
    const pdEvents = events.filter(e => e.eventType === 'PREGNANCY_CONFIRMED');
    const calvingEvents = events.filter(e => e.eventType === 'CALF_DELIVERED');
    
    const lastAi = aiEvents.length > 0 ? aiEvents[0].eventDate : null;
    const lastPd = pdEvents.length > 0 ? pdEvents[0].eventDate : null;
    const lastCalving = calvingEvents.length > 0 ? calvingEvents[0].eventDate : null;
    
    let isPregnant = false;
    let daysPregnant = 0;
    let expectedDelivery: string | null = null;
    
    if (lastPd && (!lastCalving || new Date(lastPd) > new Date(lastCalving))) {
      isPregnant = true;
      if (lastAi) {
        const diffTime = Math.abs(new Date().getTime() - new Date(lastAi).getTime());
        daysPregnant = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Cow average 283 days, Buffalo average 310 days
        const duration = selectedHerd.animalType === 'BUFFALO' ? 310 : 283;
        const deliveryDate = new Date(lastAi);
        deliveryDate.setDate(deliveryDate.getDate() + duration);
        expectedDelivery = deliveryDate.toISOString().split('T')[0];
      }
    }
    
    let aiAttempts = 0;
    if (lastCalving) {
      aiAttempts = aiEvents.filter(e => new Date(e.eventDate) > new Date(lastCalving)).length;
    } else {
      aiAttempts = aiEvents.length;
    }
    
    return {
      lastAi,
      isPregnant,
      daysPregnant,
      expectedDelivery,
      aiAttempts: aiAttempts || aiEvents.length || 0
    };
  };

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
                  {isExpanded ? (
                    <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"/></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M5 5V1a1 1 0 012 0v4h4a1 1 0 010 2H7v4a1 1 0 01-2 0V7H1a1 1 0 010-2h4z"/></svg>
                  )}
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
              : item.tagNumber 
                ? item.tagNumber.substring(0, 2).toUpperCase()
                : '??';

            return (
              <div
                key={item.id}
                onClick={() => handleHerdClick(item.id)}
                className={`relative w-[48px] md:w-[52px] h-[48px] md:h-[52px] rounded-lg overflow-hidden border border-black/10 shadow-sm cursor-pointer transition-all duration-250 ease-out active:scale-95 group z-0 hover:z-50 hover:scale-[2.4] hover:shadow-2xl flex items-center justify-center select-none ${tagColor}`}
              >
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={item.animalName || item.tagNumber}
                    onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))}
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                ) : (
                  <span className="text-[12px] md:text-[13px] font-black text-white uppercase drop-shadow tracking-tighter pb-1">
                    {initials}
                  </span>
                )}

                {/* Health status dot - absolute top right */}
                <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-white shadow-sm z-10 ${item.healthStatus === 'HEALTHY' ? 'bg-green-500' : 'bg-red-500'}`} />

                {/* Bottom name overlay */}
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
            <CategoryRow 
              title="Lactation Cows" 
              type="COW"
              canExpand={true}
              count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING').length} 
              items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING')} 
            />
            
            {expandedRows['COW'] && (
              <>
                <CategoryRow 
                  title="Remaining Cows" 
                  isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && h.animalStatus !== 'CALF').length} 
                  items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus !== 'LACTATING' && h.animalStatus !== 'CALF')} 
                />
                <CategoryRow 
                  title="Calf" 
                  isSub={true}
                  count={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF').length} 
                  items={activeHerds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF')} 
                />
              </>
            )}
            
            <CategoryRow title="Buffalo" count={activeHerds.filter(h => h.animalType === 'BUFFALO').length} items={activeHerds.filter(h => h.animalType === 'BUFFALO')} />
            <CategoryRow title="Goat" count={activeHerds.filter(h => h.animalType === 'GOAT').length} items={activeHerds.filter(h => h.animalType === 'GOAT')} />
          </div>
        </div>

        {/* Meat Section */}
        <div>
          <div className="bg-[#E1F5FE] py-2.5 px-5 font-black text-[#0277BD] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Meat / Poultry Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <CategoryRow title="Chicken" count={activeHerds.filter(h => h.animalType === 'CHICKEN').length} items={activeHerds.filter(h => h.animalType === 'CHICKEN')} />
            <CategoryRow title="Fishes" count={activeHerds.filter(h => h.animalType === 'FISH').length} items={activeHerds.filter(h => h.animalType === 'FISH')} />
            <CategoryRow title="Duck" count={activeHerds.filter(h => h.animalType === 'DUCK').length} items={activeHerds.filter(h => h.animalType === 'DUCK')} />
          </div>
        </div>
      </div>

      {/* Animal Detail Modal - TABBED & INTERACTIVE VERSION */}
      {showModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row">
            
            {/* Left Column: Image Section */}
            <div className="relative w-full md:w-[40%] h-48 sm:h-60 md:h-auto bg-slate-900 overflow-hidden border-b md:border-b-0 md:border-r border-black/5 flex-shrink-0 flex flex-col justify-end">
                {selectedHerd.imageUrl ? (
                  <img src={formatImageUrl(selectedHerd.imageUrl)} alt={selectedHerd.animalName} className="absolute inset-0 w-full h-full object-cover opacity-85" />
                ) : (
                  <div className={`absolute inset-0 w-full h-full flex items-center justify-center ${getAnimalColor(selectedHerd)}`}>
                    <Activity size={80} className="text-white/20 animate-pulse" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                
                <div className="relative p-6 sm:p-8 text-white z-10 text-left">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="px-2.5 py-0.5 bg-brand text-white text-[9px] font-black rounded-full uppercase tracking-[0.15em] shadow-md">
                      {selectedHerd.animalType}
                    </span>
                    <span className="px-2.5 py-0.5 bg-white/25 text-white text-[9px] font-black rounded-full uppercase tracking-[0.15em] backdrop-blur-sm">
                      {selectedHerd.animalStatus}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight drop-shadow-md truncate">{selectedHerd.animalName || 'Unnamed'}</h2>
                  <div className="text-mono text-xs text-white/60 mt-1 font-semibold tracking-wider">{selectedHerd.tagNumber}</div>
                </div>
            </div>

            {/* Right Column: Detailed Tabbed Panels */}
            <div className="flex-1 bg-white relative flex flex-col justify-between overflow-hidden h-[60vh] md:h-auto">
              {/* Close Button */}
              <button 
                onClick={() => setShowModal(false)} 
                className="absolute top-4 right-4 text-text3 hover:text-brand p-2 rounded-xl transition-all z-[30] bg-surface/50 backdrop-blur-sm"
              >
                <X size={18} />
              </button>

              {/* Tabs Navigation Bar */}
              <div className="flex border-b border-border-custom bg-surface/50 p-2 gap-1 z-20 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'info' ? 'bg-white text-brand shadow-sm border border-border-custom' : 'text-text3 hover:text-text'
                  }`}
                >
                  <Info size={14} />
                  Info
                </button>
                <button
                  onClick={() => setActiveTab('repro')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'repro' ? 'bg-white text-brand shadow-sm border border-border-custom' : 'text-text3 hover:text-text'
                  }`}
                >
                  <Calendar size={14} />
                  Reproduction
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'timeline' ? 'bg-white text-brand shadow-sm border border-border-custom' : 'text-text3 hover:text-text'
                  }`}
                >
                  <Activity size={14} />
                  Timeline ({events.length})
                </button>
              </div>

              {/* Scrollable Tab Contents */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                
                {/* TAB 1: General Info */}
                {activeTab === 'info' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 bg-surface/40 p-6 rounded-3xl border border-border-custom shadow-inner">
                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Animal Name</label>
                        <div className="text-[14px] sm:text-[15px] font-extrabold text-text">{selectedHerd.animalName || 'N/A'}</div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Breed Lineage</label>
                        <div className="text-[14px] sm:text-[15px] font-bold text-text flex items-center gap-2">
                           {selectedHerd.breed || 'N/A'}
                          {selectedHerd.milkType && <span className="px-1.5 py-0.5 bg-brand-light text-brand-dark text-[8px] font-black rounded-md">{selectedHerd.milkType}</span>}
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Birth Date</label>
                        <div className="text-[14px] sm:text-[15px] font-semibold text-text2">{selectedHerd.birthDate || 'N/A'}</div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Age</label>
                        <div className="text-[14px] sm:text-[15px] font-extrabold text-brand-dark">{selectedHerd.age || 'N/A'}</div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Procured Date</label>
                        <div className="text-[14px] sm:text-[15px] font-semibold text-text2">{selectedHerd.procuredDate || '—'}</div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Sourced</label>
                        <div className="text-[14px] sm:text-[15px] font-semibold text-text2">{selectedHerd.source || '—'}</div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Health Status</label>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${selectedHerd.healthStatus === 'HEALTHY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                          <span className={`text-[11px] sm:text-[12px] font-black uppercase ${selectedHerd.healthStatus === 'HEALTHY' ? 'text-green-700' : 'text-danger'}`}>
                            {selectedHerd.healthStatus}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Record Status</label>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                          selectedHerd.status === 'DISPOSED' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-green-100 text-brand border border-green-200'
                        }`}>
                          {selectedHerd.status || 'ACTIVE'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Reproduction & Reminders */}
                {activeTab === 'repro' && (() => {
                  const stats = getReproductionStats();
                  const reminders = events.filter(e => ['VACCINATION_DUE', 'DEWORMING_DUE', 'PREGNANCY_CHECK_DUE'].includes(e.eventType));
                  
                  return (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* Reproduction stats */}
                      <div className="bg-surface/40 border border-border-custom p-6 rounded-3xl space-y-4">
                        <h3 className="text-xs font-black uppercase text-brand tracking-widest flex items-center gap-2">
                          <Activity size={14} />
                          Reproduction Card
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-border-custom shadow-sm">
                            <label className="text-[8px] font-black text-text3 uppercase tracking-wider block mb-1">Pregnancy Status</label>
                            <span className={`text-sm font-black uppercase ${stats.isPregnant ? 'text-purple-600' : 'text-text3'}`}>
                              {stats.isPregnant ? 'Pregnant' : 'Not Pregnant'}
                            </span>
                          </div>
                          
                          <div className="bg-white p-4 rounded-2xl border border-border-custom shadow-sm">
                            <label className="text-[8px] font-black text-text3 uppercase tracking-wider block mb-1">AI Attempts</label>
                            <span className="text-sm font-black text-text">{stats.aiAttempts}</span>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-border-custom shadow-sm">
                            <label className="text-[8px] font-black text-text3 uppercase tracking-wider block mb-1">Last AI Date</label>
                            <span className="text-sm font-semibold text-text2">{stats.lastAi || 'N/A'}</span>
                          </div>

                          {stats.isPregnant && (
                            <>
                              <div className="bg-white p-4 rounded-2xl border border-border-custom shadow-sm">
                                <label className="text-[8px] font-black text-text3 uppercase tracking-wider block mb-1">Days Pregnant</label>
                                <span className="text-sm font-black text-purple-700">{stats.daysPregnant} Days</span>
                              </div>
                              <div className="bg-white p-4 rounded-2xl border border-border-custom shadow-sm col-span-2">
                                <label className="text-[8px] font-black text-text3 uppercase tracking-wider block mb-1">Expected Delivery Date (Calving)</label>
                                <span className="text-sm font-black text-brand-dark flex items-center gap-1.5">
                                  <Calendar size={14} className="text-brand" />
                                  {stats.expectedDelivery}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Reminders list */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase text-brand tracking-widest flex items-center gap-2">
                          <Clock size={14} />
                          Upcoming Reminders
                        </h3>

                        <div className="space-y-2">
                          {reminders.length === 0 ? (
                            <div className="p-5 text-center text-xs text-text3 italic bg-surface/30 rounded-2xl border border-dashed border-border-custom">
                              No active reminders scheduled for this animal.
                            </div>
                          ) : (
                            reminders.map(rem => (
                              <div key={rem.id} className="bg-[#FFF8E1] border border-[#FFE082] rounded-2xl p-4 flex items-start gap-3 relative group">
                                <div className="p-2 bg-[#FFECB3] rounded-xl text-[#FFB300] flex-shrink-0">
                                  <Clock size={16} />
                                </div>
                                <div className="text-left flex-1 min-w-0 pr-8">
                                  <div className="font-extrabold text-[13px] text-[#8D6E63]">{rem.title}</div>
                                  <div className="text-[11px] text-[#A1887F] font-semibold mt-0.5">{rem.eventDate}</div>
                                  {rem.details && <div className="text-[11px] text-[#A1887F] mt-1 bg-white/40 p-2 rounded-lg truncate">{rem.details}</div>}
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
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 3: Historical Timeline */}
                {activeTab === 'timeline' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-brand tracking-widest flex items-center gap-2">
                        <Activity size={14} />
                        Events Timeline
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
                          <Plus size={12} />
                          Add Event
                        </button>
                      )}
                    </div>

                    <div className="relative pl-6 border-l-2 border-border-custom space-y-6 text-left mt-2">
                      {loadingEvents ? (
                        <div className="py-8 text-center text-xs text-text3 italic">Loading timeline...</div>
                      ) : events.length === 0 ? (
                        <div className="py-8 text-center text-xs text-text3 italic">No timeline events logged yet.</div>
                      ) : (
                        events.map((evt, idx) => {
                          let iconBg = 'bg-surface text-brand';
                          if (evt.eventType === 'SEMEN_GIVEN') iconBg = 'bg-purple-100 text-purple-600';
                          else if (evt.eventType === 'PREGNANCY_CONFIRMED') iconBg = 'bg-blue-100 text-blue-600';
                          else if (evt.eventType === 'CALF_DELIVERED') iconBg = 'bg-green-100 text-green-600';
                          else if (evt.eventType === 'DRY_PERIOD_STARTED') iconBg = 'bg-amber-100 text-amber-600';
                          else if (evt.eventType === 'LACTATION_STARTED') iconBg = 'bg-orange-100 text-orange-600';

                          return (
                            <div key={evt.id} className="relative group">
                              {/* Timeline indicator node */}
                              <div className={`absolute -left-[37px] top-0.5 w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] ${iconBg}`}>
                                <Calendar size={12} />
                              </div>

                              <div className="bg-surface/50 border border-border-custom rounded-2xl p-4 relative pr-10">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-extrabold text-[13px] text-text">{evt.title}</span>
                                  <span className="text-[10px] font-bold text-text3 font-mono">{evt.eventDate}</span>
                                </div>
                                {evt.details && (
                                  <p className="text-[11px] text-text2 mt-1 bg-white/70 p-2.5 rounded-xl border border-black/5 leading-relaxed">
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
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Buttons Panel */}
              <div className="p-6 border-t border-border-custom bg-surface/30 flex-shrink-0">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-brand-dark text-white py-3.5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-md text-[10px] sm:text-[11px] active:scale-[0.98]"
                >
                  Close Animal Record
                </button>

                {userRole === 'ADMIN' && (
                  <div className="grid grid-cols-2 gap-3 mt-3 animate-in slide-in-from-bottom-2 duration-300">
                    <button 
                      onClick={() => {
                        setShowModal(false);
                        setShowEditModal(true);
                      }}
                      className="bg-brand/10 text-brand border border-brand/20 py-3 rounded-2xl font-black uppercase tracking-[0.15em] hover:bg-brand/20 transition-all text-[10px] sm:text-[11px] active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Edit2 size={13} />
                      Edit Animal
                    </button>
                    <button 
                      onClick={() => handleDeleteHerd(selectedHerd.id)}
                      className="bg-danger/10 text-danger border border-danger/20 py-3 rounded-2xl font-black uppercase tracking-[0.15em] hover:bg-danger/20 transition-all text-[10px] sm:text-[11px] active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      Delete Record
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showRegisterModal && (
        <RegisterAnimalModal 
          onClose={() => setShowRegisterModal(false)} 
          onSuccess={fetchHerds} 
        />
      )}
      {showEditModal && selectedHerd && (
        <RegisterAnimalModal 
          onClose={() => {
            setShowEditModal(false);
            setSelectedHerd(null);
          }}
          onSuccess={fetchHerds}
          herdToEdit={selectedHerd}
        />
      )}
      {/* Add Event Modal */}
      {showAddEventModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border-custom" style={{ background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)' }}>
              <div>
                <h2 className="text-[15px] font-black text-white tracking-tight uppercase">Record New Event</h2>
                <p className="text-[10px] text-white/80 font-bold uppercase mt-0.5">Logging for {selectedHerd.animalName || selectedHerd.tagNumber}</p>
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
                  onChange={(e) => setEventType(e.target.value)}
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
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-semibold text-xs text-text focus:outline-none focus:border-brand transition-all font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Event Title</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-bold text-xs text-text focus:outline-none focus:border-brand transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-wider block mb-1.5">Details & Remarks</label>
                <textarea
                  value={eventDetailsText}
                  onChange={(e) => setEventDetailsText(e.target.value)}
                  placeholder="e.g. Bull Tag: GIR-505, Technician Name, Calf gender, dosage details, etc."
                  className="w-full px-4 py-3 bg-surface border border-border-custom rounded-xl font-semibold text-xs text-text focus:outline-none focus:border-brand transition-all h-24 resize-none leading-relaxed"
                  maxLength={1000}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  isOpen: boolean;
  onClose: () => void;
  herds: any[];
  onAnimalClick: (id: number) => void;
}) {
  if (!isOpen) return null;
  const disposed = herds.filter(h => h.status === 'DISPOSED');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 flex items-center justify-between border-b border-border-custom" style={{ background: 'linear-gradient(135deg,#5c677d 0%,#334155 100%)' }}>
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
              {disposed.map((item) => {
                const initials = item.animalName ? item.animalName.substring(0, 2).toUpperCase() : '??';
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onAnimalClick(item.id);
                      onClose();
                    }}
                    className="bg-surface hover:bg-[#F1F5F9] border border-border-custom rounded-xl p-4 cursor-pointer transition-all hover:shadow text-center flex flex-col items-center gap-2 group relative"
                  >
                    {item.imageUrl ? (
                      <img src={formatImageUrl(item.imageUrl)} alt={item.animalName} className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center text-white font-black text-sm uppercase">
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-text text-[13px] truncate max-w-[120px]">{item.animalName || 'Unnamed'}</p>
                      <p className="text-[10px] text-text3 font-mono mt-0.5">{item.tagNumber}</p>
                    </div>
                    <span className="text-[8px] font-black uppercase bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                      {item.animalType}
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
