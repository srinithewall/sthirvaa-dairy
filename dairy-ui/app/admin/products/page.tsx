'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';
import ProductFormModal, { Product } from './ProductFormModal';
import ComboFormModal, { SubscriptionPlan } from './ComboFormModal';

/* --- Main Admin Page --- */
export default function ProductManagementPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
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
          { name: 'Organic Buffalo Curd', category: 'dairy', subcategory: 'Curd', price: 65, unit: '500g', description: 'Thick, creamy curd made from buffalo milk.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1628045610815-37cb420ba679?w=400' },
          { name: 'Desi Cow Ghee', category: 'dairy', subcategory: 'Ghee', price: 850, unit: '500ml', description: 'Bilona method handmade ghee.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400' },
          { name: 'Farm Fresh Eggs', category: 'dairy', subcategory: 'Eggs', price: 120, unit: '12 pcs', description: 'Free-range organic brown eggs.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400' },
          { name: 'Premium Paneer', category: 'dairy', subcategory: 'Paneer', price: 140, unit: '250g', description: 'Soft, fresh paneer made daily.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?w=400' },
          { name: 'Fresh Chicken', category: 'meat', subcategory: 'Chicken', price: 280, unit: '1 kg', description: 'Tender, fresh chicken cut to order.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0881?w=400' },
          { name: 'Organic Tomatoes', category: 'vegetables', subcategory: 'Veggies', price: 40, unit: '1 kg', description: 'Pesticide-free red tomatoes.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400' },
          { name: 'Divine Pooja Pack', category: 'divine', subcategory: 'Divine', price: 250, unit: '1 Pack', description: 'Complete pooja essentials kit.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400' }
        ];
        for (const p of SAMPLE_PRODUCTS) await api.post('/products', p);
        await fetchProducts();
        showToast('Data seeded successfully!');
      } catch (e: any) {
        console.error(e);
        showToast('Failed to seed: ' + (e.response?.data?.message || e.message), 'error');
      } finally { setSeeding(false); }
    });
  };

  useEffect(() => { 
    if (activeTab === 'products') fetchProducts(); 
    else fetchPlans();
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

  const handleProductSave = async (p: Product) => {
    try {
      if (p.id) await api.put(`/products/${p.id}`, p);
      else await api.post('/products', p);
      showToast(`Product ${p.id ? 'updated' : 'created'} successfully!`);
      fetchProducts();
    } catch (e: any) {
      console.error(e);
      showToast('Failed to save product: ' + (e.response?.data?.message || e.message), 'error');
      throw e;
    }
  };

  const handleDeleteProduct = (id: number) => {
    confirm('Are you sure you want to delete this product?', async () => {
      try {
        await api.delete(`/products/${id}`);
        showToast('Product deleted successfully!');
        fetchProducts();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Failed to delete.', 'error');
      }
    }, 'danger');
  };

  const handleDeletePlan = (id: number) => {
    confirm('Are you sure you want to delete this combo plan?', async () => {
      try {
        await api.delete(`/subscription-plans/${id}`);
        showToast('Combo plan deleted successfully!');
        fetchPlans();
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Failed to delete.', 'error');
      }
    }, 'danger');
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-text tracking-tight uppercase">Shop Management</h1>
            <p className="text-[11px] text-text3 font-bold uppercase tracking-wider mt-1">Inventory & Subscription Engine</p>
          </div>
          <div className="flex gap-3">
            <button onClick={seedData} disabled={seeding} className="bg-white text-text2 border border-border-custom px-5 py-2.5 rounded-xl font-bold text-[12px] uppercase tracking-wider flex items-center gap-2 hover:bg-surface transition-all">
              {seeding ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sync
            </button>
            <button onClick={() => activeTab === 'products' ? setShowProductModal(true) : setShowComboModal(true)}
              className="bg-brand text-white px-6 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-widest shadow-lg shadow-brand/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2">
              <Plus size={18} /> Add {activeTab === 'products' ? 'Product' : 'Combo'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-8 bg-surface p-1.5 rounded-2xl w-fit border border-border-custom">
          <button onClick={() => setActiveTab('products')} className={`px-8 py-2.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'products' ? 'bg-white shadow-md text-brand' : 'text-text3 hover:text-text'}`}>Product Catalogue</button>
          <button onClick={() => setActiveTab('combos')} className={`px-8 py-2.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'combos' ? 'bg-white shadow-md text-brand' : 'text-text3 hover:text-text'}`}>Subscription Combos</button>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand mb-4" size={32} /><p className="text-xs font-bold text-text3">Loading data...</p></div>
        ) : activeTab === 'products' ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead className="bg-surface text-[10px] font-black uppercase text-text3 border-b border-border-custom">
                  <tr><th className="px-6 py-4">Product</th><th className="px-6 py-4">Category</th><th className="px-6 py-4 text-center">Price</th><th className="px-6 py-4 text-center">Actions</th></tr>
                </thead>
                <tbody className="text-[13px] font-bold">
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-border-custom last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg border border-border-custom overflow-hidden bg-surface flex-shrink-0">
                          <img src={p.imageUrl || 'https://via.placeholder.com/50'} className="w-full h-full object-cover" />
                        </div>
                        <div><p className="text-text font-bold text-sm">{p.name}</p></div>
                      </td>
                      <td className="px-6 py-4"><span className="px-2.5 py-1 bg-surface rounded-md text-[10px] font-black text-text3 uppercase">{p.category}</span></td>
                      <td className="px-6 py-4 text-center font-black text-brand">₹{p.price}</td>
                      <td className="px-6 py-4">
                         <div className="flex justify-center gap-2">
                            <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-2 text-brand hover:bg-brand/10 rounded-lg transition-all"><Edit2 size={16}/></button>
                            <button onClick={() => p.id && handleDeleteProduct(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl border border-border-custom shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                <div className="h-32 bg-surface relative">
                  <img src={plan.imageUrl || 'https://via.placeholder.com/300'} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-brand text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shadow-md">{plan.badgeText || 'PLAN'}</div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-black text-sm text-text mb-1 truncate">{plan.name}</h3>
                  <p className="text-brand font-black text-xs">₹{plan.monthlyPrice} <span className="text-[9px] text-text3 uppercase font-bold">/ Mo</span></p>
                  <div className="mt-3 flex-1 space-y-1 bg-surface/30 p-2 rounded-lg border border-border-custom">
                    {plan.items?.slice(0, 2).map((item, i) => <div key={i} className="text-[9px] text-text2 font-bold flex justify-between truncate"><span>{item.description}</span></div>)}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditingPlan(plan); setShowComboModal(true); }} className="flex-1 py-2 bg-text text-white rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1 hover:opacity-90 transition-all shadow-sm">Edit</button>
                    <button onClick={() => plan.id && handleDeletePlan(plan.id)} className="px-2.5 py-2 text-red-600 border border-red-50 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-all"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ProductFormModal isOpen={showProductModal} product={editingProduct} onSave={handleProductSave} onClose={() => { setShowProductModal(false); setEditingProduct(undefined); }} />
        <ComboFormModal isOpen={showComboModal} plan={editingPlan} onSave={() => { showToast('Combo saved successfully!'); fetchPlans(); setShowComboModal(false); setEditingPlan(undefined); }} onClose={() => { setShowComboModal(false); setEditingPlan(undefined); }} fetchPlans={fetchPlans} />
      </div>
    </AppLayout>
  );
}
