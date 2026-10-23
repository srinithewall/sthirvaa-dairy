'use client';

import React, { useEffect, useState, Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Plus, History, X, FolderPlus, Edit2, Trash2, ChevronDown, Layers, Bell } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';

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
  herdId?: number;
  paidBy?: string;
  settled?: boolean;
  settledAt?: string | null;
  settledBy?: string | null;
  segment?: string | null;
}

type Segment = 'CATTLE' | 'POULTRY';
const POULTRY_TYPES = ['CHICKEN', 'DUCK', 'FISH', 'QUAIL'];

function LedgerPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [collapsedTabs, setCollapsedTabs] = useState<Record<string, boolean>>({});
  const categoriesCollapsed = collapsedTabs[activeTab] ?? true;
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try { setIsAdmin(JSON.parse(localStorage.getItem('user') || '{}').role === 'ADMIN'); } catch {}
  }, []);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [herds, setHerds] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // Selection & Form State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedHerdId, setSelectedHerdId] = useState<string>('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // New Category State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📂');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Edit / Delete State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { showToast, confirm } = useNotification();

  // Filters State
  // Month filter opens on the current month for both expenses and income.
  const currentMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPaidBy, setFilterPaidBy] = useState<string>('ALL');
  const [settling, setSettling] = useState(false);
  // Which side of the farm to show: cattle (default), poultry and fish, or everything.
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'ALL'>('CATTLE');
  // Side an entry being added or edited belongs to.
  const [entrySegment, setEntrySegment] = useState<Segment>('CATTLE');
  // A new entry starts on the side being viewed (All starts on cattle).
  useEffect(() => {
    if (selectedCategory) setEntrySegment(segmentFilter === 'POULTRY' ? 'POULTRY' : 'CATTLE');
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');

  useEffect(() => {
    if (typeParam === 'EXPENSE' || typeParam === 'INCOME') {
      setActiveTab(typeParam as 'EXPENSE' | 'INCOME');
    }
  }, [typeParam]);

  useEffect(() => {
    setFilterCategory('ALL');
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const responses = await Promise.allSettled([
        api.get('/categories'),
        api.get('/expenses'),
        api.get('/income'),
        api.get('/herds'),
        api.get('/staff')
      ]);
      
      const catRes = responses[0].status === 'fulfilled' ? responses[0].value.data : [];
      const expRes = responses[1].status === 'fulfilled' ? responses[1].value.data : [];
      const incRes = responses[2].status === 'fulfilled' ? responses[2].value.data : [];
      const herdRes = responses[3].status === 'fulfilled' ? (responses[3].value.data.herds || responses[3].value.data) : [];
      const staffRes = responses[4].status === 'fulfilled' ? responses[4].value.data : [];

      setCategories(catRes);
      setHerds(Array.isArray(herdRes) ? herdRes : []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
      
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

  const poultryHerdIds = new Set(herds.filter(h => POULTRY_TYPES.includes(h.animalType)).map(h => h.id));
  const segmentOf = (h: Transaction): Segment =>
    h.segment === 'POULTRY' || h.segment === 'CATTLE' ? h.segment
      : (h.category === 'Poultry' || (h.herdId != null && poultryHerdIds.has(h.herdId)) ? 'POULTRY' : 'CATTLE');
  const inSegment = (h: Transaction) => segmentFilter === 'ALL' || segmentOf(h) === segmentFilter;

  const filteredHistory = history.filter(h => {
    let matches = inSegment(h);
    if (filterCategory !== 'ALL' && h.category !== filterCategory) {
      matches = false;
    }
    if (filterMonth !== 'ALL') {
      const entryMonth = h.date.substring(0, 7); // YYYY-MM
      if (entryMonth !== filterMonth) {
        matches = false;
      }
    }
    if (filterPaidBy === 'UNSETTLED') {
      if (h.type !== 'EXPENSE' || !h.paidBy || h.settled) matches = false;
    } else if (filterPaidBy === 'SETTLED') {
      if (h.type !== 'EXPENSE' || !h.paidBy || !h.settled) matches = false;
    } else if (filterPaidBy !== 'ALL' && h.paidBy !== filterPaidBy) {
      matches = false;
    }
    return matches;
  });

  const totalExpense = filteredHistory.filter(h => h.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0);
  const totalIncome = filteredHistory.filter(h => h.type === 'INCOME').reduce((a, b) => a + b.amount, 0);
  const balance = totalIncome - totalExpense;

  // Paid-by summary (respects the month filter, independent of the category filter)
  const paidByEntries = history.filter(h =>
    h.type === 'EXPENSE' && inSegment(h) &&
    h.paidBy === filterPaidBy &&
    (filterMonth === 'ALL' || h.date.substring(0, 7) === filterMonth)
  );
  const paidByTotal = paidByEntries.reduce((a, b) => a + b.amount, 0);
  const paidByUnsettled = paidByEntries.filter(h => !h.settled);
  const paidByUnsettledTotal = paidByUnsettled.reduce((a, b) => a + b.amount, 0);

  // Everyone still owed money (respects the month and cattle/poultry filters), most owed first.
  const unsettledByPerson = Object.entries(
    history.filter(h => h.type === 'EXPENSE' && h.paidBy && !h.settled && inSegment(h)
      && (filterMonth === 'ALL' || h.date.substring(0, 7) === filterMonth))
      .reduce((m: Record<string, number>, h) => { m[h.paidBy!] = (m[h.paidBy!] || 0) + h.amount; return m; }, {})
  ).sort((a, b) => b[1] - a[1]);

  const settledByPerson = Object.entries(
    history.filter(h => h.type === 'EXPENSE' && h.paidBy && h.settled && inSegment(h)
      && (filterMonth === 'ALL' || h.date.substring(0, 7) === filterMonth))
      .reduce((m: Record<string, number>, h) => { m[h.paidBy!] = (m[h.paidBy!] || 0) + h.amount; return m; }, {})
  ).sort((a, b) => b[1] - a[1]);

  // Staff-paid expenses must be settled by the 15th of the following month.
  const [showReminders, setShowReminders] = useState(false);
  const overdueReminders = (() => {
    const today = new Date();
    const groups: Record<string, { person: string; month: string; total: number }> = {};
    history.forEach(h => {
      if (h.type !== 'EXPENSE' || !h.paidBy || h.settled) return;
      const month = h.date.substring(0, 7);
      const key = `${h.paidBy}|${month}`;
      groups[key] = groups[key] || { person: h.paidBy, month, total: 0 };
      groups[key].total += h.amount;
    });
    return Object.values(groups).map(g => {
      const [y, m] = g.month.split('-').map(Number);
      const due = new Date(y, m, 15); // month index m = following month
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      return { ...g, due, daysOverdue };
    }).filter(g => g.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
  })();
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const shortMonth = (ym: string) => `${SHORT_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const monthName = (ym: string) => new Date(ym + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleSettle = async (person: string = filterPaidBy) => {
    if (person === 'ALL' || person === 'UNSETTLED') return;
    const owed = person === filterPaidBy ? paidByUnsettledTotal
      : (unsettledByPerson.find(([name]) => name === person)?.[1] || 0);
    if (owed <= 0) return;
    setSettling(true);
    try {
      await api.patch('/expenses/settle', null, { params: { paidBy: person, month: filterMonth } });
      showToast(`₹${Math.round(owed).toLocaleString('en-IN')} settled to ${person}!`);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to settle amount.", 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedCategory || !amount) return;
    setSaving(true);
    try {
      const type = selectedCategory.type;
      const endpoint = type === 'EXPENSE' ? '/expenses' : '/income';
      const payload: any = {
        category: selectedCategory.name,
        amount: parseFloat(amount),
        description: description || `Payment for ${selectedCategory.name}`,
        date: date,
        segment: entrySegment,
      };
      if (selectedHerdId && selectedHerdId !== 'ALL' && selectedCategory.name.toUpperCase().includes('MEDICAL')) {
        payload.herdId = parseInt(selectedHerdId);
      }
      if (type === 'EXPENSE' && paidBy) {
        payload.paidBy = paidBy;
      }
      await api.post(endpoint, payload);
      
      showToast(`${type.charAt(0) + type.slice(1).toLowerCase()} added successfully!`);
      setSelectedCategory(null);
      setAmount('');
      setDescription('');
      setSelectedHerdId('');
      setPaidBy('');
      setDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to save entry.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingTransaction || !amount) return;
    setSaving(true);
    try {
      const type = editingTransaction.type;
      const endpoint = type === 'EXPENSE' ? `/expenses/${editingTransaction.id}` : `/income/${editingTransaction.id}`;
      const payload: any = {
        category: editingTransaction.category,
        amount: parseFloat(amount),
        description: description,
        date: date,
        segment: entrySegment,
        paidBy: (editingTransaction as any).paidBy,
        settled: (editingTransaction as any).settled,
      };
      if (selectedHerdId && selectedHerdId !== 'ALL' && editingTransaction.category.toUpperCase().includes('MEDICAL')) {
        payload.herdId = parseInt(selectedHerdId);
      }
      if (type === 'EXPENSE' && paidBy) {
        payload.paidBy = paidBy;
      }
      await api.put(endpoint, payload);
      
      showToast(`${type.charAt(0) + type.slice(1).toLowerCase()} updated successfully!`);
      setEditingTransaction(null);
      setAmount('');
      setDescription('');
      setSelectedHerdId('');
      setPaidBy('');
      setDate(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to update entry.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    confirm(`Delete category "${cat.name}"? Existing records keep their category name.`, async () => {
      try {
        await api.delete(`/categories/${cat.id}`);
        showToast(`Category "${cat.name}" deleted.`);
        fetchData();
      } catch (err: any) {
        showToast(err.response?.data?.message || "Failed to delete category.", 'error');
      }
    }, 'danger');
  };

  const handleDeleteTransaction = async (id: number, type: 'EXPENSE' | 'INCOME') => {
    confirm("Are you sure you want to delete this record?", async () => {
      try {
        const endpoint = type === 'EXPENSE' ? `/expenses/${id}` : `/income/${id}`;
        await api.delete(endpoint);
        showToast(`${type.charAt(0) + type.slice(1).toLowerCase()} deleted successfully!`);
        fetchData();
      } catch (err: any) {
        showToast(err.response?.data?.message || "Failed to delete.", 'error');
      }
    }, 'danger');
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
      showToast(`Category "${newCatName}" created successfully!`);
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatIcon('📂');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to create category.", 'error');
    } finally {
      setCreatingCategory(false);
    }
  };

  const filteredCategories = categories
    .filter(c => c.type === activeTab)
    .sort((a, b) => a.name.localeCompare(b.name));

  const uniqueMonths = Array.from(new Set([currentMonth, ...history.map(h => h.date.substring(0, 7))])).sort().reverse();
  const currentTabCategories = categories.filter(c => c.type === activeTab).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pb-10 px-1">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="relative">
            <h1 className="text-2xl font-black text-text tracking-tight uppercase flex items-center gap-3">
              Digital Ledger
              {overdueReminders.length > 0 && (
                <button type="button" onClick={() => setShowReminders(v => !v)}
                  aria-label={`${overdueReminders.length} overdue staff payments`} title="Overdue staff payments"
                  className="relative p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100">
                  <Bell size={18} />
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-black leading-4 text-center">
                    {overdueReminders.length}
                  </span>
                </button>
              )}
            </h1>
            {showReminders && overdueReminders.length > 0 && (
              <>
                <div className="fixed inset-0 z-[40]" onClick={() => setShowReminders(false)} />
                <div className="absolute left-0 top-full mt-2 z-[50] w-[min(92vw,380px)] bg-white border border-border-custom rounded-xl shadow-2xl">
                  <div className="px-4 py-2.5 border-b border-border-custom text-[11px] font-black text-text3 uppercase tracking-wider">
                    Overdue staff payments
                  </div>
                  <ul className="max-h-80 overflow-auto divide-y divide-border-custom">
                    {overdueReminders.map(r => (
                      <li key={`${r.person}-${r.month}`}>
                        <button type="button" className="w-full text-left px-4 py-3 hover:bg-surface2"
                          onClick={() => { setActiveTab('EXPENSE'); setSegmentFilter('ALL'); setFilterPaidBy(r.person); setFilterMonth(r.month); setShowReminders(false);
                            setTimeout(() => document.getElementById('settle-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}>
                          <p className="text-sm font-bold text-text normal-case tracking-normal">
                            ₹{Math.round(r.total).toLocaleString('en-IN')} unsettled for {r.person} for {shortMonth(r.month)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <p className="text-[13px] text-text3 mt-1 font-medium">Sthirvaa Farms · Financial Entries</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="bg-white p-1 rounded-xl border border-border-custom flex shadow-sm" role="group" aria-label="Cattle, all or poultry">
            {([['CATTLE', 'C', 'Cattle'], ['ALL', 'All', 'Cattle and poultry'], ['POULTRY', 'P', 'Poultry and fish']] as const).map(([v, label, title]) => (
              <button key={v} type="button" title={title} aria-label={title} onClick={() => setSegmentFilter(v)}
                className={`flex-1 sm:flex-none min-w-[44px] px-3 py-2.5 inline-flex items-center justify-center rounded-lg transition-all text-[12px] font-black tracking-widest ${segmentFilter === v ? 'bg-[#1b4332] text-white' : 'text-text3'}`}>
                {v === 'ALL' ? <Layers size={16} /> : label}
              </button>
            ))}
          </div>
          <div className="bg-white p-1 rounded-xl border border-border-custom flex shadow-sm w-full sm:w-auto">
            <button 
              onClick={() => setActiveTab('EXPENSE')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg transition-all text-[12px] font-black tracking-widest ${activeTab === 'EXPENSE' ? 'bg-danger text-white' : 'text-text3'}`}
            >
              EXPENSE
            </button>
            <button 
              onClick={() => setActiveTab('INCOME')}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg transition-all text-[12px] font-black tracking-widest ${activeTab === 'INCOME' ? 'bg-brand text-white' : 'text-text3'}`}
            >
              INCOME
            </button>
          </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white px-4 py-3 rounded-radius-custom-lg border border-border-custom shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[10px] font-black text-text3 uppercase tracking-[0.2em]">Net Balance</span>
             <span className={`text-2xl font-black ${balance >= 0 ? 'text-brand' : 'text-danger'}`}>
               {balance < 0 ? "−" : ""}₹{Math.abs(balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
             </span>
          </div>
          <div className="bg-danger/5 border border-danger/10 px-4 py-3 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[10px] font-black text-danger uppercase tracking-[0.2em]">Total Expense</span>
             <span className="text-2xl font-black text-danger">₹{totalExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="bg-brand/5 border border-brand/10 px-4 py-3 rounded-radius-custom-lg shadow-sm flex flex-col items-center justify-center gap-1 text-center">
             <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Total Income</span>
             <span className="text-2xl font-black text-brand">₹{totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white p-4 rounded-radius-custom-lg border border-border-custom shadow-sm mb-4 flex flex-col sm:flex-row items-center gap-4">
          <div className={`w-full ${activeTab === 'EXPENSE' ? 'sm:w-1/3' : 'sm:w-1/2'}`}>
            <label className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-surface2 border border-border-custom text-text text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="ALL">All Time</option>
              {uniqueMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
          <div className={`w-full ${activeTab === 'EXPENSE' ? 'sm:w-1/3' : 'sm:w-1/2'}`}>
            <label className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-surface2 border border-border-custom text-text text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="ALL">All Categories</option>
              {currentTabCategories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          {activeTab === 'EXPENSE' && (
            <div className="w-full sm:w-1/3">
              <label className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">Paid By</label>
              <select
                value={filterPaidBy}
                onChange={(e) => setFilterPaidBy(e.target.value)}
                className="w-full bg-surface2 border border-border-custom text-text text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="ALL">Select</option>
                <option value="UNSETTLED">All (unsettled)</option>
                <option value="SETTLED">All (settled)</option>
                {[...staffList].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((staff: any) => (
                  <option key={staff.id} value={staff.name}>{staff.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Paid By Settlement Summary */}
        {/* Everyone still owed money */}
        {activeTab === 'EXPENSE' && filterPaidBy === 'UNSETTLED' && (
          <div className="bg-amber-400/10 border border-amber-400/30 p-4 sm:p-5 rounded-radius-custom-lg shadow-sm mb-8">
            <div className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-2">
              Unsettled staff payments {filterMonth !== 'ALL' && `· ${monthName(filterMonth)}`}
            </div>
            {unsettledByPerson.length === 0 ? (
              <p className="text-sm font-bold text-amber-700">Everyone is settled.</p>
            ) : (
              <ul className="divide-y divide-amber-400/20">
                {unsettledByPerson.map(([person, total]) => (
                  <li key={person} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-bold text-text">{person}</span>
                    <span className="ml-auto text-lg font-black text-amber-700">₹{Math.round(total).toLocaleString('en-IN')}</span>
                    <button disabled={settling} onClick={() => handleSettle(person)}
                      className="px-3 py-1.5 rounded-lg font-black text-[11px] text-white bg-amber-600 disabled:opacity-40">
                      MARK SETTLED
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Settled staff payments */}
        {activeTab === 'EXPENSE' && filterPaidBy === 'SETTLED' && (
          <div className="bg-brand/5 border border-brand/15 p-4 sm:p-5 rounded-radius-custom-lg shadow-sm mb-8">
            <div className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-2">
              Settled staff payments {filterMonth !== 'ALL' && `· ${monthName(filterMonth)}`}
            </div>
            {settledByPerson.length === 0 ? (
              <p className="text-sm font-bold text-text3">Nothing settled in this period.</p>
            ) : (
              <ul className="divide-y divide-brand/10">
                {settledByPerson.map(([person, total]) => (
                  <li key={person} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-bold text-text">{person}</span>
                    <span className="text-lg font-black text-brand">₹{Math.round(total).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'EXPENSE' && filterPaidBy !== 'ALL' && filterPaidBy !== 'UNSETTLED' && filterPaidBy !== 'SETTLED' && (
          <div id="settle-panel" className="scroll-mt-4 bg-amber-400/10 border border-amber-400/30 p-4 sm:p-5 rounded-radius-custom-lg shadow-sm mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">
                Paid by {filterPaidBy} {filterMonth !== 'ALL' && `· ${new Date(filterMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1">
                ₹{paidByTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {paidByUnsettledTotal !== paidByTotal && (
                  <span className="text-sm font-bold text-amber-600 ml-2">
                    (₹{paidByUnsettledTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} unsettled)
                  </span>
                )}
              </div>
            </div>
            <button
              disabled={settling || paidByUnsettled.length === 0}
              onClick={() => handleSettle()}
              className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-radius-custom-lg font-black text-[11px] sm:text-xs tracking-wide text-white bg-amber-600 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {settling ? 'SETTLING...' : paidByUnsettled.length === 0 ? 'ALL SETTLED' : (
                <>MARK SETTLED <span className="hidden sm:inline">TO {filterPaidBy.toUpperCase()}</span></>
              )}
            </button>
          </div>
        )}

        {/* Category Selection Section */}
        <div className="mb-4 flex items-center justify-between px-1">
          <button
            onClick={() => setCollapsedTabs(p => ({ ...p, [activeTab]: !(p[activeTab] ?? true) }))}
            className="flex items-center gap-1.5 text-[12px] font-black text-text2 uppercase tracking-widest hover:text-text"
          >
            Select Category
            <ChevronDown size={16} className={`transition-transform ${categoriesCollapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
        
        {!categoriesCollapsed && <div className="bg-white p-4 sm:p-8 rounded-radius-custom-lg border border-border-custom card-shadow mb-8 relative overflow-hidden">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-y-8 sm:gap-y-10 gap-x-2 sm:gap-x-4 relative z-10">
            {filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => setSelectedCategory(cat)}
                className="relative flex flex-col items-center gap-2 sm:gap-3 group cursor-pointer"
              >
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                    title="Delete category"
                    className="absolute -top-2 right-0 sm:right-2 z-20 w-6 h-6 rounded-full bg-white border border-border-custom text-danger flex items-center justify-center shadow opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-danger hover:text-white"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] flex items-center justify-center text-xl sm:text-2xl shadow-md sm:shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl ${activeTab === 'EXPENSE' ? 'bg-danger/10 text-danger border border-danger/20 group-hover:bg-danger group-hover:text-white' : 'bg-brand/10 text-brand border border-brand/20 group-hover:bg-brand group-hover:text-white'}`}>
                  {cat.iconCode || cat.icon || cat.name.charAt(0)}
                </div>
                <span className="text-[11px] sm:text-[12px] font-black text-text2 text-center leading-tight">{cat.name}</span>
              </div>
            ))}
            <div 
              onClick={() => setShowCategoryModal(true)}
              className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[20px] bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 group-hover:bg-slate-800 group-hover:text-white transition-all shadow-sm group-hover:-translate-y-1">
                <Plus size={24} />
              </div>
              <span className="text-[11px] sm:text-[12px] font-black text-slate-500 uppercase tracking-tighter text-center">Add New<br/>Category</span>
            </div>
          </div>
        </div>}

        {/* Recent Transactions List */}
        <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
          <div className="p-4 sm:p-5 border-b border-border-custom bg-surface2/50 flex items-center justify-between">
            <h3 className="text-[13px] font-black flex items-center gap-2 text-text uppercase tracking-widest">
              <History size={16} className="text-brand" /> Recent Transactions
            </h3>
          </div>
          
          <div className="divide-y divide-border-custom bg-white">
            {loading ? (
              <div className="p-10 sm:p-20 text-center">
                 <div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin"></div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-10 sm:p-20 text-center text-text3 font-bold">NO TRANSACTIONS YET</div>
            ) : filteredHistory.filter(item => item.type === activeTab).map((item) => {
              const isHighlighted = filterPaidBy !== 'ALL' && filterPaidBy !== 'SETTLED' && !item.settled && (filterPaidBy === 'UNSETTLED' ? !!item.paidBy : item.paidBy === filterPaidBy);
              return (
              <div key={`${item.type}-${item.id}`} className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-surface transition-all group border-l-4 gap-4 sm:gap-0 ${isHighlighted ? 'bg-amber-400/10 border-amber-400' : 'border-transparent hover:border-brand'}`}>
                <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm ${item.type === 'EXPENSE' ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand'}`}>
                    {categories.find(c => c.name === item.category)?.iconCode || item.category.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-text text-[14px] sm:text-[15px]">{item.category}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-black bg-surface2 px-1.5 py-0.5 rounded text-text2 flex-shrink-0">{item.date}</span>
                      <span className="text-[11px] sm:text-[12px] text-text3 font-medium truncate sm:line-clamp-1 max-w-[150px] sm:max-w-none">
                        {item.description}
                        {item.paidBy && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${item.settled ? 'bg-brand/10 text-brand' : 'bg-surface2 text-text2'}`}>
                            {item.settled ? '✓ Settled · ' : 'Paid by: '}{item.paidBy}
                            {item.settled && item.settledAt && ` · ${new Date(item.settledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
                            {item.settled && item.settledBy && ` by ${item.settledBy}`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-1 sm:mt-0">
                  <div className="text-left sm:text-right">
                    <div className={`font-black text-[16px] sm:text-[18px] ${item.type === 'EXPENSE' ? 'text-danger' : 'text-brand'}`}>
                      {item.type === 'EXPENSE' ? '-' : '+'} ₹{item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingTransaction(item);
                        setAmount(item.amount.toString());
                        setDescription(item.description);
                        setDate(item.date);
                        setSelectedHerdId(item.herdId ? item.herdId.toString() : 'ALL');
                        setPaidBy((item as any).paidBy || '');
                        setEntrySegment(segmentOf(item));
                      }}
                      className="p-2 bg-surface2 sm:bg-transparent hover:bg-white rounded-lg text-text3 hover:text-brand transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteTransaction(item.id, item.type)}
                      className="p-2 bg-surface2 sm:bg-transparent hover:bg-white rounded-lg text-text3 hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Entry Modal */}
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
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">For</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['CATTLE', 'Cattle'], ['POULTRY', 'Poultry / fish']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setEntrySegment(v)}
                      className={`py-2.5 rounded-xl border text-[12px] font-bold ${entrySegment === v ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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

              {((selectedCategory?.name || editingTransaction?.category)?.toUpperCase().includes('MEDICAL')) && (
                <div className="mb-6">
                  <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Select Animal (Optional)</label>
                  <select
                    value={selectedHerdId}
                    onChange={(e) => setSelectedHerdId(e.target.value)}
                    className="w-full text-sm text-text border-b border-border-custom outline-none py-1 bg-white"
                  >
                    <option value="ALL">All (Farm Level)</option>
                    {herds.map((herd: any) => (
                      <option key={herd.id} value={herd.id.toString()}>
                        {herd.animalName ? `${herd.animalName} (${herd.tagNumber})` : herd.tagNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {((selectedCategory?.type || editingTransaction?.type) === 'EXPENSE') && (
                <div className="mb-6">
                  <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Paid By (Optional)</label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    className="w-full text-sm text-text border-b border-border-custom outline-none py-1 bg-white"
                  >
                    <option value="">Select Staff...</option>
                    {staffList.map((staff: any) => (
                      <option key={staff.id} value={staff.name}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

      {/* New Category Modal */}
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
