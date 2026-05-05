'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Loader2, TrendingDown, Tag, PercentIcon } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

/* ─── Types ────────────────────────────────────────────────── */
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

export interface SubscriptionPlanTier {
  id?: number;
  durationMonths: number;
  label: string;
  discountPercent: number;
}

export interface SubscriptionPlan {
  id?: number;
  name: string;
  tagline: string;
  monthlyPrice: number;
  totalMrp?: number;
  badgeText?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  savings: number;
  totalValue: number;
  includesPoojaPack: boolean;
  items: SubscriptionPlanItem[];
  tiers: SubscriptionPlanTier[];
  slug?: string;
}

/* ─── Frequency Multipliers ────────────────────────────────── */
const FREQ_DAYS: Record<string, number> = { DAILY: 30, WEEKLY: 4, MONTHLY: 1, ONE_TIME: 1 };

/* ─── Blank Factories ──────────────────────────────────────── */
const blankItem = (): SubscriptionPlanItem => ({
  description: '', qty: 1, unit: 'Litre', frequency: 'DAILY', mrp: 0, sellingPrice: 0
});

const blankTier = (months: number, discount: number): SubscriptionPlanTier => ({
  durationMonths: months,
  label: months === 1 ? '1 Month' : `${months} Months`,
  discountPercent: discount,
});

const blankPlan = (): SubscriptionPlan => ({
  name: '', tagline: '', monthlyPrice: 0, totalMrp: 0, badgeText: '',
  imageUrl: '', displayOrder: 0, isActive: true, savings: 0, totalValue: 0,
  includesPoojaPack: false,
  items: [blankItem()],
  tiers: [
    blankTier(1, 0),
    blankTier(2, 5),
    blankTier(3, 7),
  ],
});

/* ─── ImageUploadInput ─────────────────────────────────────── */
function ImageUploadInput({ value, onChange, label = 'Image URL', showToast }: {
  value?: string; onChange: (v: string) => void; label?: string; showToast: any;
}) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.url) onChange(res.data.url);
    } catch { showToast('Failed to upload image.', 'error'); }
    finally { setUploading(false); }
  };
  return (
    <div>
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-3 items-center">
        {value && (
          <div className="w-14 h-14 rounded-2xl border border-border-custom overflow-hidden bg-surface flex-shrink-0 shadow-sm">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative flex-1">
          <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploading} />
          <button type="button" className="w-full px-5 py-3 bg-white border border-border-custom rounded-2xl text-[11px] font-black uppercase tracking-wider text-text2 shadow-sm hover:bg-surface transition-all">
            {uploading ? 'Uploading…' : value ? 'Change Image' : 'Select File'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Field ────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-1.5 ml-0.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 bg-white border border-border-custom rounded-2xl text-[13px] font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all shadow-sm ${props.className ?? ''}`}
    />
  );
}

/* ─── Main Modal ───────────────────────────────────────────── */
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
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const { showToast } = useNotification();

  useEffect(() => {
    if (!isOpen) return;
    if (plan) {
      setForm({
        ...plan,
        tiers: plan.tiers?.length ? plan.tiers : blankPlan().tiers,
      });
      setExpanded({});
    } else {
      setForm(blankPlan());
      setExpanded({ 0: true });
    }
  }, [plan, isOpen]);

  /* ── Live Price Calculation ── */
  const computedMonthlyOurPrice = form.items.reduce((sum, item) => {
    const mult = FREQ_DAYS[item.frequency] ?? 1;
    return sum + ((item.sellingPrice ?? 0) * (item.qty ?? 0) * mult);
  }, 0);

  const computedMonthlyMrp = form.items.reduce((sum, item) => {
    const mult = FREQ_DAYS[item.frequency] ?? 1;
    return sum + ((item.mrp ?? 0) * (item.qty ?? 0) * mult);
  }, 0);

  const totalSavings = computedMonthlyMrp - computedMonthlyOurPrice;

  /* ── Item helpers ── */
  const updateItem = (idx: number, field: keyof SubscriptionPlanItem, val: any) =>
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const removeItem = (idx: number) =>
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  /* ── Tier helpers ── */
  const updateTier = (idx: number, field: keyof SubscriptionPlanTier, val: any) =>
    setForm(p => ({ ...p, tiers: p.tiers.map((t, i) => i === idx ? { ...t, [field]: val } : t) }));

  const removeTier = (idx: number) =>
    setForm(p => ({ ...p, tiers: p.tiers.filter((_, i) => i !== idx) }));

  const addTier = () =>
    setForm(p => ({ ...p, tiers: [...p.tiers, { durationMonths: 1, label: '', discountPercent: 0 }] }));

  /* ── Save ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        monthlyPrice: Math.round(computedMonthlyOurPrice),
        totalMrp: Math.round(computedMonthlyMrp),
        savings: Math.round(totalSavings),
        totalValue: Math.round(computedMonthlyMrp),
        items: form.items.map((it, idx) => ({ ...it, displayOrder: idx })),
        tiers: form.tiers,
      };
      if (form.id) await api.put(`/subscription-plans/${form.id}`, payload);
      else await api.post('/subscription-plans', payload);
      await fetchPlans();
      onSave();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save combo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col border border-border-custom">

        {/* ── Header ── */}
        <div className="px-8 py-6 border-b border-border-custom flex justify-between items-center shrink-0 bg-white">
          <div>
            <p className="text-[10px] font-black uppercase text-text3 tracking-[0.2em] mb-1">Subscription Engine</p>
            <h2 className="text-2xl font-black text-brand tracking-tight">{plan ? 'Edit Combo Plan' : 'Create New Combo'}</h2>
          </div>
          <button onClick={onClose} className="p-2.5 bg-surface border border-border-custom rounded-full text-text3 hover:text-text hover:border-text3 transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">

            {/* ── Section 1: Basic Info ── */}
            <div className="bg-surface/50 rounded-[1.5rem] border border-border-custom p-6 space-y-5">
              <p className="text-[10px] font-black uppercase text-text3 tracking-[0.2em]">Basic Info</p>
              <div className="grid grid-cols-2 gap-5">
                <Field label="Combo Display Name">
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Essential Dairy Pack" required />
                </Field>
                <ImageUploadInput value={form.imageUrl} onChange={url => setForm({ ...form, imageUrl: url })} label="Combo Visual" showToast={showToast} />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <Field label="Marketing Tagline">
                  <Input value={form.tagline || ''} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="e.g. Everything you need for a healthy start" />
                </Field>
                <Field label="Badge Text (optional)">
                  <Input value={form.badgeText || ''} onChange={e => setForm({ ...form, badgeText: e.target.value })} placeholder="e.g. Most Popular" />
                </Field>
              </div>
            </div>

            {/* ── Section 2: Included Items ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase text-text3 tracking-[0.2em]">Included Items</p>
                <button type="button" onClick={() => setForm(p => ({ ...p, items: [...p.items, blankItem()] }))}
                  className="text-[11px] font-black text-brand hover:underline flex items-center gap-1">
                  <Plus size={13} /> Add Item
                </button>
              </div>

              {form.items.map((item, idx) => {
                const isExpanded = expanded[idx] ?? false;
                const monthlyMrp = (item.mrp ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1);
                const monthlyOur = (item.sellingPrice ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1);
                return (
                  <div key={idx} className="bg-white border border-border-custom rounded-[1.5rem] overflow-hidden shadow-sm">
                    {/* Item Header */}
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-surface/50 transition-colors"
                      onClick={() => setExpanded(p => ({ ...p, [idx]: !p[idx] }))}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-brand/10 text-brand text-[11px] font-black flex items-center justify-center">{idx + 1}</span>
                        <div>
                          <p className="text-[13px] font-black text-text">{item.description || 'New Item'}</p>
                          <p className="text-[10px] text-text3 font-medium">{item.qty} {item.unit} · {item.frequency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {monthlyOur > 0 && (
                          <div className="text-right">
                            <p className="text-[9px] font-black text-text3 uppercase tracking-wider">Our Price/mo</p>
                            <p className="text-[13px] font-black text-brand">₹{Math.round(monthlyOur)}</p>
                          </div>
                        )}
                        <button type="button" onClick={e => { e.stopPropagation(); removeItem(idx); }}
                          className="p-1.5 text-text3 hover:text-danger rounded-lg transition-colors"><Trash2 size={14} /></button>
                        {isExpanded ? <ChevronUp size={16} className="text-text3" /> : <ChevronDown size={16} className="text-text3" />}
                      </div>
                    </div>

                    {/* Item Body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-3 border-t border-border-custom bg-surface/30 space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-1">
                            <Field label="Item Description">
                              <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="e.g. A2 Gir Milk" />
                            </Field>
                          </div>
                          <Field label="Qty">
                            <Input type="number" step="0.1" min="0" value={item.qty} onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)} />
                          </Field>
                          <Field label="Unit">
                            <Input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Litre / kg / pcs" />
                          </Field>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <Field label="Frequency">
                            <select value={item.frequency} onChange={e => updateItem(idx, 'frequency', e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-border-custom rounded-2xl text-[13px] font-bold outline-none focus:border-brand transition-all shadow-sm">
                              <option value="DAILY">Daily</option>
                              <option value="WEEKLY">Weekly</option>
                              <option value="MONTHLY">Monthly</option>
                              <option value="ONE_TIME">One-Time</option>
                            </select>
                          </Field>
                          <Field label="Market Price (MRP) ₹">
                            <Input type="number" min="0" value={item.mrp ?? 0} onChange={e => updateItem(idx, 'mrp', parseFloat(e.target.value) || 0)} placeholder="0" />
                          </Field>
                          <Field label="Our Price ₹">
                            <Input type="number" min="0" value={item.sellingPrice ?? 0} onChange={e => updateItem(idx, 'sellingPrice', parseFloat(e.target.value) || 0)} placeholder="0" />
                          </Field>
                        </div>
                        {/* Per-item summary */}
                        {(monthlyMrp > 0 || monthlyOur > 0) && (
                          <div className="flex items-center gap-3 bg-white border border-border-custom rounded-2xl px-4 py-3">
                            <div className="flex-1">
                              <p className="text-[9px] font-black text-text3 uppercase tracking-wider">Market Value / mo</p>
                              <p className="text-[13px] font-bold text-text3 line-through">₹{Math.round(monthlyMrp)}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[9px] font-black text-brand uppercase tracking-wider">Our Price / mo</p>
                              <p className="text-[14px] font-black text-brand">₹{Math.round(monthlyOur)}</p>
                            </div>
                            {monthlyMrp > monthlyOur && (
                              <div className="bg-brand/10 px-3 py-1.5 rounded-xl">
                                <p className="text-[9px] font-black text-brand uppercase tracking-wider">Saving</p>
                                <p className="text-[13px] font-black text-brand">₹{Math.round(monthlyMrp - monthlyOur)}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Section 3: Live Price Summary ── */}
            <div className="rounded-[1.5rem] border-2 border-brand/20 bg-brand/5 overflow-hidden">
              <div className="px-6 py-4 bg-brand/10 border-b border-brand/10 flex items-center gap-2">
                <TrendingDown size={15} className="text-brand" />
                <p className="text-[10px] font-black uppercase text-brand tracking-[0.2em]">Monthly Price Summary (Auto-Calculated)</p>
              </div>
              <div className="px-6 py-5 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[9px] font-black text-text3 uppercase tracking-wider mb-1">Total Market Price</p>
                  <p className="text-xl font-black text-text3 line-through">₹{Math.round(computedMonthlyMrp)}</p>
                  <p className="text-[9px] text-text3 font-medium">per month</p>
                </div>
                <div className="text-center border-x border-brand/10">
                  <p className="text-[9px] font-black text-brand uppercase tracking-wider mb-1">Our Price</p>
                  <p className="text-2xl font-black text-brand">₹{Math.round(computedMonthlyOurPrice)}</p>
                  <p className="text-[9px] text-text3 font-medium">per month</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-text3 uppercase tracking-wider mb-1">Customer Saves</p>
                  <p className="text-xl font-black text-teal-600">₹{Math.round(totalSavings > 0 ? totalSavings : 0)}</p>
                  <p className="text-[9px] text-text3 font-medium">per month</p>
                </div>
              </div>
            </div>

            {/* ── Section 4: Subscription Tiers ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <PercentIcon size={13} className="text-text3" />
                  <p className="text-[10px] font-black uppercase text-text3 tracking-[0.2em]">Subscription Tiers & Discounts</p>
                </div>
                <button type="button" onClick={addTier}
                  className="text-[11px] font-black text-brand hover:underline flex items-center gap-1">
                  <Plus size={13} /> Add Tier
                </button>
              </div>
              <div className="bg-white border border-border-custom rounded-[1.5rem] overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-12 px-5 py-3 bg-surface border-b border-border-custom">
                  <span className="col-span-2 text-[9px] font-black uppercase text-text3 tracking-wider">Months</span>
                  <span className="col-span-4 text-[9px] font-black uppercase text-text3 tracking-wider">Label</span>
                  <span className="col-span-3 text-[9px] font-black uppercase text-text3 tracking-wider">Discount %</span>
                  <span className="col-span-2 text-[9px] font-black uppercase text-text3 tracking-wider">Eff. Price</span>
                  <span className="col-span-1" />
                </div>
                {form.tiers.map((tier, idx) => {
                  const effPrice = Math.round(computedMonthlyOurPrice * (1 - (tier.discountPercent ?? 0) / 100));
                  return (
                    <div key={idx} className="grid grid-cols-12 items-center px-5 py-3 border-b border-border-custom last:border-0 hover:bg-surface/50 gap-3">
                      <div className="col-span-2">
                        <input type="number" min="1" value={tier.durationMonths}
                          onChange={e => updateTier(idx, 'durationMonths', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-border-custom rounded-xl text-[12px] font-black text-center outline-none focus:border-brand" />
                      </div>
                      <div className="col-span-4">
                        <input value={tier.label}
                          onChange={e => updateTier(idx, 'label', e.target.value)}
                          placeholder={`${tier.durationMonths} Month${tier.durationMonths > 1 ? 's' : ''}`}
                          className="w-full px-3 py-2 border border-border-custom rounded-xl text-[12px] font-bold outline-none focus:border-brand" />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <input type="number" min="0" max="100" step="0.5" value={tier.discountPercent}
                            onChange={e => updateTier(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 pr-6 border border-border-custom rounded-xl text-[12px] font-black outline-none focus:border-brand" />
                          <span className="absolute right-2.5 top-2.5 text-[10px] text-text3 font-bold">%</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <p className="text-[13px] font-black text-brand">₹{effPrice}</p>
                        <p className="text-[9px] text-text3">/mo</p>
                      </div>
                      <div className="col-span-1 text-center">
                        {form.tiers.length > 1 && (
                          <button type="button" onClick={() => removeTier(idx)} className="p-1 text-text3 hover:text-danger transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="px-8 py-5 border-t border-border-custom bg-white flex gap-4 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 border-2 border-border-custom rounded-2xl font-black text-[12px] uppercase tracking-widest text-text2 hover:bg-surface transition-all">
              Discard
            </button>
            <button type="submit" disabled={saving}
              className="flex-[2] py-3.5 bg-brand text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-lg shadow-brand/20 hover:bg-brand-dark active:scale-95 transition-all disabled:opacity-50">
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span> : 'Save & Activate Combo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
