'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface Product {
  id?: number;
  name: string;
  category: 'dairy' | 'vegetables' | 'divine';
  subcategory: string;
  price: number;
  unit: string;
  description: string;
  inStock: boolean;
  rating?: number;
  reviews?: number;
  tags?: string; // backend stores as comma-separated string
}

const CATEGORIES = [
  { id: 'dairy', label: 'Dairy & Milk', icon: '🥛' },
  { id: 'vegetables', label: 'Fresh Veggies', icon: '🥬' },
  { id: 'divine', label: 'Divine Products', icon: '🔥' }
] as const;

const SUBCATEGORIES: Record<string, string[]> = {
  dairy: ['Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Beverages', 'Other'],
  vegetables: ['Vegetables', 'Leafy Greens', 'Fruits', 'Herbs', 'Other'],
  divine: ['Incense', 'Spiritual Items', 'Crystals', 'Other']
};

const blankForm = (): ProductForm => ({
  name: '', category: 'dairy', subcategory: 'Milk',
  price: 0, unit: 'per unit', description: '', inStock: true, tagsInput: ''
});

// Separate UI form type to handle tags as editable string
interface ProductForm extends Omit<Product, 'tags'> {
  tagsInput: string;
}

/* ─── Product Form Modal ─── */
function ProductFormModal({ isOpen, product, onSave, onClose }:
  { isOpen: boolean; product?: Product; onSave: (p: Product) => Promise<void>; onClose: () => void }) {

  const [form, setForm] = useState<ProductForm>(blankForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({ ...product, tagsInput: product.tags ?? '' });
    } else {
      setForm(blankForm());
    }
    setErrors({});
  }, [product, isOpen]);

  const set = (field: keyof ProductForm, value: any) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'category' ? { subcategory: SUBCATEGORIES[value as string][0] } : {})
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    if (form.price <= 0) e.price = 'Price must be greater than 0';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.unit.trim()) e.unit = 'Unit is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // Convert tagsInput string back to comma-separated string for backend
      const payload: Product = { ...form, tags: form.tagsInput };
      delete (payload as any).tagsInput;
      await onSave(payload);
      onClose();
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border-custom sticky top-0 bg-white">
          <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Basic Information</h3>

            <div>
              <label className="block text-[11px] font-black uppercase mb-2">Product Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. A2 Milk (1 Liter)"
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand ${errors.name ? 'border-red-500 bg-red-50' : 'border-border-custom'}`} />
              {errors.name && <p className="text-red-600 text-[10px] mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value as any)}
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Subcategory *</label>
                <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand">
                  {SUBCATEGORIES[form.category].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase mb-2">Description *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Product description..."
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand resize-none ${errors.description ? 'border-red-500 bg-red-50' : 'border-border-custom'}`} />
              {errors.description && <p className="text-red-600 text-[10px] mt-1">{errors.description}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Pricing & Availability</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Price (₹) *</label>
                <input type="number" value={form.price} min="0" step="0.01"
                  onChange={e => set('price', parseFloat(e.target.value))} placeholder="0.00"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand ${errors.price ? 'border-red-500 bg-red-50' : 'border-border-custom'}`} />
                {errors.price && <p className="text-red-600 text-[10px] mt-1">{errors.price}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Unit *</label>
                <input type="text" value={form.unit} onChange={e => set('unit', e.target.value)}
                  placeholder="e.g. per Liter"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand ${errors.unit ? 'border-red-500 bg-red-50' : 'border-border-custom'}`} />
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 bg-surface rounded-lg cursor-pointer hover:bg-surface2">
              <input type="checkbox" checked={form.inStock} onChange={e => set('inStock', e.target.checked)} className="w-5 h-5 accent-brand" />
              <span className="font-bold text-[12px]">In Stock</span>
            </label>
          </div>

          {/* Optional */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Ratings & Tags (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Rating (0–5)</label>
                <input type="number" value={form.rating ?? ''} min="0" max="5" step="0.1"
                  onChange={e => set('rating', parseFloat(e.target.value))} placeholder="4.5"
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Reviews Count</label>
                <input type="number" value={form.reviews ?? ''} min="0"
                  onChange={e => set('reviews', parseInt(e.target.value))} placeholder="42"
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase mb-2">Tags (comma-separated)</label>
              <input type="text" value={form.tagsInput ?? ''}
                onChange={e => set('tagsInput' as any, e.target.value)}
                placeholder="fresh, organic, daily"
                className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand" />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border-custom">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border-custom rounded-lg font-bold text-[12px] uppercase hover:bg-surface">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-black text-[12px] uppercase flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Product</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Admin Page ─── */
export default function ProductManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('dairy');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const handleSave = async (product: Product) => {
    if (product.id) {
      const res = await api.put(`/products/${product.id}`, product);
      setProducts(prev => prev.map(p => p.id === product.id ? res.data : p));
    } else {
      const res = await api.post('/products', product);
      setProducts(prev => [...prev, res.data]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const filtered = products.filter(p =>
    p.category === selectedCategory &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">Product Management</h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">Manage Sthirvaa shop inventory and product details</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchProducts}
            className="flex items-center gap-2 px-4 py-2.5 border border-border-custom rounded-xl font-bold text-[12px] hover:bg-surface transition-all">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { setEditingProduct(undefined); setShowForm(true); }}
            className="bg-brand text-white flex items-center gap-2 py-3 px-5 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg active:scale-95">
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {CATEGORIES.map(cat => {
          const cnt = products.filter(p => p.category === cat.id).length;
          const inStockCnt = products.filter(p => p.category === cat.id && p.inStock).length;
          return (
            <div key={cat.id} className={`bg-white border-2 rounded-2xl p-4 shadow-md cursor-pointer transition-all ${selectedCategory === cat.id ? 'border-brand' : 'border-border-custom hover:border-brand/40'}`}
              onClick={() => setSelectedCategory(cat.id)}>
              <div className="text-2xl mb-2">{cat.icon}</div>
              <p className="text-[10px] font-bold text-text3 uppercase tracking-wider">{cat.label}</p>
              <p className="text-xl font-black text-text">{cnt} <span className="text-[11px] text-green-600 font-bold">({inStockCnt} in stock)</span></p>
            </div>
          );
        })}
        <div className="bg-white border border-border-custom rounded-2xl p-4 shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-2">Total Products</p>
          <p className="text-xl font-black text-text">{products.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase transition-all ${
                selectedCategory === cat.id ? 'bg-brand text-white shadow-lg' : 'bg-surface text-text3 hover:bg-surface2'
              }`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <input type="text" placeholder="Search products..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border border-border-custom rounded-lg text-[12px] focus:outline-none focus:border-brand" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] opacity-50">🔍</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border-custom shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="text-text3 text-[12px]">Loading products...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-surface text-text3 uppercase text-[10px] font-black tracking-[0.1em] border-b border-border-custom">
                <tr>
                  <th className="px-6 py-4 text-left">Product</th>
                  <th className="px-6 py-4 text-left">Subcategory</th>
                  <th className="px-6 py-4 text-center">Price</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-center">Rating</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <AlertCircle size={36} className="mx-auto text-text3 opacity-30 mb-3" />
                      <p className="text-text3 font-medium">No products found in this category</p>
                      <button onClick={() => { setEditingProduct(undefined); setShowForm(true); }}
                        className="mt-3 text-brand font-black text-[12px] hover:underline">+ Add first product</button>
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="border-b border-border-custom hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-text">{p.name}</p>
                      <p className="text-[10px] text-text3 mt-0.5 line-clamp-1">{p.description}</p>
                    </td>
                    <td className="px-6 py-4 text-text3">{p.subcategory}</td>
                    <td className="px-6 py-4 text-center font-black text-brand">₹{p.price}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                        p.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.inStock ? 'bg-green-600' : 'bg-red-600'}`} />
                        {p.inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold">{p.rating ? `⭐ ${p.rating}` : '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditingProduct(p); setShowForm(true); }}
                          className="p-2 hover:bg-brand/10 rounded-lg text-brand" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => p.id && handleDelete(p.id)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductFormModal isOpen={showForm} product={editingProduct} onSave={handleSave}
        onClose={() => { setShowForm(false); setEditingProduct(undefined); }} />
    </AppLayout>
  );
}
