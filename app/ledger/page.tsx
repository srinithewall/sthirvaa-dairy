'use client';

import React, { useEffect, useState, Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, ArrowUpCircle, ArrowDownCircle, History, X, Tag, FolderPlus } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  icon?: string;
  iconCode?: string;
}

interface Transaction {
  id: number;
  category: string;
  amount: number;
  date: string;
  description: string;
  type: 'EXPENSE' | 'INCOME';
}

export default function LedgerPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection & Form State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // New Category State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📂');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');

  useEffect(() => {
    if (typeParam === 'EXPENSE' || typeParam === 'INCOME') {
      setActiveTab(typeParam as 'EXPENSE' | 'INCOME');
    }
  }, [typeParam]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const responses = await Promise.allSettled([
        api.get('/categories'),
        api.get('/expenses'),
        api.get('/income')
      ]);
      
      const catRes = responses[0].status === 'fulfilled' ? responses[0].value.data : [];
      const expRes = responses[1].status === 'fulfilled' ? responses[1].value.data : [];
      const incRes = responses[2].status === 'fulfilled' ? responses[2].value.data : [];

      setCategories(catRes);
      
      const combined: Transaction[] = [
        ...expRes.map((e: any) => ({ ...e, type: 'EXPENSE' })),
        ...incRes.map((i: any) => ({ ...i, type: 'INCOME' }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistory(combined);
    } catch (err) {
      console.error("Ledger fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedCategory || !amount) return;
    setSaving(true);
    try {
      const endpoint = selectedCategory.type === 'EXPENSE' ? '/expenses' : '/income';
      await api.post(endpoint, {
        category: selectedCategory.name,
        amount: parseFloat(amount),
        description: description || `Payment for ${selectedCategory.name}`,
        date: new Date().toISOString().split('T')[0]
      });
      
      // Success: Reset and refresh
      setSelectedCategory(null);
      setAmount('');
      setDescription('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save entry. Make sure backend is running!");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName) return;
    setCreatingCategory(true);
    try {
      await api.post('/categories', {
        name: newCatName,
        type: activeTab,
        iconCode: newCatIcon
      });
      
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatIcon('📂');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create category. Note: Only ADMIN can create categories.");
      console.error(err);
    } finally {
      setCreatingCategory(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pb-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text tracking-tight">Digital Ledger</h1>
            <p className="text-[13px] text-text3 mt-1">Sthirvaa Farms · Financial Entries</p>
          </div>
          <div className="bg-white p-1 rounded-lg border border-border-custom flex shadow-sm">
            <button 
              onClick={() => setActiveTab('EXPENSE')}
              className={`px-6 py-2 rounded-md transition-all text-[13px] font-bold ${activeTab === 'EXPENSE' ? 'bg-danger text-white' : 'text-text3'}`}
            >
              EXPENSE
            </button>
            <button 
              onClick={() => setActiveTab('INCOME')}
              className={`px-6 py-2 rounded-md transition-all text-[13px] font-bold ${activeTab === 'INCOME' ? 'bg-brand text-white' : 'text-text3'}`}
            >
              INCOME
            </button>
          </div>
        </div>
        {/* Balance Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-radius-custom-lg border border-border-custom shadow-sm flex flex-col items-center justify-center gap-1">
             <span className="text-[11px] font-bold text-text3 uppercase tracking-widest">Initial Balance</span>
             <span className="text-2xl font-black text-text">₹0.00</span>
          </div>
          <div className="bg-danger/5 border border-danger/10 p-6 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1">
             <span className="text-[11px] font-bold text-danger uppercase tracking-widest">Total Expense</span>
             <span className="text-2xl font-black text-danger">₹{history.filter(h => h.type === 'EXPENSE').reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
          </div>
          <div className="bg-brand/5 border border-brand/10 p-6 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1">
             <span className="text-[11px] font-bold text-brand uppercase tracking-widest">Total Income</span>
             <span className="text-2xl font-black text-brand">₹{history.filter(h => h.type === 'INCOME').reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
          </div>
        </div>

        {/* Category Grid Section */}
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-bold text-text2 uppercase tracking-wide">Select Category</h2>
          <span className="text-[11px] text-text3 italic">Click any category to add record</span>
        </div>
        
        <div className="bg-white p-8 rounded-radius-custom-lg border border-border-custom card-shadow mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-surface/50 rounded-full -mr-16 -mt-16" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-y-10 gap-x-4 relative z-10">
            {filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => setSelectedCategory(cat)}
                className="flex flex-col items-center gap-3 group cursor-pointer"
              >
                <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center text-2xl shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl ${activeTab === 'EXPENSE' ? 'bg-danger/10 text-danger border border-danger/20 group-hover:bg-danger group-hover:text-white' : 'bg-brand/10 text-brand border border-brand/20 group-hover:bg-brand group-hover:text-white'}`}>
                  {cat.iconCode || cat.icon || cat.name.charAt(0)}
                </div>
                <span className="text-[12px] font-extrabold text-text2 text-center leading-tight">{cat.name}</span>
              </div>
            ))}
            <div 
              onClick={() => setShowCategoryModal(true)}
              className="flex flex-col items-center gap-3 cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-[20px] bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 group-hover:bg-slate-800 group-hover:text-white transition-all shadow-md group-hover:-translate-y-1">
                <Plus size={28} />
              </div>
              <span className="text-[12px] font-extrabold text-slate-500 uppercase tracking-tighter text-center">Add New<br/>Category</span>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
          <div className="p-5 border-b border-border-custom bg-surface2/50 flex items-center justify-between">
            <h3 className="text-[15px] font-black flex items-center gap-2 text-text">
              <History size={18} className="text-brand" /> RECENT TRANSACTIONS
            </h3>
            <div className="flex items-center gap-2">
               <div className="relative">
                 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
                 <input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 bg-white border border-border-custom rounded-full text-xs w-40 focus:ring-1 focus:ring-brand outline-none" />
               </div>
            </div>
          </div>
          
          <div className="divide-y divide-border-custom bg-white">
            {loading ? (
              <div className="p-20 text-center">
                 <div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin mb-3"></div>
                 <div className="text-[13px] text-text3 font-medium uppercase tracking-widest">Updating Ledger...</div>
              </div>
            ) : history.length === 0 ? (
              <div className="p-20 text-center">
                 <div className="text-text3 mb-2 opacity-20"><Plus size={48} className="mx-auto" /></div>
                 <div className="text-[14px] font-bold text-text3">NO TRANSACTIONS YET</div>
                 <div className="text-[11px] text-text3/60 uppercase tracking-widest mt-1">Start by selecting a category above</div>
              </div>
            ) : history.map((item) => (
              <div key={item.id} className="p-5 flex items-center justify-between hover:bg-surface transition-all group border-l-4 border-transparent hover:border-brand">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm transition-transform group-hover:scale-110 ${item.type === 'EXPENSE' ? 'bg-danger/10 text-danger border border-danger/10' : 'bg-brand/10 text-brand border border-brand/10'}`}>
                    {categories.find(c => c.name === item.category)?.iconCode || categories.find(c => c.name === item.category)?.icon || item.category.charAt(0)}
                  </div>
                  <div>
                    <div className="font-black text-text text-[15px] tracking-tight">{item.category}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-bold bg-surface2 px-2 py-0.5 rounded text-text2 uppercase">{item.date}</span>
                      <span className="text-[12px] text-text3 font-medium line-clamp-1 max-w-[200px]">{item.description}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-[18px] tracking-tighter ${item.type === 'EXPENSE' ? 'text-danger' : 'text-brand'}`}>
                    {item.type === 'EXPENSE' ? '-' : '+'} ₹{item.amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-bold text-text3 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Managed by Staff
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-surface2/30 border-t border-border-custom text-center">
             <button className="text-[12px] font-black text-brand uppercase tracking-widest hover:underline">View Full Statement</button>
          </div>
        </div>
      </div>

      {/* Amount Entry Modal (existing logic) */}
      {selectedCategory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-center text-white flex flex-col items-center gap-2 ${selectedCategory.type === 'EXPENSE' ? 'bg-danger' : 'bg-brand'}`}>
              <div className="w-full flex justify-end mb-[-24px]">
                <button onClick={() => setSelectedCategory(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black mb-1">
                {selectedCategory.iconCode || selectedCategory.icon || selectedCategory.name.charAt(0)}
              </div>
              <div className="text-xl font-extrabold uppercase tracking-widest">{selectedCategory.name}</div>
              <div className="text-[12px] opacity-80 font-medium tracking-wide">Enter {selectedCategory.type.toLowerCase()} details</div>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2">Amount (₹)</label>
                <input 
                  autoFocus
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-4xl font-black text-text border-none outline-none focus:ring-0 p-0 placeholder:opacity-20 translate-y-[-4px]"
                />
                <div className="h-[1px] bg-border-custom w-full mt-2" />
              </div>

              <div className="mb-8">
                <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2">Note (Optional)</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Paid for April feed"
                  className="w-full text-sm text-text2 border-none outline-none focus:ring-0 p-0 placeholder:opacity-40"
                />
              </div>

              <button 
                disabled={saving || !amount}
                onClick={handleSaveEntry}
                className={`w-full py-4 rounded-radius-custom-lg font-black text-lg shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${selectedCategory.type === 'EXPENSE' ? 'bg-danger text-white shadow-danger/20' : 'bg-brand text-white shadow-brand/20'}`}
              >
                {saving ? 'SAVING...' : 'SAVE RECORD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-center text-white flex flex-col items-center gap-2 ${activeTab === 'EXPENSE' ? 'bg-danger' : 'bg-brand'}`}>
              <div className="w-full flex justify-end mb-[-24px]">
                <button onClick={() => setShowCategoryModal(false)} className="text-white/80 hover:text-white"><X size={24}/></button>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl mb-1">
                <FolderPlus size={32} />
              </div>
              <div className="text-xl font-extrabold uppercase tracking-widest">New Category</div>
              <div className="text-[12px] opacity-80 font-medium tracking-wide">Create a recurring {activeTab.toLowerCase()} category</div>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2">Category Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Feed, Electricity"
                  className="w-full text-xl font-bold text-text border-none outline-none focus:ring-0 p-0 placeholder:opacity-20"
                />
                <div className="h-[1px] bg-border-custom w-full mt-2" />
              </div>

              <div className="mb-8">
                <label className="block text-[11px] font-bold text-text3 uppercase tracking-widest mb-2">Select Icon (Emoji)</label>
                <div className="flex gap-2 flex-wrap">
                  {['📂', '🌾', '💸', '🥛', '🚛', '🔌', '💧', '🏥', '🛠️'].map(emoji => (
                    <button 
                      key={emoji}
                      onClick={() => setNewCatIcon(emoji)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${newCatIcon === emoji ? 'border-brand bg-brand/10 scale-110' : 'border-border-custom hover:bg-surface'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                disabled={creatingCategory || !newCatName}
                onClick={handleCreateCategory}
                className={`w-full py-4 rounded-radius-custom-lg font-black text-lg shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${activeTab === 'EXPENSE' ? 'bg-danger text-white shadow-danger/20' : 'bg-brand text-white shadow-brand/20'}`}
              >
                {creatingCategory ? 'CREATING...' : 'CREATE CATEGORY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// Wrap with Suspense for useSearchParams
export default function LedgerPageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading Ledger...</div>}>
      <LedgerPage />
    </Suspense>
  );
}
