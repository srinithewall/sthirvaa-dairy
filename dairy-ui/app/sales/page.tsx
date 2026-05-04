'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, IndianRupee, Printer, Pencil, Trash2, Search, Filter } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';
import SaleModal from '@/components/SaleModal';

interface Sale {
  id: number;
  itemName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
  paymentStatus: string;
  customer?: {
    id: number;
    name: string;
  };
}

export default function SalesPage() {
  const { showToast, confirm } = useNotification();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales');
      setSales(res.data);
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch sales records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    confirm('Are you sure you want to delete this sales record?', async () => {
      try {
        await api.delete(`/sales/${id}`);
        showToast('Record deleted successfully', 'success');
        fetchSales();
      } catch (err) {
        showToast('Failed to delete record', 'error');
      }
    }, 'danger');
  };

  const filteredSales = sales.filter(s => 
    s.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalLiters = sales.filter(s => s.itemName?.toLowerCase().includes('milk')).reduce((acc, s) => acc + s.quantity, 0);
  const pendingAmount = sales.filter(s => s.paymentStatus !== 'PAID').reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Sales & Distribution</h1>
          <p className="text-[13px] text-text3 mt-1">Tracking revenue from Milk, Dung, and other products</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
            <input
              type="text"
              placeholder="Search records..."
              className="pl-9 pr-4 py-2 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setSelectedSale(null);
              setIsModalOpen(true);
            }}
            className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-md"
          >
            <Plus size={16} />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-brand-dark text-white p-5 rounded-radius-custom-lg shadow-lg relative overflow-hidden group">
          <IndianRupee size={40} className="absolute -right-2 -bottom-2 text-white/10 group-hover:scale-110 transition-transform" />
          <div className="text-[11px] opacity-70 uppercase font-bold tracking-wider mb-1">Total Revenue</div>
          <div className="text-2xl font-black">₹{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-radius-custom-lg border border-border-custom card-shadow relative overflow-hidden group">
          <div className="text-[11px] text-text3 uppercase font-bold tracking-wider mb-1">Liters Sold</div>
          <div className="text-2xl font-black text-brand">
             {totalLiters.toLocaleString()} L
          </div>
          <div className="absolute top-4 right-4 text-brand/10 group-hover:scale-110 transition-transform">
             <ShoppingBagIcon />
          </div>
        </div>
        <div className="bg-white p-5 rounded-radius-custom-lg border border-border-custom card-shadow">
          <div className="text-[11px] text-text3 uppercase font-bold tracking-wider mb-1">Pending Payments</div>
          <div className="text-2xl font-black text-danger">
            ₹{pendingAmount.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead className="bg-[#F5F9F6] text-text2 uppercase text-[11px] font-bold tracking-wider border-b border-border-custom">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Product</th>
                <th className="p-4 text-center">Qty</th>
                <th className="p-4 text-center">Rate</th>
                <th className="p-4 text-center">Amount</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-text3 italic">Fetching transactions...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-text3 italic">No sales records found.</td></tr>
              ) : filteredSales.map((sale) => (
                <tr key={sale.id} className="border-b border-border-custom hover:bg-surface2 transition-colors last:border-0">
                  <td className="p-4 text-text3">{sale.date}</td>
                  <td className="p-4 font-bold text-text">{sale.customer?.name || 'Walk-in'}</td>
                  <td className="p-4 font-bold text-text">{sale.itemName}</td>
                  <td className="p-4 text-center">{sale.quantity}</td>
                  <td className="p-4 text-center text-text2">₹{sale.price}</td>
                  <td className="p-4 text-center font-black text-brand-dark">₹{sale.totalAmount.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      sale.paymentStatus === 'PAID' ? 'bg-green-100 text-brand' : 'bg-amber-100 text-[#7a4e08]'
                    }`}>
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setSelectedSale(sale);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-text3 hover:text-brand transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(sale.id)}
                        className="p-1.5 text-text3 hover:text-danger transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchSales}
        sale={selectedSale}
      />
    </AppLayout>
  );
}

function ShoppingBagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
