'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, X, ChevronDown, ChevronRight, Info, Table as TableIcon, LayoutGrid, Calendar, Activity, Camera } from 'lucide-react';
import RegisterAnimalModal from '@/components/RegisterAnimalModal';

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
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ 'COW': true });

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
      setShowModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const CategoryRow = ({ title, count, items, isSub = false, canExpand = false, type = '' }: any) => {
    const isExpanded = expandedRows[type];
    
    return (
      <div className={`flex flex-col md:flex-row border-b border-border-custom transition-colors ${isSub ? 'bg-surface2/10' : 'hover:bg-surface'}`}>
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

        <div className="flex-1 p-3 flex flex-wrap gap-1.5 items-center justify-start bg-white/50">
          {items.map((item: Herd) => (
            <div 
              key={item.id}
              onClick={() => handleHerdClick(item.id)}
              className={`w-[45px] md:w-[48px] h-[35px] md:h-[36px] rounded-sm shadow-sm border border-black/10 cursor-pointer transition-transform hover:scale-110 relative group ${getAnimalColor(item)}`}
            >
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max px-2 py-1 bg-black text-white text-[10px] font-bold rounded-md z-[100] pointer-events-none whitespace-nowrap shadow-2xl">
                {item.animalName || item.tagNumber}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-black" />
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-[11px] text-text3 italic py-1 pl-2">No records found</div>}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="px-1">
          <h1 className="text-xl md:text-2xl font-black text-text tracking-tight uppercase">Herd Management</h1>
          <p className="text-[12px] text-text3 mt-0.5 underline font-medium">Sthirvaa Farms Dashboard</p>
        </div>
        
        <button 
          onClick={() => setShowRegisterModal(true)}
          className="bg-brand text-white flex items-center gap-2 py-2 px-3 md:px-5 rounded-xl font-black text-[11px] md:text-[13px] hover:bg-brand-dark transition-all shadow-md active:scale-95"
        >
          <Plus size={16} />
          <span className="hidden md:inline">Register Animal</span>
        </button>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Milk Production Section */}
        <div>
          <div className="bg-[#FFCCBC] py-2.5 px-5 font-black text-[#BF360C] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Milk Production Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <CategoryRow 
              title="Cows" 
              type="COW"
              canExpand={true}
              count={counts['COW'] || 0} 
              items={herds.filter(h => h.animalType === 'COW')} 
            />
            
            {expandedRows['COW'] && (
              <>
                <CategoryRow 
                  title="Lactation Cows" 
                  isSub={true}
                  count={herds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING').length} 
                  items={herds.filter(h => h.animalType === 'COW' && h.animalStatus === 'LACTATING')} 
                />
                <CategoryRow 
                  title="Calf" 
                  isSub={true}
                  count={herds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF').length} 
                  items={herds.filter(h => h.animalType === 'COW' && h.animalStatus === 'CALF')} 
                />
              </>
            )}
            
            <CategoryRow title="Buffalo" count={counts['BUFFALO']} items={herds.filter(h => h.animalType === 'BUFFALO')} />
            <CategoryRow title="Goat" count={counts['GOAT']} items={herds.filter(h => h.animalType === 'GOAT')} />
          </div>
        </div>

        {/* Meat Section */}
        <div>
          <div className="bg-[#E1F5FE] py-2.5 px-5 font-black text-[#0277BD] text-[12px] uppercase tracking-[1.5px] rounded-t-xl border-b border-white/20 shadow-sm">
            Meat / Poultry Section
          </div>
          <div className="bg-white border border-border-custom rounded-b-xl shadow-xl">
            <CategoryRow title="Chicken" count={counts['CHICKEN']} items={herds.filter(h => h.animalType === 'CHICKEN')} />
            <CategoryRow title="Fishes" count={counts['FISH']} items={herds.filter(h => h.animalType === 'FISH')} />
            <CategoryRow title="Duck" count={counts['DUCK']} items={herds.filter(h => h.animalType === 'DUCK')} />
          </div>
        </div>
      </div>

      {/* Animal Detail Modal - SIDE-BY-SIDE VERSION */}
      {showModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row">
            
            {/* Left Column: Image Section (Same height as right) */}
            <div className="relative w-full md:w-[45%] h-64 md:h-auto bg-surface2 overflow-hidden border-r border-black/5">
                {selectedHerd.imageUrl ? (
                  <img src={selectedHerd.imageUrl} alt={selectedHerd.animalName} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${getAnimalColor(selectedHerd)}`}>
                    <Activity size={60} className="text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-6 left-6 text-white text-left">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-2 py-0.5 bg-brand text-white text-[8px] font-black rounded-full uppercase tracking-[0.15em] shadow-lg">
                      {selectedHerd.animalType}
                    </span>
                    <span className="px-2 py-0.5 bg-accent text-white text-[8px] font-black rounded-full uppercase tracking-[0.15em]">
                      {selectedHerd.animalStatus}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black tracking-tighter leading-tight drop-shadow-lg">{selectedHerd.animalName || 'Unnamed'}</h2>
                </div>
            </div>

            {/* Right Column: Detailed Info Panel */}
            <div className="flex-1 p-6 sm:p-8 md:p-10 bg-white relative flex flex-col justify-between">
              <button 
                onClick={() => setShowModal(false)} 
                className="absolute top-4 right-4 text-text3 hover:text-brand p-2 rounded-xl transition-all z-[10]"
              >
                <X size={20} />
              </button>

              <div className="space-y-5 sm:space-y-6">
                {/* Status Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface rounded-2xl border border-border-custom shadow-sm gap-3 sm:gap-0 mt-4 sm:mt-0">
                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Tag Number</label>
                    <div className="text-lg sm:text-xl font-black text-brand tracking-tight font-mono">{selectedHerd.tagNumber}</div>
                  </div>
                  <div className="text-left sm:text-right">
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Health Status</label>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <div className={`w-2.5 h-2.5 rounded-full ${selectedHerd.healthStatus === 'HEALTHY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                      <span className={`text-[11px] sm:text-[12px] font-black uppercase ${selectedHerd.healthStatus === 'HEALTHY' ? 'text-green-700' : 'text-danger'}`}>
                        {selectedHerd.healthStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6 bg-surface/30 p-5 rounded-2xl border border-border-custom shadow-inner">
                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Animal Name</label>
                    <div className="text-[14px] sm:text-[15px] font-bold text-text">{selectedHerd.animalName || 'N/A'}</div>
                  </div>

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Breed Lineage</label>
                    <div className="text-[15px] font-bold text-text flex items-center gap-2">
                       {selectedHerd.breed || 'N/A'}
                      {selectedHerd.milkType && <span className="px-1.5 py-0.5 bg-brand-light text-brand-dark text-[8px] font-black rounded-md">{selectedHerd.milkType}</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Birth Date</label>
                    <div className="text-[14px] sm:text-[15px] font-bold text-text2">{selectedHerd.birthDate || 'N/A'}</div>
                  </div>

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Age</label>
                    <div className="text-[14px] sm:text-[15px] font-extrabold text-brand-dark">{selectedHerd.age || 'N/A'}</div>
                  </div>

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Procured Date</label>
                    <div className="text-[14px] sm:text-[15px] font-bold text-text2">{selectedHerd.procuredDate || '—'}</div>
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Sourced</label>
                    <div className="text-[14px] sm:text-[15px] font-bold text-text2">{selectedHerd.source || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-brand-dark text-white py-3 sm:py-4 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl text-[10px] sm:text-[11px] active:scale-[0.98]"
                >
                  Close Animal Record
                </button>
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
    </AppLayout>
  );
}
