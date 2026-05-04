'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import api from '@/lib/api';

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
  { id: 'meat', label: 'Meats', icon: '🍗' }
] as const;

const blankProduct = (): Product => ({
  name: '', category: 'dairy', subcategory: 'Milk',
  price: 0, unit: 'per unit', description: '', inStock: true, imageUrl: ''
});

/* --- Image Upload Component (Internal) --- */
function ImageUploadInput({ value, onChange, label = "Image URL" }: { value?: string; onChange: (val: string) => void; label?: string }) {
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
      <label className="block text-[11px] font-bold text-text3 uppercase tracking-wider mb-1">{label}</label>
      <div className="flex gap-2 items-center h-full min-h-[40px]">
        {value && (
          <div className="w-10 h-10 rounded-lg border border-border-custom overflow-hidden bg-surface flex-shrink-0">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative flex-1">
          <input type="file" accept="image/*" onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploading} />
          <button type="button" className="w-full px-4 py-2 bg-surface border border-border-custom rounded-xl text-[12px] font-black uppercase tracking-widest text-text2 flex items-center justify-center gap-2" disabled={uploading}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> {value ? 'Change' : 'Select File'}</>}
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

  useEffect(() => {
    if (product) setForm(product);
    else setForm(blankProduct());
    setErrors({});
  }, [product, isOpen]);

  const validateForm = () => {
    const newErrors: any = {};
    if (!form.name?.trim()) newErrors.name = 'Required';
    if (!form.price || form.price <= 0) newErrors.price = 'Required';
    if (!form.unit?.trim()) newErrors.unit = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try { 
      await onSave(form); 
      onClose(); 
    } catch (err) {
      console.error('Save failed:', err);
    } finally { 
      setSaving(false); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border-custom sticky top-0 bg-white z-10">
          <h2 className="font-black text-[14px] uppercase tracking-wider">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="grid grid-cols-2 gap-4 bg-surface/50 p-4 rounded-2xl border border-border-custom">
              <div className="col-span-2">
                <label className={`block text-[10px] font-black uppercase mb-1 ${errors.name ? 'text-red-500' : ''}`}>Product Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-4 py-2 border border-border-custom rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value as any})} className="w-full px-4 py-2 border border-border-custom rounded-xl text-sm bg-white">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase mb-1">Unit</label>
                <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full px-4 py-2 border border-border-custom rounded-xl text-sm outline-none" />
              </div>
               <div>
                <label className="block text-[10px] font-black uppercase mb-1">Price (₹)</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} className="w-full px-4 py-2 border border-border-custom rounded-xl text-sm font-black text-brand" />
              </div>
           </div>
           
           <ImageUploadInput value={form.imageUrl} onChange={url => setForm({...form, imageUrl: url})} label="Product Image" />
           
           <div>
              <label className="block text-[10px] font-black uppercase mb-1">Description</label>
              <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2 border border-border-custom rounded-xl text-sm h-24 outline-none" />
           </div>
           
           <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 py-3 border border-border-custom rounded-xl font-bold text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 bg-brand text-white rounded-xl font-black text-sm uppercase shadow-lg shadow-brand/20">{saving ? 'Saving...' : 'Save Product'}</button>
           </div>
        </form>
      </div>
    </div>
  );
}
