'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Loader2, TrendingDown, PercentIcon, ImageIcon } from 'lucide-react';
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
  tiers: [blankTier(1, 0), blankTier(2, 5), blankTier(3, 7)],
});

/* ─── Image Upload Input ───────────────────────────────────── */
function ImageUploadInput({ value, onChange, label = 'Image URL', showToast }: {
  value?: string; onChange: (v: string) => void; label?: string; showToast: any;
}) {
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [value]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    onChange(localUrl);
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.url) {
        onChange(res.data.url);
      }
    } catch {
      showToast('Failed to upload image.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-2 items-center">
        {/* Image preview */}
        <div className="w-12 h-12 rounded border border-border-custom overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
          {value && !imgError ? (
            <img src={value} alt="Preview" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <ImageIcon size={20} className="text-text3" />
          )}
        </div>
        <div className="relative flex-1 min-w-0">
          <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploading} />
          <button type="button" className="w-full px-3 py-2.5 bg-white border border-border-custom rounded text-[11px] font-black uppercase tracking-wider text-text2 hover:bg-surface transition-all truncate">
            {uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}
          </button>
        </div>
      </div>
      {value && !imgError && (
        <p className="text-[9px] text-text3 mt-1 truncate">{value}</p>
      )}
    </div>
  );
}

/* ─── Field + Input ────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 bg-white border border-border-custom rounded text-[13px] font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all shadow-sm min-w-0';

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
      setForm({ ...plan, tiers: plan.tiers?.length ? plan.tiers : blankPlan().tiers });
      setExpanded({});
    } else {
      setForm(blankPlan());
      setExpanded({ 0: true });
    }
  }, [plan, isOpen]);

  /* ── Live Price Calculation ── */
  const computedMonthlyOurPrice = form.items.reduce((sum, item) => {
    return sum + ((item.sellingPrice ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1));
  }, 0);

  const computedMonthlyMrp = form.items.reduce((sum, item) => {
    return sum + ((item.mrp ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1));
  }, 0);

  const totalSavings = computedMonthlyMrp - computedMonthlyOurPrice;

  /* ── Helpers ── */
  const updateItem = (idx: number, field: keyof SubscriptionPlanItem, val: any) =>
    setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const removeItem = (idx: number) =>
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl my-2 sm:my-0 overflow-hidden flex flex-col border border-border-custom">

        {/* ── Header ── */}
        <div className="px-4 sm:px-6 py-4 border-b border-border-custom flex justify-between items-center shrink-0 bg-white">
          <div>
            <p className="text-[9px] font-black uppercase text-text3 tracking-[0.2em] mb-0.5">Subscription Engine</p>
            <h2 className="text-lg sm:text-xl font-black text-brand tracking-tight">{plan ? 'Edit Combo Plan' : 'Create New Combo'}</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-surface border border-border-custom rounded text-text3 hover:text-text transition-all">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-5">

            {/* ── Section 1: Basic Info ── */}
            <div className="bg-surface/50 rounded border border-border-custom p-4 space-y-4">
              <p className="text-[9px] font-black uppercase text-text3 tracking-[0.2em]">Basic Info</p>

              {/* Name + Image — stacked on mobile, side by side on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Combo Display Name">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Essential Dairy Pack" required className={inputCls} />
                </Field>
                <ImageUploadInput value={form.imageUrl} onChange={url => setForm({ ...form, imageUrl: url })} label="Combo Visual" showToast={showToast} />
              </div>

              {/* Tagline + Badge — stacked on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Marketing Tagline">
                  <input value={form.tagline || ''} onChange={e => setForm({ ...form, tagline: e.target.value })}
                    placeholder="e.g. Pure milk daily, delivered fresh" className={inputCls} />
                </Field>
                <Field label="Badge Text (optional)">
                  <input value={form.badgeText || ''} onChange={e => setForm({ ...form, badgeText: e.target.value })}
                    placeholder="e.g. Most Popular" className={inputCls} />
                </Field>
              </div>
            </div>

            {/* ── Section 2: Included Items ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase text-text3 tracking-[0.2em]">Included Items</p>
                <button type="button" onClick={() => setForm(p => ({ ...p, items: [...p.items, blankItem()] }))}
                  className="text-[11px] font-black text-brand hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {form.items.map((item, idx) => {
                const isExp = expanded[idx] ?? false;
                const mMrp = (item.mrp ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1);
                const mOur = (item.sellingPrice ?? 0) * (item.qty ?? 0) * (FREQ_DAYS[item.frequency] ?? 1);
                return (
                  <div key={idx} className="bg-white border border-border-custom rounded overflow-hidden">
                    {/* Item Header */}
                    <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface/40 transition-colors"
                      onClick={() => setExpanded(p => ({ ...p, [idx]: !p[idx] }))}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[10px] font-black flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-text truncate">{item.description || 'New Item'}</p>
                          <p className="text-[10px] text-text3 font-medium truncate">{item.qty} {item.unit} · {item.frequency}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {mOur > 0 && (
                          <div className="text-right hidden sm:block">
                            <p className="text-[8px] font-black text-text3 uppercase">Our/mo</p>
                            <p className="text-[12px] font-black text-brand">₹{Math.round(mOur)}</p>
                          </div>
                        )}
                        <button type="button" onClick={e => { e.stopPropagation(); removeItem(idx); }}
                          className="p-1 text-text3 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        {isExp ? <ChevronUp size={14} className="text-text3" /> : <ChevronDown size={14} className="text-text3" />}
                      </div>
                    </div>

                    {/* Item Body */}
                    {isExp && (
                      <div className="px-4 pb-4 pt-3 border-t border-border-custom bg-surface/20 space-y-3">
                        {/* Description full width */}
                        <Field label="Item Description">
                          <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                            placeholder="e.g. A2 Gir Milk" className={inputCls} />
                        </Field>

                        {/* Qty + Unit + Frequency in a row */}
                        <div className="grid grid-cols-3 gap-2">
                          <Field label="Qty">
                            <input type="number" step="0.1" min="0" value={item.qty}
                              onChange={e => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)} className={inputCls} />
                          </Field>
                          <Field label="Unit">
                            <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                              placeholder="Litre" className={inputCls} />
                          </Field>
                          <Field label="Frequency">
                            <select value={item.frequency} onChange={e => updateItem(idx, 'frequency', e.target.value)}
                              className={inputCls}>
                              <option value="DAILY">Daily</option>
                              <option value="WEEKLY">Weekly</option>
                              <option value="MONTHLY">Monthly</option>
                              <option value="ONE_TIME">One-Time</option>
                            </select>
                          </Field>
                        </div>

                        {/* MRP + Selling Price in a row */}
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Market Price (₹)">
                            <input type="number" min="0" value={item.mrp ?? 0}
                              onChange={e => updateItem(idx, 'mrp', parseFloat(e.target.value) || 0)} className={inputCls} />
                          </Field>
                          <Field label="Our Price (₹)">
                            <input type="number" min="0" value={item.sellingPrice ?? 0}
                              onChange={e => updateItem(idx, 'sellingPrice', parseFloat(e.target.value) || 0)} className={inputCls} />
                          </Field>
                        </div>

                        {/* Per-item monthly summary */}
                        {(mMrp > 0 || mOur > 0) && (
                          <div className="flex items-center gap-2 bg-white border border-border-custom rounded px-3 py-2.5 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <p className="text-[8px] font-black text-text3 uppercase">Market / mo</p>
                              <p className="text-[12px] font-bold text-text3 line-through">₹{Math.round(mMrp)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[8px] font-black text-brand uppercase">Our / mo</p>
                              <p className="text-[13px] font-black text-brand">₹{Math.round(mOur)}</p>
                            </div>
                            {mMrp > mOur && (
                              <div className="bg-brand/10 px-2 py-1 rounded flex-shrink-0">
                                <p className="text-[8px] font-black text-brand uppercase">Saving</p>
                                <p className="text-[12px] font-black text-brand">₹{Math.round(mMrp - mOur)}</p>
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
            <div className="rounded border-2 border-brand/20 bg-brand/5 overflow-hidden">
              <div className="px-4 py-3 bg-brand/10 border-b border-brand/10 flex items-center gap-2">
                <TrendingDown size={13} className="text-brand flex-shrink-0" />
                <p className="text-[9px] font-black uppercase text-brand tracking-wider">Monthly Summary (Auto-Calculated)</p>
              </div>
              <div className="px-4 py-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[8px] font-black text-text3 uppercase tracking-wider mb-1">Market Price</p>
                  <p className="text-base font-black text-text3 line-through">₹{Math.round(computedMonthlyMrp)}</p>
                  <p className="text-[8px] text-text3">/mo</p>
                </div>
                <div className="border-x border-brand/10">
                  <p className="text-[8px] font-black text-brand uppercase tracking-wider mb-1">Our Price</p>
                  <p className="text-lg font-black text-brand">₹{Math.round(computedMonthlyOurPrice)}</p>
                  <p className="text-[8px] text-text3">/mo</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-text3 uppercase tracking-wider mb-1">Saves</p>
                  <p className="text-base font-black text-teal-600">₹{Math.round(totalSavings > 0 ? totalSavings : 0)}</p>
                  <p className="text-[8px] text-text3">/mo</p>
                </div>
              </div>
            </div>

            {/* ── Section 4: Subscription Tiers ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PercentIcon size={12} className="text-text3" />
                  <p className="text-[9px] font-black uppercase text-text3 tracking-[0.2em]">Subscription Tiers & Discounts</p>
                </div>
                <button type="button" onClick={addTier}
                  className="text-[11px] font-black text-brand hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add Tier
                </button>
              </div>

              <div className="bg-white border border-border-custom rounded overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 px-3 py-2 bg-surface border-b border-border-custom">
                  <span className="col-span-2 text-[8px] font-black uppercase text-text3">Mo</span>
                  <span className="col-span-4 text-[8px] font-black uppercase text-text3">Label</span>
                  <span className="col-span-3 text-[8px] font-black uppercase text-text3">Disc %</span>
                  <span className="col-span-2 text-[8px] font-black uppercase text-text3">Price</span>
                  <span className="col-span-1" />
                </div>

                {form.tiers.map((tier, idx) => {
                  const effPrice = Math.round(computedMonthlyOurPrice * (1 - (tier.discountPercent ?? 0) / 100));
                  return (
                    <div key={idx} className="grid grid-cols-12 items-center px-3 py-2.5 border-b border-border-custom last:border-0 gap-1.5">
                      <div className="col-span-2">
                        <input type="number" min="1" value={tier.durationMonths}
                          onChange={e => updateTier(idx, 'durationMonths', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-border-custom rounded text-[11px] font-black text-center outline-none focus:border-brand" />
                      </div>
                      <div className="col-span-4">
                        <input value={tier.label}
                          onChange={e => updateTier(idx, 'label', e.target.value)}
                          placeholder={`${tier.durationMonths}m`}
                          className="w-full px-2 py-1.5 border border-border-custom rounded text-[11px] font-bold outline-none focus:border-brand" />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <input type="number" min="0" max="100" step="0.5" value={tier.discountPercent}
                            onChange={e => updateTier(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 pr-5 border border-border-custom rounded text-[11px] font-black outline-none focus:border-brand" />
                          <span className="absolute right-1.5 top-2 text-[9px] text-text3 font-bold">%</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <p className="text-[11px] font-black text-brand leading-tight">₹{effPrice}</p>
                        <p className="text-[8px] text-text3">/mo</p>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {form.tiers.length > 1 && (
                          <button type="button" onClick={() => removeTier(idx)} className="p-0.5 text-text3 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div className="px-4 sm:px-6 py-4 border-t border-border-custom bg-white flex gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border-2 border-border-custom rounded font-black text-[11px] uppercase tracking-wider text-text2 hover:bg-surface transition-all">
              Discard
            </button>
            <button type="submit" disabled={saving}
              className="flex-[2] py-3 bg-brand text-white rounded font-black text-[11px] uppercase tracking-wider shadow-lg shadow-brand/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
              {saving
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving…</span>
                : 'Save & Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
