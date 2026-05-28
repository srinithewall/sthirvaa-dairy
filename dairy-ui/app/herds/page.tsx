'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import { Plus, X, ChevronDown, ChevronRight, Info, Table as TableIcon, LayoutGrid, Calendar, Activity, Trash2, Edit2, Archive } from 'lucide-react';
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
      setShowModal(true);
    } catch (err) {
      console.error(err);
    }
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

      {/* Animal Detail Modal - SIDE-BY-SIDE VERSION */}
      {showModal && selectedHerd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row">
            
            {/* Left Column: Image Section */}
            <div className="relative w-full md:w-[45%] h-48 sm:h-64 md:h-auto bg-surface2 overflow-hidden border-b md:border-b-0 md:border-r border-black/5 flex-shrink-0">
                {selectedHerd.imageUrl ? (
                  <img src={formatImageUrl(selectedHerd.imageUrl)} alt={selectedHerd.animalName} className="w-full h-full object-cover" />
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
            <div className="flex-1 p-6 sm:p-8 md:p-10 bg-white relative flex flex-col justify-between overflow-y-auto">
              <button 
                onClick={() => setShowModal(false)} 
                className="absolute top-4 right-4 text-text3 hover:text-brand p-2 rounded-xl transition-all z-[10]"
              >
                <X size={20} />
              </button>

              <div className="space-y-5 sm:space-y-6">
                {/* Status Bar */}
                <div className="flex flex-row items-center justify-between p-4 bg-surface rounded-2xl border border-border-custom shadow-sm gap-3 mt-4 sm:mt-0">
                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Tag Number</label>
                    <div className="text-lg sm:text-xl font-black text-brand tracking-tight font-mono">{selectedHerd.tagNumber}</div>
                  </div>
                  <div className="text-right">
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Status</label>
                    <div className="flex items-center gap-2 justify-end">
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

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Sourced</label>
                    <div className="text-[14px] sm:text-[15px] font-bold text-text2">{selectedHerd.source || '—'}</div>
                  </div>

                  <div>
                    <label className="text-[8px] sm:text-[9px] font-black text-text3 uppercase tracking-[0.2em] block mb-1">Record Status</label>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      selectedHerd.status === 'DISPOSED' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-green-100 text-brand border border-green-200'
                    }`}>
                      {selectedHerd.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 space-y-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-brand-dark text-white py-3 sm:py-3.5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl text-[10px] sm:text-[11px] active:scale-[0.98]"
                >
                  Close Animal Record
                </button>

                {userRole === 'ADMIN' && (
                  <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-bottom-2 duration-300">
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
