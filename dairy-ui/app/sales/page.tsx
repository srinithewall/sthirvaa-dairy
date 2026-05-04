'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, IndianRupee, Printer } from 'lucide-react';

interface Sale {
  id: number;
  itemName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
  paymentStatus: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const res = await api.get('/sales');
      setSales(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Sales & Distribution</h1>
          <p className="text-[13px] text-text3 mt-1">Tracking revenue from Milk, Dung, and other products</p>
        </div>
        <button className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm">
          <Plus size={16} />
          <span>New Sale</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-brand-dark text-white p-4 rounded-radius-custom-lg shadow-lg">
          <div className="text-[11px] opacity-70 uppercase font-bold tracking-wider mb-1">Total Revenue</div>
          <div className="text-2xl font-black">₹{sales.reduce((acc, s) => acc + s.totalAmount, 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-radius-custom-lg border border-border-custom card-shadow">
          <div className="text-[11px] text-text3 uppercase font-bold tracking-wider mb-1">Liters Sold</div>
          <div className="text-2xl font-black text-brand">
             {sales.filter(s => s.itemName?.toLowerCase().includes('milk')).reduce((acc, s) => acc + s.quantity, 0)} L
          </div>
        </div>
        <div className="bg-white p-4 rounded-radius-custom-lg border border-border-custom card-shadow">
          <div className="text-[11px] text-text3 uppercase font-bold tracking-wider mb-1">Pending Payments</div>
          <div className="text-2xl font-black text-danger">
            ₹{sales.filter(s => s.paymentStatus !== 'PAID').reduce((acc, s) => acc + s.totalAmount, 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[#F5F9F6] text-text2 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Product</th>
                <th className="p-4">Qty</th>
                <th className="p-4">Rate</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-text3">Fetching transactions...</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border-custom hover:bg-surface2 transition-colors last:border-0">
                  <td className="p-4 text-text3">{sale.date}</td>
                  <td className="p-4 font-bold text-text">{sale.itemName}</td>
                  <td className="p-4">{sale.quantity}</td>
                  <td className="p-4 text-text2">₹{sale.price}</td>
                  <td className="p-4 font-black text-brand-dark">₹{sale.totalAmount.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`status ${sale.paymentStatus === 'PAID' ? 'status-green' : 'status-amber'}`}>
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="bg-surface2 p-1.5 rounded-md text-text3 hover:text-brand transition-all">
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
