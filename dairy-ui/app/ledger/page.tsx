'use client';

import React, { useEffect, useState, Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Plus, History, X, FolderPlus, Edit2, Trash2 } from 'lucide-react';

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

function LedgerPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection & Form State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // New Category State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📂');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Edit / Delete State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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
        date: date
      });
      
      setSelectedCategory(null);
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingTransaction || !amount) return;
    setSaving(true);
    try {
      const endpoint = editingTransaction.type === 'EXPENSE' ? `/expenses/${editingTransaction.id}` : `/income/${editingTransaction.id}`;
      await api.put(endpoint, {
        category: editingTransaction.category,
        amount: parseFloat(amount),
        description: description,
        date: date
      });
      
      setEditingTransaction(null);
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: number, type: 'EXPENSE' | 'INCOME') => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const endpoint = type === 'EXPENSE' ? `/expenses/${id}` : `/income/${id}`;
      await api.delete(endpoint);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete.");
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
      alert(err.response?.data?.message || "Failed to create category.");
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-radius-custom-lg border border-border-custom shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[11px] font-bold text-text3 uppercase tracking-widest">Initial Balance</span>
             <span className="text-2xl font-black text-text">₹0.00</span>
          </div>
          <div className="bg-danger/5 border border-danger/10 p-6 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[11px] font-bold text-danger uppercase tracking-widest">Total Expense</span>
             <span className="text-2xl font-black text-danger">₹{history.filter(h => h.type === 'EXPENSE').reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
          </div>
          <div className="bg-brand/5 border border-brand/10 p-6 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[11px] font-bold text-brand uppercase tracking-widest">Total Income</span>
             <span className="text-2xl font-black text-brand">₹{history.filter(h => h.type === 'INCOME').reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-[14px] font-bold text-text2 uppercase tracking-wide">Select Category</h2>
        </div>
        
        <div className="bg-white p-8 rounded-radius-custom-lg border border-border-custom card-shadow mb-8 relative overflow-hidden">
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

        <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
          <div className="p-5 border-b border-border-custom bg-surface2/50 flex items-center justify-between">
            <h3 className="text-[15px] font-black flex items-center gap-2 text-text">
              <History size={18} className="text-brand" /> RECENT TRANSACTIONS
            </h3>
          </div>
          
          <div className="divide-y divide-border-custom bg-white">
            {loading ? (
              <div className="p-20 text-center">
                 <div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="p-20 text-center text-text3 font-bold">NO TRANSACTIONS YET</div>
            ) : history.map((item) => (
              <div key={`${item.type}-${item.id}`} className="p-5 flex items-center justify-between hover:bg-surface transition-all group border-l-4 border-transparent hover:border-brand">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm ${item.type === 'EXPENSE' ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand'}`}>
                    {categories.find(c => c.name === item.category)?.iconCode || item.category.charAt(0)}
                  </div>
                  <div>
                    <div className="font-black text-text text-[15px]">{item.category}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-bold bg-surface2 px-2 py-0.5 rounded text-text2">{item.date}</span>
                      <span className="text-[12px] text-text3 font-medium line-clamp-1">{item.description}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className={`font-black text-[18px] ${item.type === 'EXPENSE' ? 'text-danger' : 'text-brand'}`}>
                      {item.type === 'EXPENSE' ? '-' : '+'} ₹{item.amount.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingTransaction(item);
                        setAmount(item.amount.toString());
                        setDescription(item.description);
                        setDate(item.date);
                      }}
                      className="p-2 hover:bg-white rounded-lg text-text3 hover:text-brand transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTransaction(item.id, item.type)}
                      className="p-2 hover:bg-white rounded-lg text-text3 hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(selectedCategory || editingTransaction) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl">
            <div className={`p-6 text-center text-white flex flex-col items-center gap-2 ${ (selectedCategory?.type || editingTransaction?.type) === 'EXPENSE' ? 'bg-danger' : 'bg-brand'}`}>
              <div className="w-full flex justify-end mb-[-24px]">
                <button onClick={() => { setSelectedCategory(null); setEditingTransaction(null); }} className="text-white/80 hover:text-white"><X size={24}/></button>
              </div>
              <div className="text-xl font-extrabold uppercase tracking-widest">
                {editingTransaction ? 'Edit Record' : selectedCategory?.name}
              </div>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Transaction Date</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm font-bold text-text border-b border-border-custom outline-none py-1"
                />
              </div>

              <div className="mb-6">
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Amount (₹)</label>
                <input 
                  autoFocus
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-3xl font-black text-text border-b border-border-custom outline-none"
                />
              </div>

              <div className="mb-8">
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Note (Optional)</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm text-text2 border-b border-border-custom outline-none"
                />
              </div>

              <button 
                disabled={saving || !amount}
                onClick={editingTransaction ? handleUpdateEntry : handleSaveEntry}
                className={`w-full py-4 rounded-radius-custom-lg font-black text-lg text-white shadow-lg ${(selectedCategory?.type || editingTransaction?.type) === 'EXPENSE' ? 'bg-danger' : 'bg-brand'}`}
              >
                {saving ? 'SAVING...' : 'SAVE RECORD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl">
            <div className={`p-6 text-center text-white bg-brand`}>
               <div className="w-full flex justify-end mb-[-24px]">
                <button onClick={() => setShowCategoryModal(false)} className="text-white/80 hover:text-white"><X size={24}/></button>
              </div>
              <FolderPlus size={32} className="mx-auto mb-2" />
              <div className="text-xl font-extrabold uppercase">New Category</div>
            </div>
            <div className="p-8">
              <input 
                type="text" 
                placeholder="Category Name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full text-lg border-b border-border-custom outline-none mb-6"
              />
              <button 
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCatName}
                className="w-full py-4 bg-brand text-white rounded-lg font-black"
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

export default function LedgerPageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading Ledger...</div>}>
      <LedgerPage />
    </Suspense>
  );
}
