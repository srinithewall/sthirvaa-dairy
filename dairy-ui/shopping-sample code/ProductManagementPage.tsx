'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Eye, EyeOff, Save, X, AlertCircle } from 'lucide-react';

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
  image?: string;
  rating?: number;
  reviews?: number;
  tags?: string[];
}

interface FormState extends Product {
  id?: number;
}

const CATEGORIES = [
  { id: 'dairy', label: 'Dairy & Milk', icon: '🥛' },
  { id: 'vegetables', label: 'Fresh Veggies', icon: '🥬' },
  { id: 'divine', label: 'Divine Products', icon: '🔥' }
];

const SUBCATEGORIES = {
  dairy: ['Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Beverages', 'Other'],
  vegetables: ['Vegetables', 'Leafy Greens', 'Fruits', 'Herbs'],
  divine: ['Incense', 'Spiritual Items', 'Crystals', 'Other']
};

/* ─── Product Form Modal ─── */
function ProductFormModal({
  isOpen,
  product,
  onSave,
  onClose
}: {
  isOpen: boolean;
  product?: Product;
  onSave: (product: Product) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    product || {
      name: '',
      category: 'dairy',
      subcategory: 'Milk',
      price: 0,
      unit: 'per unit',
      description: '',
      inStock: true,
      tags: []
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (form.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(form);
      onClose();
    }
  };

  const handleFieldChange = (field: keyof FormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border-custom sticky top-0 bg-white">
          <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Basic Information</h3>

            <div>
              <label className="block text-[11px] font-black uppercase mb-2">Product Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand transition-colors ${
                  errors.name ? 'border-red-500 bg-red-50' : 'border-border-custom'
                }`}
                placeholder="e.g. A2 Milk (1 Liter)"
              />
              {errors.name && <p className="text-red-600 text-[10px] mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Category *</label>
                <select
                  value={form.category}
                  onChange={e => handleFieldChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Subcategory *</label>
                <select
                  value={form.subcategory}
                  onChange={e => handleFieldChange('subcategory', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
                >
                  {SUBCATEGORIES[form.category as keyof typeof SUBCATEGORIES].map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase mb-2">Description *</label>
              <textarea
                value={form.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                rows={3}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand transition-colors resize-none ${
                  errors.description ? 'border-red-500 bg-red-50' : 'border-border-custom'
                }`}
                placeholder="Product description..."
              />
              {errors.description && <p className="text-red-600 text-[10px] mt-1">{errors.description}</p>}
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Pricing & Availability</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Price (₹) *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => handleFieldChange('price', parseFloat(e.target.value))}
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:border-brand transition-colors ${
                    errors.price ? 'border-red-500 bg-red-50' : 'border-border-custom'
                  }`}
                  placeholder="0.00"
                />
                {errors.price && <p className="text-red-600 text-[10px] mt-1">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Unit *</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={e => handleFieldChange('unit', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
                  placeholder="e.g. per Liter"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 bg-surface rounded-lg cursor-pointer hover:bg-surface2 transition-colors">
              <input
                type="checkbox"
                checked={form.inStock}
                onChange={e => handleFieldChange('inStock', e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-bold text-[12px]">In Stock</span>
            </label>
          </div>

          {/* Rating */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Ratings (Optional)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Rating (0-5)</label>
                <input
                  type="number"
                  value={form.rating || 0}
                  onChange={e => handleFieldChange('rating', parseFloat(e.target.value))}
                  step="0.1"
                  min="0"
                  max="5"
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
                  placeholder="4.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase mb-2">Number of Reviews</label>
                <input
                  type="number"
                  value={form.reviews || 0}
                  onChange={e => handleFieldChange('reviews', parseInt(e.target.value))}
                  min="0"
                  className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
                  placeholder="42"
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Tags (Optional)</h3>
            <input
              type="text"
              value={(form.tags || []).join(', ')}
              onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()))}
              className="w-full px-4 py-2.5 border border-border-custom rounded-lg focus:outline-none focus:border-brand"
              placeholder="e.g. fresh, organic, daily"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-border-custom">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border-custom rounded-lg font-bold text-[12px] uppercase transition-colors hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-black text-[12px] uppercase transition-colors flex items-center justify-center gap-2"
            >
              <Save size={14} />
              Save Product
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

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      // const res = await api.get('/products');
      // setProducts(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSaveProduct = (product: Product) => {
    if (product.id) {
      setProducts(prev => prev.map(p => (p.id === product.id ? product : p)));
    } else {
      setProducts(prev => [...prev, { ...product, id: Date.now() }]);
    }
    setEditingProduct(undefined);
    setShowForm(false);
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">
            Product Management
          </h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">
            Manage Sthirvaa shop inventory and product details
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(undefined);
            setShowForm(true);
          }}
          className="bg-brand text-white flex items-center gap-2 py-3 px-5 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} />
          <span>Add Product</span>
        </button>
      </div>

      {/* ─── Filters ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase transition-all ${
                selectedCategory === cat.id
                  ? 'bg-brand text-white shadow-lg'
                  : 'bg-surface text-text3 hover:bg-surface2'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border border-border-custom rounded-lg text-[12px] focus:outline-none focus:border-brand"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text3">🔍</span>
        </div>
      </div>

      {/* ─── Products Table ─── */}
      <div className="bg-white rounded-2xl border border-border-custom shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface text-text3 uppercase text-[10px] font-black tracking-[0.1em] border-b border-border-custom">
              <tr>
                <th className="px-6 py-4 text-left">Product Name</th>
                <th className="px-6 py-4 text-left">Subcategory</th>
                <th className="px-6 py-4 text-center">Price</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Rating</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle size={40} className="text-text3 opacity-30" />
                      <p className="text-text3 font-medium">No products found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr
                    key={product.id}
                    className="border-b border-border-custom hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-text">{product.name}</p>
                        <p className="text-[10px] text-text3 mt-0.5 line-clamp-1">
                          {product.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text3">{product.subcategory}</td>
                    <td className="px-6 py-4 text-center font-black text-brand">₹{product.price}</td>
                    <td className="px-6 py-4 text-center">
                      {product.inStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black">
                          <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                          In Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                          Out of Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold">
                      {product.rating ? `⭐ ${product.rating}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowForm(true);
                          }}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => product.id && handleDeleteProduct(product.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Form Modal ─── */}
      <ProductFormModal
        isOpen={showForm}
        product={editingProduct}
        onSave={handleSaveProduct}
        onClose={() => {
          setShowForm(false);
          setEditingProduct(undefined);
        }}
      />
    </AppLayout>
  );
}
