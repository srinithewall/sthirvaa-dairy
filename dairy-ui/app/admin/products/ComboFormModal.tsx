'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Minus, Gift, Loader2 } from 'lucide-react';
import api from '@/lib/api';

/* --- Types --- */
export interface SubscriptionPlanItem {
  id?: number;
  description: string;
  qty: number;
  unit: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONE_TIME';
  imageUrl?: string;
  mrp?: number;
  sellingPrice?: number;
}

export interface SubscriptionPlan {
  id?: number;
  name: string;
  tagline: string;
  monthlyPrice: number;
  badgeText?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  savings: number;
  totalValue: number;
  includesPoojaPack: boolean;
  items: SubscriptionPlanItem[];
  quarterlyPrice?: number;
  halfYearlyPrice?: number;
  yearlyPrice?: number;
  quarterlyBonus?: string;
  halfYearlyBonus?: string;
  yearlyBonus?: string;
  slug?: string;
}

interface ImageUploadInputProps {
  value?: string;
  onChange: (val: string) => void;
  label?: string;
}

function ImageUploadInput({ value, onChange, label = "Image URL" }: ImageUploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.url) onChange(res.data.url);
    } catch (err) {
      console.error(err);
      alert('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex flex-col h-full justify-end">
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-3 items-center h-full min-h-[44px]">
        {value && (
          <div className="w-12 h-12 rounded-xl border border-border-custom overflow-hidden bg-surface flex-shrink-0 shadow-sm">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative flex-1 h-full">
          <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploading} />
          <button type="button" className="w-full h-full px-6 bg-white border border-border-custom rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] text-text2 shadow-sm hover:bg-surface transition-all">
            {uploading ? 'Uploading...' : (value ? 'Change Image' : 'Select File')}
          </button>
        </div>
      </div>
    </div>
  );
}

const blankSubItem = (): SubscriptionPlanItem => ({
  description: '', qty: 1, unit: 'Litre', frequency: 'DAILY', imageUrl: '', mrp: 0, sellingPrice: 0
});

const blankPlan = (): SubscriptionPlan => ({
  name: '', tagline: '', monthlyPrice: 0, badgeText: '', imageUrl: '', 
  displayOrder: 0, isActive: true, savings: 0, totalValue: 0, includesPoojaPack: false, items: [blankSubItem()],
  quarterlyPrice: 0, halfYearlyPrice: 0, yearlyPrice: 0,
  quarterlyBonus: '', halfYearlyBonus: '', yearlyBonus: ''
});

interface Props {
  isOpen: boolean;
  plan?: SubscriptionPlan;
  onSave: () => void;
  onClose: () => void;
  fetchPlans: () => Promise<void>;
}

export default function ComboFormModal({ isOpen, plan, onSave, onClose, fetchPlans }: Props) {
  const [form, setForm] = useState<SubscriptionPlan>(blankPlan());
  const [saving, setSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const DAYS_MAP: Record<string, number> = { DAILY: 30, WEEKLY: 4, MONTHLY: 1, ONE_TIME: 1 };

  useEffect(() => {
    if (plan) {
      setForm(plan);
      const initialExpanded: Record<number, boolean> = {};
      plan.items?.forEach((_, i) => initialExpanded[i] = false);
      setExpandedItems(initialExpanded);
    } else {
      setForm(blankPlan());
      setExpandedItems({ 0: true });
    }
  }, [plan, isOpen]);

  const updateItem = (idx: number, field: keyof SubscriptionPlanItem, val: any) => {
    setForm(prev => {
      const nextItems = prev.items.map((item, i) => i === idx ? { ...item, [field]: val } : item);
      return { ...prev, items: nextItems };
    });
  };

  const handleComboSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        pricePerMonth: Number(form.monthlyPrice),
        items: form.items.map((it, idx) => ({ ...it, displayOrder: idx }))
      };
      if (form.id) await api.put(`/subscription-plans/${form.id}`, payload);
      else await api.post('/subscription-plans', payload);
      await fetchPlans();
      onSave();
    } catch (e: any) {
      console.error(e);
      alert('Failed to save combo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-border-custom">
        <div className="p-8 border-b border-border-custom flex justify-between items-start bg-white shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase text-text3 tracking-widest mb-1">Subscription Engine</p>
            <h2 className="text-3xl font-serif font-black text-brand tracking-tight">{plan ? 'Edit Combo Plan' : 'Create New Combo'}</h2>
          </div>
          <button onClick={onClose} className="p-3 bg-white shadow-lg border border-border-custom rounded-full transition-all hover:scale-110 text-text3"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleComboSave} className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
          <div className="bg-surface/30 p-8 rounded-[2rem] border border-border-custom space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-1">
                <label className="block text-[10px] font-black uppercase text-text3 tracking-wider mb-2 ml-1">Combo Display Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-5 py-3.5 bg-white border border-border-custom rounded-2xl text-sm font-bold outline-none focus:border-brand shadow-sm" placeholder="e.g. Essential Dairy Pack" />
              </div>
              <div className="col-span-1">
                <ImageUploadInput value={form.imageUrl} onChange={url => setForm({...form, imageUrl: url})} label="Combo Visual" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-text3 tracking-wider mb-2 ml-1">Marketing Tagline</label>
              <input value={form.tagline || ''} onChange={e => setForm({...form, tagline: e.target.value})} className="w-full px-5 py-3.5 bg-white border border-border-custom rounded-2xl text-sm font-bold outline-none focus:border-brand shadow-sm" placeholder="e.g. Everything you need for a healthy start" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] font-black uppercase text-text3 tracking-widest">Included Items</p>
              <button type="button" onClick={() => setForm({...form, items: [...form.items, blankSubItem()]})} className="text-[11px] font-black text-brand uppercase tracking-widest hover:underline transition-all">+ Add Product</button>
            </div>
            <div className="space-y-4">
              {form.items.map((item, idx) => {
                const expanded = expandedItems[idx] ?? false;
                return (
                  <div key={idx} className="bg-white border border-border-custom rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className="px-6 py-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedItems(p => ({...p, [idx]: !p[idx]}))}>
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-[11px] font-black text-text3">{idx + 1}</span>
                        <p className="text-sm font-black text-text">{item.description || 'New Product Item'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={e => { e.stopPropagation(); setForm({...form, items: form.items.filter((_, i) => i !== idx)}); }} className="p-2 text-text3 hover:text-red-500"><Trash2 size={16}/></button>
                        {expanded ? <ChevronUp size={18} className="text-text3"/> : <ChevronDown size={18} className="text-text3"/>}
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-6 pb-6 pt-2 grid grid-cols-4 gap-4 bg-surface/5 border-t border-border-custom/50">
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-text3 uppercase mb-1.5 ml-1">Item Description</label>
                          <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-border-custom rounded-xl text-xs font-bold outline-none" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-text3 uppercase mb-1.5 ml-1">Qty</label>
                          <input type="number" step="0.1" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-border-custom rounded-xl text-xs font-bold outline-none" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-text3 uppercase mb-1.5 ml-1">Unit</label>
                          <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-border-custom rounded-xl text-xs font-bold outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-brand/5 p-8 rounded-[2rem] border border-brand/20 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-brand tracking-widest mb-1">Base Monthly Price</p>
              <p className="text-[11px] text-text3 font-medium italic">Auto-syncs with shopping cart</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-brand">₹</span>
              <input type="number" value={form.monthlyPrice} onChange={e => setForm({...form, monthlyPrice: parseFloat(e.target.value)})} className="w-40 px-6 py-4 bg-white border-2 border-brand/10 rounded-2xl text-2xl font-black text-brand outline-none focus:border-brand shadow-inner" />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 border-2 border-border-custom rounded-2xl font-black text-[12px] uppercase tracking-widest text-text2 hover:bg-surface transition-all">Discard</button>
            <button type="submit" disabled={saving} className="flex-2 py-4 bg-brand text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl shadow-brand/20 hover:opacity-90 active:scale-95 transition-all">
              {saving ? 'Processing...' : 'Save & Active Combo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
