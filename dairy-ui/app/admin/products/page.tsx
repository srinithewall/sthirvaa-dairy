'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api, { formatImageUrl } from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, RefreshCw, ImageIcon, Package } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';
import ProductFormModal, { Product } from './ProductFormModal';
import ComboFormModal, { SubscriptionPlan } from './ComboFormModal';



export default function ProductManagementPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'combos' | 'categories'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🥛');
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | undefined>();
  const [seeding, setSeeding] = useState(false);
  const { showToast, confirm } = useNotification();

  const seedData = async () => {
    confirm('This will insert sample data into your database. Continue?', async () => {
      setSeeding(true);
      try {
        const SAMPLE_PRODUCTS: Product[] = [
          { name: 'Sthirvaa A2 Gir Milk', category: 'dairy', subcategory: 'Milk', price: 90, unit: '1 Litre', description: 'Pure A2 milk from our Gir cows.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400' },
          { name: 'Organic Buffalo Curd', category: 'dairy', subcategory: 'Curd', price: 65, unit: '500g', description: 'Thick, creamy curd.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1628045610815-37cb420ba679?w=400' },
          { name: 'Desi Cow Ghee', category: 'dairy', subcategory: 'Ghee', price: 850, unit: '500ml', description: 'Bilona method ghee.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400' },
          { name: 'Farm Fresh Eggs', category: 'dairy', subcategory: 'Eggs', price: 120, unit: '12 pcs', description: 'Free-range eggs.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400' },
        ];
        for (const p of SAMPLE_PRODUCTS) await api.post('/products', p);
        await fetchProducts();
        showToast('Data seeded successfully!');
      } catch (e: any) {
        showToast('Failed to seed: ' + (e.response?.data?.message || e.message), 'error');
      } finally { setSeeding(false); }
    });
  };

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    else if (activeTab === 'combos') fetchPlans();
    else fetchCategories();
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try { const res = await api.get('/products'); setProducts(res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try { const res = await api.get('/subscription-plans'); setPlans(res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/product_categories');
      if (res.data?.settingValue) {
        setCategories(JSON.parse(res.data.settingValue));
      } else {
        setCategories([
          { id: 'dairy', name: 'Dairy & Milk', icon: '🥛' },
          { id: 'vegetables', name: 'Fresh Veggies', icon: '🥬' },
          { id: 'divine', name: 'Divine Products', icon: '🔥' },
          { id: 'meat', name: 'Meats', icon: '🍗' }
        ]);
      }
    } catch (e) {
      console.error(e);
      setCategories([
        { id: 'dairy', name: 'Dairy & Milk', icon: '🥛' },
        { id: 'vegetables', name: 'Fresh Veggies', icon: '🥬' },
        { id: 'divine', name: 'Divine Products', icon: '🔥' },
        { id: 'meat', name: 'Meats', icon: '🍗' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveCategoriesList = async (updated: { id: string; name: string; icon: string }[]) => {
    try {
      await api.post('/settings', {
        settingKey: 'product_categories',
        settingValue: JSON.stringify(updated),
        description: 'Dynamic list of product categories'
      });
      setCategories(updated);
      showToast('Categories updated successfully!');
    } catch (e: any) {
      showToast('Failed to save categories: ' + (e.response?.data?.message || e.message), 'error');
    }
  };

  const handleAddCategory = () => {
    if (!newCatId.trim() || !newCatName.trim()) {
      showToast('Category ID and Name are required', 'error');
      return;
    }
    const cleanId = newCatId.trim().toLowerCase().replace(/\s+/g, '-');
    if (categories.some(c => c.id === cleanId)) {
      showToast('Category with this ID already exists', 'error');
      return;
    }
    const updated = [...categories, { id: cleanId, name: newCatName.trim(), icon: newCatIcon.trim() }];
    saveCategoriesList(updated);
    setNewCatId('');
    setNewCatName('');
    setNewCatIcon('🥛');
  };

  const handleDeleteCategory = (id: string) => {
    confirm(`Delete category "${id}"? Products in this category will not filter correctly until updated.`, () => {
      const updated = categories.filter(c => c.id !== id);
      saveCategoriesList(updated);
    }, 'danger');
  };

  const handleProductSave = async (p: Product) => {
    try {
      if (p.id) await api.put(`/products/${p.id}`, p);
      else await api.post('/products', p);
      showToast(`Product ${p.id ? 'updated' : 'created'} successfully!`);
      fetchProducts();
    } catch (e: any) {
      showToast('Failed to save: ' + (e.response?.data?.message || e.message), 'error');
      throw e;
    }
  };

  const handleDeleteProduct = (id: number) => {
    confirm('Delete this product?', async () => {
      try { await api.delete(`/products/${id}`); showToast('Product deleted!'); fetchProducts(); }
      catch (e: any) { showToast(e.response?.data?.message || 'Failed to delete.', 'error'); }
    }, 'danger');
  };

  const handleDeletePlan = (id: number) => {
    confirm('Delete this combo plan?', async () => {
      try { await api.delete(`/subscription-plans/${id}`); showToast('Combo deleted!'); fetchPlans(); }
      catch (e: any) { showToast(e.response?.data?.message || 'Failed to delete.', 'error'); }
    }, 'danger');
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-text tracking-tight uppercase truncate">Shop Management</h1>
            <p className="text-[10px] text-text3 font-bold uppercase tracking-wider mt-0.5">Inventory & Subscription Engine</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {activeTab !== 'categories' && (
              <>
                <button onClick={seedData} disabled={seeding}
                  className="bg-white text-text2 border border-border-custom px-3 sm:px-4 py-2 rounded-sm font-bold text-[11px] uppercase tracking-wide flex items-center gap-1.5 hover:bg-surface transition-all">
                  {seeding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span className="hidden sm:inline">Sync</span>
                </button>
                <button
                  onClick={() => activeTab === 'products' ? setShowProductModal(true) : setShowComboModal(true)}
                  className="bg-brand text-white px-3 sm:px-5 py-2 rounded-sm font-black text-[11px] uppercase tracking-wide shadow-lg shadow-brand/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5">
                  <Plus size={15} />
                  <span>{activeTab === 'products' ? 'Add Product' : 'Add Combo'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-surface p-1 rounded-sm border border-border-custom w-fit">
          <button onClick={() => setActiveTab('products')}
            className={`px-4 sm:px-6 py-2 rounded-sm text-[11px] font-black transition-all ${activeTab === 'products' ? 'bg-white shadow text-brand' : 'text-text3 hover:text-text'}`}>
            Products
          </button>
          <button onClick={() => setActiveTab('combos')}
            className={`px-4 sm:px-6 py-2 rounded-sm text-[11px] font-black transition-all ${activeTab === 'combos' ? 'bg-white shadow text-brand' : 'text-text3 hover:text-text'}`}>
            Combos
          </button>
          <button onClick={() => setActiveTab('categories')}
            className={`px-4 sm:px-6 py-2 rounded-sm text-[11px] font-black transition-all ${activeTab === 'categories' ? 'bg-white shadow text-brand' : 'text-text3 hover:text-text'}`}>
            Categories
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin mx-auto text-brand mb-3" size={28} />
            <p className="text-xs font-bold text-text3">Loading...</p>
          </div>
        ) : activeTab === 'products' ? (

          /* ── Products Table ── */
          <div className="bg-white rounded-sm border border-border-custom shadow-sm overflow-hidden">
            {/* Mobile card view */}
            <div className="block sm:hidden divide-y divide-border-custom">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-sm border border-border-custom overflow-hidden bg-surface flex-shrink-0">
                    <img src={formatImageUrl(p.imageUrl) || ''} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-text truncate">{p.name}</p>
                    <p className="text-[10px] text-text3 font-medium">{p.category} · <span className="text-brand font-black">₹{p.price}</span></p>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <button onClick={() => handleProductSave({ ...p, inStock: !p.inStock })} className={`w-8 h-4 rounded-full relative transition-all ${p.inStock ? 'bg-brand' : 'bg-gray-300'}`}>
                       <span className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${p.inStock ? 'left-4' : 'left-1'}`} />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                    <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-1.5 text-brand hover:bg-brand/10 rounded-sm transition-all"><Edit2 size={14} /></button>
                    <button onClick={() => p.id && handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <table className="w-full text-left hidden sm:table">
              <thead className="bg-surface text-[10px] font-black uppercase text-text3 border-b border-border-custom">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-center">Price</th>
                  <th className="px-5 py-3 text-center">In Stock</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13px] font-bold divide-y divide-border-custom">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-sm border border-border-custom overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={formatImageUrl(p.imageUrl)} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).replaceWith(document.createTextNode('')) }} />
                          ) : <Package size={16} className="text-text3" />}
                        </div>
                        <p className="text-text font-bold text-sm truncate max-w-[200px]">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 bg-surface rounded-sm text-[10px] font-black text-text3 uppercase">{p.category}</span></td>
                    <td className="px-5 py-3 text-center font-black text-brand">₹{p.price}</td>
                    <td className="px-5 py-3 text-center">
                       <button onClick={() => handleProductSave({ ...p, inStock: !p.inStock })} className={`w-8 h-4 rounded-full relative transition-all inline-block align-middle ${p.inStock ? 'bg-brand' : 'bg-gray-300'}`}>
                         <span className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${p.inStock ? 'left-4' : 'left-1'}`} />
                       </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-1.5 text-brand hover:bg-brand/10 rounded-sm transition-all"><Edit2 size={15} /></button>
                        <button onClick={() => p.id && handleDeleteProduct(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-sm transition-all"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <div className="py-16 text-center text-text3 text-sm font-medium">No products yet. Click "Add Product" to get started.</div>
            )}
          </div>

        ) : activeTab === 'combos' ? (
          /* ── Combo Cards ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-sm border border-border-custom shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all">
                {/* Image */}
                <div className="h-28 bg-surface relative overflow-hidden flex items-center justify-center">
                  {plan.imageUrl ? (
                    <img src={formatImageUrl(plan.imageUrl)} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <ImageIcon size={28} className="text-text3/40" />
                  )}
                  {plan.badgeText && (
                    <div className="absolute top-2 right-2 bg-brand text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow">
                      {plan.badgeText.replace('???', '₹')}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <h3 className="font-black text-[13px] text-text leading-tight truncate">{plan.name}</h3>
                    {plan.tagline && <p className="text-[10px] text-text3 truncate mt-0.5">{plan.tagline}</p>}
                  </div>

                  {/* Price row */}
                  <div className="flex items-baseline gap-2">
                    <p className="text-brand font-black text-sm">₹{plan.monthlyPrice}</p>
                    <span className="text-[9px] text-text3 uppercase font-bold">/mo</span>
                    {plan.totalMrp && plan.totalMrp > plan.monthlyPrice && (
                      <p className="text-[10px] text-text3 line-through ml-auto">₹{plan.totalMrp}</p>
                    )}
                  </div>

                  {/* Items preview */}
                  <div className="flex-1 bg-surface/40 rounded-sm border border-border-custom p-2 space-y-1">
                    {plan.items?.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-1">
                        <p className="text-[9px] text-text2 font-bold truncate">{item.description}</p>
                        {item.sellingPrice ? <p className="text-[9px] text-brand font-black flex-shrink-0">₹{item.sellingPrice}</p> : null}
                      </div>
                    ))}
                    {(plan.items?.length ?? 0) > 3 && (
                      <p className="text-[8px] text-text3 font-medium">+{(plan.items?.length ?? 0) - 3} more</p>
                    )}
                  </div>

                  {/* Tiers preview */}
                  {plan.tiers && plan.tiers.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {plan.tiers.slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[8px] bg-brand/10 text-brand font-black px-1.5 py-0.5 rounded-sm">
                          {t.label || `${t.durationMonths}m`}{t.discountPercent > 0 ? ` -${t.discountPercent}%` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setEditingPlan(plan); setShowComboModal(true); }}
                      className="flex-1 py-2 bg-brand text-white rounded-sm font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 hover:opacity-90 transition-all shadow-sm">
                      <Edit2 size={11} /> Edit
                    </button>
                    <button onClick={() => plan.id && handleDeletePlan(plan.id)}
                      className="px-2.5 py-2 text-red-500 border border-red-100 bg-red-50 hover:bg-red-500 hover:text-white rounded-sm transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="col-span-full py-16 text-center text-text3 text-sm font-medium">No combos yet. Click "Add Combo" to create one.</div>
            )}
          </div>
        ) : (
          /* ── Category Management ── */
          <div className="space-y-6">
            {/* Add Category Form */}
            <div className="bg-white rounded-sm border border-border-custom p-4 shadow-sm max-w-xl">
              <h3 className="text-xs font-black text-text uppercase tracking-wider mb-3">Add New Category</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[9px] font-black uppercase text-text3 mb-1">Emoji / Icon</label>
                  <input type="text" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="e.g. 🥛" className="w-full px-3 py-2 border border-border-custom text-sm outline-none focus:border-brand bg-white" />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {['🥛', '🥬', '🍗', '🍎', '🍯', '🧀', '🍞', '🍳', '🥩', '🧈', '🌻', '🔥'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCatIcon(emoji)}
                        className={`w-6.5 h-6.5 flex items-center justify-center rounded border text-sm hover:bg-surface transition-all ${newCatIcon === emoji ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border-custom'}`}
                        title="Click to select"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-text3 block mt-1">Tip: Press <kbd className="bg-gray-100 px-1 rounded font-sans font-bold">Win + .</kbd> for more emojis</span>
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-text3 mb-1">Category Name</label>
                  <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Dairy & Milk" className="w-full px-3 py-2 border border-border-custom text-sm outline-none focus:border-brand bg-white" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-text3 mb-1">Category ID (URL safe)</label>
                  <input type="text" value={newCatId} onChange={e => setNewCatId(e.target.value)} placeholder="e.g. dairy" className="w-full px-3 py-2 border border-border-custom text-sm outline-none focus:border-brand bg-white" />
                </div>
              </div>
              <button onClick={handleAddCategory} className="mt-4 bg-brand text-white px-5 py-2.5 rounded-sm font-black text-[11px] uppercase tracking-wider shadow-sm hover:opacity-90">
                Create Category
              </button>
            </div>

            {/* Categories List */}
            <div className="bg-white rounded-sm border border-border-custom shadow-sm overflow-hidden max-w-3xl">
              <table className="w-full text-left">
                <thead className="bg-surface text-[10px] font-black uppercase text-text3 border-b border-border-custom">
                  <tr>
                    <th className="px-5 py-3">Icon</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] font-bold divide-y divide-border-custom">
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 text-xl">{cat.icon}</td>
                      <td className="px-5 py-3 text-text font-bold">{cat.name}</td>
                      <td className="px-5 py-3 text-text3 font-mono">{cat.id}</td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-red-500 hover:bg-red-55 rounded-sm transition-all"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text3 text-sm">No categories configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ProductFormModal
          isOpen={showProductModal} product={editingProduct} onSave={handleProductSave}
          onClose={() => { setShowProductModal(false); setEditingProduct(undefined); }} />
        <ComboFormModal
          isOpen={showComboModal} plan={editingPlan}
          onSave={() => { showToast('Combo saved!'); fetchPlans(); setShowComboModal(false); setEditingPlan(undefined); }}
          onClose={() => { setShowComboModal(false); setEditingPlan(undefined); }}
          fetchPlans={fetchPlans} />
      </div>
    </AppLayout>
  );
}
