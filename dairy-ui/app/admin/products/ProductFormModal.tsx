'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, ImageIcon } from 'lucide-react';
import api, { formatImageUrl } from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

/* --- Types --- */
export interface Product {
  id?: number;
  name: string;
  category: 'dairy' | 'vegetables' | 'divine' | 'meat';
  subcategory: string;
  price: number;
  unit: string;
  description: string;
  inStock: boolean;
  rating?: number;
  reviews?: number;
  tags?: string;
  imageUrl?: string;
  slashedPrice?: number;
}

const CATEGORIES = [
  { id: 'dairy', label: 'Dairy & Milk', icon: '🥛' },
  { id: 'vegetables', label: 'Fresh Veggies', icon: '🥬' },
  { id: 'divine', label: 'Divine Products', icon: '🔥' },
  { id: 'meat', label: 'Meats', icon: '🍗' },
] as const;

const blankProduct = (): Product => ({
  name: '', category: 'dairy', subcategory: 'Milk',
  price: 0, unit: 'per unit', description: '', inStock: true, imageUrl: ''
});

const inputCls = 'w-full px-3 py-2.5 border border-border-custom text-base sm:text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all bg-white';

/* --- Image Upload --- */
function ImageUploadInput({ value, onChange, onUploading, showToast }: { value?: string; onChange: (v: string) => void; onUploading: (v: boolean) => void; showToast: any }) {
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [value]);



  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Immediate local preview
    onChange(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    onUploading(true);
    try {
      const res = await api.post('/files/upload?type=products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.url) onChange(res.data.url);
    } catch {
      showToast('Failed to upload image.', 'error');
    } finally { 
      setUploading(false); 
      onUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-black text-text3 uppercase tracking-wider mb-1.5">Product Image</label>
      <div className="flex gap-3 items-center">
        <div className="w-14 h-14 rounded-sm border border-border-custom overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
          {value && !imgError
            ? <img src={formatImageUrl(value)} alt="Preview" className="w-full h-full object-cover" onError={() => setImgError(true)} />
            : <ImageIcon size={20} className="text-text3" />}
        </div>
        <div className="relative flex-1 min-w-0">
          <input type="file" accept="image/*" onChange={handleUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={uploading} />
          <button type="button" disabled={uploading}
            className="w-full px-3 py-2.5 bg-surface border border-border-custom rounded-sm text-[11px] font-black uppercase tracking-wider text-text2 hover:bg-white transition-all truncate">
            {uploading ? <span className="flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Uploading…</span> : value ? 'Change Image' : 'Upload Image'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  product?: Product;
  onSave: (p: Product) => Promise<void>;
  onClose: () => void;
}

export default function ProductFormModal({ isOpen, product, onSave, onClose }: Props) {
  const [form, setForm] = useState<Product>(blankProduct());
  const [errors, setErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { showToast } = useNotification();

  useEffect(() => {
    if (product) setForm(product);
    else setForm(blankProduct());
    setErrors({});
  }, [product, isOpen]);

  const validate = () => {
    const e: any = {};
    if (!form.name?.trim()) e.name = 'Required';
    if (!form.price || form.price <= 0) e.price = 'Required';
    if (!form.unit?.trim()) e.unit = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch { /* handled by parent */ }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col border border-border-custom relative">

        {/* Header (Fixed) */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border-custom bg-white shrink-0">
          <div>
            <p className="text-[9px] font-black uppercase text-text3 tracking-[0.2em] mb-0.5">Product</p>
            <h2 className="font-black text-base text-text">{product ? 'Edit Product' : 'Add New Product'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-sm transition-colors"><X size={16} /></button>
        </div>

        {/* Form Content (Scrollable) */}
        <form className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">

          {/* Name */}
          <div>
            <label className={`block text-[10px] font-black uppercase mb-1.5 ${errors.name ? 'text-red-500' : 'text-text3'}`}>
              Product Name {errors.name && <span className="text-red-400 normal-case font-medium">— {errors.name}</span>}
            </label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. A2 Gir Milk" className={`${inputCls} ${errors.name ? 'border-red-400' : ''} rounded-sm`} />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-text3 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as any })} className={`${inputCls} rounded-sm`}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-text3 mb-1.5">Unit</label>
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g. 1 Litre" className={`${inputCls} ${errors.unit ? 'border-red-400' : ''} rounded-sm`} />
            </div>
          </div>

          {/* Price + Slashed Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[10px] font-black uppercase mb-1.5 ${errors.price ? 'text-red-500' : 'text-text3'}`}>
                Price (₹)
              </label>
              <input type="number" value={form.price}
                onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} font-black text-brand ${errors.price ? 'border-red-400' : ''} rounded-sm`} />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-text3 mb-1.5">Market Price / MRP (₹)</label>
              <input type="number" value={form.slashedPrice || ''}
                onChange={e => setForm({ ...form, slashedPrice: parseFloat(e.target.value) || undefined })}
                placeholder="Optional" className={`${inputCls} text-text3 rounded-sm`} />
            </div>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block text-[10px] font-black uppercase text-text3 mb-1.5">Subcategory</label>
            <input value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
              placeholder="e.g. Milk, Curd, Ghee" className={`${inputCls} rounded-sm`} />
          </div>

          {/* Image Upload */}
          <ImageUploadInput value={form.imageUrl} onChange={url => setForm({ ...form, imageUrl: url })} onUploading={setUploading} showToast={showToast} />

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black uppercase text-text3 mb-1.5">Description</label>
            <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief product description..." rows={3}
              className="w-full px-3 py-2.5 border border-border-custom rounded-sm text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all resize-none bg-white" />
          </div>

          {/* In Stock toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-sm border border-border-custom">
            <div>
              <p className="text-[11px] font-black text-text">In Stock</p>
              <p className="text-[9px] text-text3">Toggle product availability</p>
            </div>
            <button type="button" onClick={() => setForm({ ...form, inStock: !form.inStock })}
              className={`w-10 h-5 rounded-full transition-all relative ${form.inStock ? 'bg-brand' : 'bg-gray-300'}`}>
              <span className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${form.inStock ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </form>

        {/* Footer (Fixed) */}
        <div className="flex gap-3 p-4 border-t border-border-custom bg-white shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 border border-border-custom rounded-sm font-bold text-sm text-text2 hover:bg-surface transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || uploading}
            className="flex-[2] py-3 bg-brand text-white rounded-sm font-black text-[12px] uppercase tracking-wider shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-50 transition-all">
            {saving || uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> 
                {uploading ? 'Uploading…' : 'Saving…'}
              </span>
            ) : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
