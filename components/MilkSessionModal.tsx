'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Droplets, Truck, Info, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface Customer {
  id: number;
  name: string;
  defaultRate?: number;
}

interface DispatchRow {
  dispatchType: 'CUSTOMER' | 'SOCIETY' | 'INTERNAL' | 'WASTE';
  customerId?: number;
  quantity: number;
  ratePerLitre: number;
}

export default function MilkSessionModal({ 
  onClose, 
  onSuccess,
  editSlot = null 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
  editSlot?: { date: string; shift: 'MORNING' | 'EVENING' } | null;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState<'MORNING' | 'EVENING'>(editSlot?.shift || 'MORNING');
  const [date, setDate] = useState(editSlot?.date || new Date().toISOString().split('T')[0]);
  
  const [cows, setCows] = useState<any[]>([]);
  const [cowYields, setCowYields] = useState<Record<number, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRow[]>([
    { dispatchType: 'CUSTOMER', quantity: 0, ratePerLitre: 0 }
  ]);

  useEffect(() => {
    fetchInitialData();
    if (editSlot) fetchExistingSession();
  }, [editSlot]);

  const fetchInitialData = async () => {
    try {
      const [herdRes, custRes] = await Promise.all([
        api.get('/herds'),
        api.get('/customers') // Fixed path: api.ts already has /api
      ]);
      const lactating = (herdRes.data.herds || []).filter((h: any) => h.animalStatus === 'LACTATING');
      setCows(lactating);
      setCustomers(custRes.data || []);
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  const fetchExistingSession = async () => {
    if (!editSlot) return;
    try {
      // 1. Fetch Production
      const prodRes = await api.get(`/milk-records?date=${editSlot.date}&shift=${editSlot.shift}`);
      const yields: Record<number, string> = {};
      prodRes.data.forEach((r: any) => { yields[r.herdId] = r.quantity.toString(); });
      setCowYields(yields);

      // 2. Fetch Dispatch/Distribution
      const dispRes = await api.get(`/milk-dispatch/by-date?date=${editSlot.date}`);
      const filtered = dispRes.data.filter((d: any) => d.shift === editSlot.shift);
      if (filtered.length > 0) {
        setDispatches(filtered.map((d: any) => ({
          dispatchType: d.dispatchType,
          customerId: d.customerId,
          quantity: d.quantity,
          ratePerLitre: d.ratePerLitre
        })));
      }
    } catch (err) {
      console.error("Failed to fetch existing session:", err);
    }
  };

  const totalProduced = Object.values(cowYields).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalDistributed = dispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);
  const balance = totalProduced - totalDistributed;

  const handleAddDispatch = () => {
    setDispatches([...dispatches, { dispatchType: 'CUSTOMER', quantity: 0, ratePerLitre: 0 }]);
  };

  const updateDispatch = (index: number, updates: Partial<DispatchRow>) => {
    const next = [...dispatches];
    next[index] = { ...next[index], ...updates };
    if (updates.customerId) {
       const cust = customers.find(c => c.id === updates.customerId);
       if (cust) next[index].ratePerLitre = cust.defaultRate || 0;
    }
    setDispatches(next);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      // 1. Save Cow Production
      const records = Object.entries(cowYields)
        .filter(([_, qty]) => parseFloat(qty) > 0)
        .map(([id, qty]) => ({
          herdId: parseInt(id),
          date,
          shift,
          quantity: parseFloat(qty)
        }));
      if (records.length > 0) await api.post('/milk-records/batch', records);

      // 2. Save Distribution
      const dispatchEntries = dispatches
        .filter(d => d.quantity > 0)
        .map(d => ({ ...d, date, shift }));
      if (dispatchEntries.length > 0) await api.post('/milk-dispatch/session', dispatchEntries);

      onSuccess();
      onClose();
    } catch (err) {
      alert("Error saving session. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-brand p-8 text-white relative">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${step === 1 ? 'bg-white text-brand' : 'bg-white/20 text-white'}`}>Phase 1: Production</span>
                <span className="text-white/30">→</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${step === 2 ? 'bg-white text-brand' : 'bg-white/20 text-white'}`}>Phase 2: Distribution</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">{editSlot ? 'Edit Session' : 'New Milk Session'}</h2>
              <div className="flex items-center gap-4 mt-2">
                 <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-white/10 border-none rounded-lg px-3 py-1 text-[12px] font-bold text-white outline-none" />
                 <select value={shift} onChange={e => setShift(e.target.value as any)} className="bg-white/10 border-none rounded-lg px-3 py-1 text-[12px] font-bold text-white outline-none">
                   <option value="MORNING" className="text-text">MORNING SHIFT</option>
                   <option value="EVENING" className="text-text">EVENING SHIFT</option>
                 </select>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><X size={20}/></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-text3 flex items-center gap-2">Individual Cow Yields</h3>
                <div className="text-[14px] font-black text-brand bg-brand/5 px-4 py-2 rounded-xl">Session Total: {totalProduced.toFixed(1)} L</div>
              </div>
              <div className="grid gap-3">
                {cows.map(cow => (
                  <div key={cow.id} className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-border-custom">
                    <div>
                      <span className="text-[13px] font-black text-text">{cow.tagNumber}</span>
                      <p className="text-[11px] text-text3 font-medium">{cow.animalName || cow.breed}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <input 
                        type="number" step="0.1" placeholder="0.0" 
                        value={cowYields[cow.id] || ''}
                        onChange={e => setCowYields({...cowYields, [cow.id]: e.target.value})}
                        className="w-24 bg-white border border-border-custom rounded-xl px-4 py-2 text-right font-black text-brand outline-none focus:ring-2 focus:ring-brand"
                       />
                       <span className="text-[11px] font-black text-text3">L</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-left-4">
               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-5 bg-surface rounded-3xl border border-border-custom text-center">
                    <p className="text-[10px] font-black text-text3 uppercase tracking-widest mb-1">Total Produced</p>
                    <div className="text-3xl font-black text-text">{totalProduced.toFixed(1)} L</div>
                  </div>
                  <div className={`p-5 rounded-3xl border text-center transition-all ${Math.abs(balance) < 0.1 ? 'bg-brand/5 border-brand/20' : 'bg-amber-50 border-amber-200'}`}>
                    <p className="text-[10px] font-black text-text3 uppercase tracking-widest mb-1">Unallocated</p>
                    <div className={`text-3xl font-black ${Math.abs(balance) < 0.1 ? 'text-brand' : 'text-amber-600'}`}>{balance.toFixed(1)} L</div>
                  </div>
               </div>
               <div className="space-y-4">
                  {dispatches.map((dispatch, index) => (
                    <div key={index} className="p-5 bg-white border border-border-custom rounded-3xl relative group">
                      <button onClick={() => setDispatches(dispatches.filter((_, i) => i !== index))} className="absolute top-2 right-2 p-1.5 text-text3 hover:text-danger opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                         <select value={dispatch.dispatchType} onChange={e => updateDispatch(index, { dispatchType: e.target.value as any })} className="w-full bg-surface border-none rounded-xl px-4 py-2 text-[12px] font-bold outline-none">
                            <option value="CUSTOMER">PRIVATE CUSTOMER</option>
                            <option value="SOCIETY">MILK SOCIETY</option>
                            <option value="INTERNAL">INTERNAL / OWN USE</option>
                            <option value="WASTE">WASTE / LOSS</option>
                         </select>
                         {dispatch.dispatchType === 'CUSTOMER' && (
                           <select value={dispatch.customerId || ''} onChange={e => updateDispatch(index, { customerId: parseInt(e.target.value) })} className="w-full bg-surface border-none rounded-xl px-4 py-2 text-[12px] font-bold outline-none">
                              <option value="">Choose Customer...</option>
                              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                         )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <input type="number" placeholder="Qty (L)" value={dispatch.quantity || ''} onChange={e => updateDispatch(index, { quantity: parseFloat(e.target.value) })} className="w-full bg-surface border-none rounded-xl px-4 py-2 text-[14px] font-black text-text outline-none" />
                         <input type="number" placeholder="Rate (₹/L)" value={dispatch.ratePerLitre || ''} onChange={e => updateDispatch(index, { ratePerLitre: parseFloat(e.target.value) })} className="w-full bg-surface border-none rounded-xl px-4 py-2 text-[14px] font-black text-brand outline-none" />
                      </div>
                    </div>
                  ))}
                  <button onClick={handleAddDispatch} className="w-full py-4 border-2 border-dashed border-border-custom rounded-3xl text-text3 hover:text-brand hover:border-brand/40 flex items-center justify-center gap-2 transition-all">
                    <Plus size={18}/> <span className="text-[11px] font-black uppercase tracking-widest">Add Distribution Row</span>
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-surface border-t border-border-custom flex items-center justify-between">
            {step === 1 ? (
              <button disabled={totalProduced === 0} onClick={() => setStep(2)} className="ml-auto bg-brand text-white py-4 px-10 rounded-2xl font-black uppercase tracking-widest text-[12px] shadow-xl hover:bg-brand-dark disabled:opacity-50">Next: Distribute Milk</button>
            ) : (
              <>
                <button onClick={() => setStep(1)} className="py-4 px-8 border border-border-custom rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-white">Back</button>
                <button disabled={loading || totalDistributed === 0} onClick={handleFinalSubmit} className="bg-brand text-white py-4 px-12 rounded-2xl font-black uppercase tracking-widest text-[12px] shadow-xl hover:bg-brand-dark flex items-center gap-3 disabled:opacity-50">
                  {loading ? 'Processing...' : 'Complete Session'}
                </button>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
