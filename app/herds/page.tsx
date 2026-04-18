'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, X, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface Herd {
  id: number;
  tagNumber: string;
  animalType: string;
  animalName: string;
  breed: string;
  breedType: string;
  healthStatus: string;
  source: string;
  birthDate: string;
  status: string;
  imageUrl?: string;
}

export default function HerdsPage() {
  const [herds, setHerds] = useState<Herd[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedHerd, setSelectedHerd] = useState<Herd | null>(null);
  const [showModal, setShowModal] = useState(false);
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

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    return `${age} yrs`;
  };

  const getAnimalColor = (herd: Herd) => {
    if (herd.animalType === 'COW') {
      if (herd.breedType === 'A2') return 'bg-[#FFB703]';
      if (herd.breedType === 'A1') return 'bg-[#7B2CBF]';
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
        {/* Header Section (Unified for Mobile, Left/Right for Desktop) */}
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

        {/* Animals Grid Section */}
        <div className="flex-1 p-3 flex flex-wrap gap-1.5 items-center justify-start">
          {items.map((item: Herd) => (
            <div 
              key={item.id}
              onClick={() => handleHerdClick(item.id)}
              className={`w-[45px] md:w-[48px] h-[35px] md:h-[36px] rounded-sm shadow-sm border border-black/10 cursor-pointer transition-transform hover:scale-110 relative group ${getAnimalColor(item)}`}
            >
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max px-2 py-1 bg-black text-white text-[10px] font-bold rounded-md z-[100] pointer-events-none whitespace-nowrap shadow-2xl">
                {item.animalName || item.breed}
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
        <button className="bg-brand text-white flex items-center gap-2 py-2 px-3 md:px-5 rounded-xl font-black text-[11px] md:text-[13px] hover:bg-brand-dark transition-all shadow-md active:scale-95">
          <Plus size={16} />
          <span>Register Animal</span>
        </button>
      </div>

      <div className="space-y-8">
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
                  count={herds.filter(h => h.animalType === 'COW' && h.status === 'LACTATING').length} 
                  items={herds.filter(h => h.animalType === 'COW' && h.status === 'LACTATING')} 
                />
                <CategoryRow 
                  title="Calf" 
                  isSub={true}
                  count={herds.filter(h => h.animalType === 'CALF').length} 
                  items={herds.filter(h => h.animalType === 'CALF')} 
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

      {/* Animal Detail Modal */}
      {showModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="relative h-56 w-full group overflow-hidden">
               {selectedHerd.imageUrl ? (
                 <img src={selectedHerd.imageUrl} alt={selectedHerd.animalName} className="w-full h-full object-cover zoom-in" />
               ) : (
                 <div className={`w-full h-full flex items-center justify-center ${getAnimalColor(selectedHerd)}`}>
                    <Info size={48} className="text-white/20" />
                 </div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
               <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 bg-white/10 hover:bg-white/30 p-2.5 rounded-full transition-all">
                 <X size={20} className="text-white" />
               </button>
               <div className="absolute bottom-6 left-8 text-white">
                  <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-accent mb-1">Asset Record</div>
                  <h2 className="text-4xl font-black">{selectedHerd.animalName || 'Unnamed'}</h2>
                  <p className="text-sm opacity-90 mt-1 uppercase font-bold tracking-widest">{selectedHerd.tagNumber} · {selectedHerd.animalType}</p>
               </div>
            </div>
            
            <div className="p-8 grid grid-cols-2 gap-x-10 gap-y-6 bg-white">
              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] block mb-1.5">Breed Lineage</label>
                <div className="text-[16px] font-bold text-text flex items-center gap-2">
                  {selectedHerd.breed} 
                  {selectedHerd.breedType && <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-black rounded-full uppercase">{selectedHerd.breedType}</span>}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] block mb-1.5">Age Estimate</label>
                <div className="text-[16px] font-bold text-text">{calculateAge(selectedHerd.birthDate)}</div>
              </div>
              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] block mb-1.5">Original Source</label>
                <div className="text-[14px] text-text2 font-medium italic">{selectedHerd.source || 'Farm Born'}</div>
              </div>
              <div>
                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] block mb-1.5">Health Status</label>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                  <span className="text-[13px] font-black uppercase text-green-700">{selectedHerd.healthStatus}</span>
                </div>
              </div>
              <div className="col-span-2 pt-6 mt-2 border-t border-border-custom">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-brand-dark text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl text-xs active:scale-95"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
