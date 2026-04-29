'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Save, X, Loader2, RefreshCw, Layers } from 'lucide-react';

interface SubscriptionPlanItem {
  id?: number;
  description: string;
  qty: number;
  unit: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME';
}

interface SubscriptionPlan {
  id?: number;
  name: string;
  tagline: string;
  monthlyPrice: number;
  badgeText?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  items: SubscriptionPlanItem[];
}

const blankItem = (): SubscriptionPlanItem => ({
  description: '', qty: 1, unit: 'Litre', frequency: 'DAILY'
});

const blankPlan = (): SubscriptionPlan => ({
  name: '', tagline: '', monthlyPrice: 0, badgeText: '', imageUrl: '', 
  displayOrder: 0, isActive: true, items: [blankItem()]
});

export default function SubscriptionManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan>(blankPlan());
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscription-plans');
      setPlans(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPlan.id) {
        await api.put(`/subscription-plans/${editingPlan.id}`, editingPlan);
      } else {
        await api.post('/subscription-plans', editingPlan);
      }
      fetchPlans();
      setShowModal(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this combo?')) return;
    try {
      await api.delete(`/subscription-plans/${id}`);
      fetchPlans();
    } catch (e) { console.error(e); }
  };

  const addItem = () => {
    setEditingPlan(prev => ({ ...prev, items: [...prev.items, blankItem()] }));
  };

  const removeItem = (idx: number) => {
    setEditingPlan(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: keyof SubscriptionPlanItem, val: any) => {
    setEditingPlan(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    }));
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">Subscription Combos</h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">Manage family combos and subscription plans</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPlans} className="p-3 border border-border-custom rounded-xl hover:bg-surface transition-all"><RefreshCw size={18} /></button>
          <button onClick={() => { setEditingPlan(blankPlan()); setShowModal(true); }}
            className="bg-brand text-white flex items-center gap-2 py-3 px-5 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg">
            <Plus size={18} /> New Combo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-brand" />
          <p className="text-text3 text-[12px]">Loading plans...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-3xl border border-border-custom shadow-xl overflow-hidden flex flex-col">
              <div className="h-40 bg-surface relative">
                <img src={plan.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'} alt={plan.name} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-white font-black text-lg">{plan.name}</h3>
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">₹{plan.monthlyPrice} / Month</p>
                </div>
              </div>
              <div className="p-5 flex-1 space-y-4">
                 <div className="space-y-2">
                    {plan.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-[11px] font-medium text-text3">
                        <span>{item.description}</span>
                        <span>{item.qty} {item.unit} ({item.frequency})</span>
                      </div>
                    ))}
                 </div>
                 <div className="flex gap-2 pt-4 border-t border-border-custom">
                    <button onClick={() => { setEditingPlan(plan); setShowModal(true); }} className="flex-1 py-2 bg-surface hover:bg-surface2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all"><Edit2 size={12} /> Edit</button>
                    <button onClick={() => plan.id && handleDelete(plan.id)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all"><Trash2 size={14} /></button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-auto">
             <div className="p-6 border-b border-border-custom flex justify-between items-center bg-surface rounded-t-3xl">
                <h2 className="font-black text-[13px] uppercase tracking-widest">{editingPlan.id ? 'Edit Combo' : 'New Subscription Combo'}</h2>
                <button onClick={() => setShowModal(false)}><X size={20} /></button>
             </div>
             <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-text3 mb-2">Combo Name</label>
                    <input required type="text" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} className="w-full px-4 py-2.5 border border-border-custom rounded-xl text-[12px]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-text3 mb-2">Price / Month (₹)</label>
                    <input required type="number" value={editingPlan.monthlyPrice} onChange={e => setEditingPlan({...editingPlan, monthlyPrice: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 border border-border-custom rounded-xl text-[12px]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-text3 mb-2">Tagline / Catchphrase</label>
                  <input type="text" value={editingPlan.tagline} onChange={e => setEditingPlan({...editingPlan, tagline: e.target.value})} className="w-full px-4 py-2.5 border border-border-custom rounded-xl text-[12px]" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-text3 mb-2">Image URL</label>
                  <input type="text" value={editingPlan.imageUrl} onChange={e => setEditingPlan({...editingPlan, imageUrl: e.target.value})} className="w-full px-4 py-2.5 border border-border-custom rounded-xl text-[12px]" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-[11px] uppercase tracking-widest text-brand">Combo Items</h3>
                    <button type="button" onClick={addItem} className="text-brand flex items-center gap-1 font-black text-[10px] uppercase hover:underline"><Plus size={14} /> Add Item</button>
                  </div>
                  <div className="space-y-3">
                    {editingPlan.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-end bg-surface p-3 rounded-2xl relative group">
                        <div className="flex-1 space-y-3">
                           <input placeholder="Item Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-3 py-2 bg-white border border-border-custom rounded-lg text-[11px]" />
                           <div className="flex gap-2">
                              <input placeholder="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value))} className="w-20 px-3 py-2 bg-white border border-border-custom rounded-lg text-[11px]" />
                              <input placeholder="Unit" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-24 px-3 py-2 bg-white border border-border-custom rounded-lg text-[11px]" />
                              <select value={item.frequency} onChange={e => updateItem(idx, 'frequency', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-border-custom rounded-lg text-[11px]">
                                <option value="DAILY">Daily</option>
                                <option value="WEEKLY">Weekly</option>
                                <option value="MONTHLY">Monthly</option>
                              </select>
                           </div>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-border-custom rounded-2xl font-black text-[11px] uppercase">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white rounded-2xl font-black text-[11px] uppercase shadow-lg disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Combo'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
