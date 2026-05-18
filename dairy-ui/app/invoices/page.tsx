'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { FileText, ChevronRight, Loader2, Calendar } from 'lucide-react';
import api from '@/lib/api';

interface Invoice {
  id: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  paymentStatus: string;
}

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await api.get('/orders/invoices');
        setInvoices(res.data || []);
      } catch (e) {
        console.error(e);
        // Fallback for demonstration
        setInvoices([
          { id: 'INV-2026-000125', invoiceDate: '20 Apr 2026', dueDate: '05 May 2026', total: 2612.61, paymentStatus: 'UNPAID' },
          { id: 'INV-2026-000098', invoiceDate: '20 Mar 2026', dueDate: '05 Apr 2026', total: 2612.61, paymentStatus: 'PAID' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  return (
    <AppLayout>
      <div className="w-full max-w-5xl mx-auto flex flex-col font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B4332] tracking-tight">My Invoices</h1>
            <p className="text-[11px] font-bold text-[#C5A059] uppercase tracking-widest mt-0.5">Billing History & Receipts</p>
          </div>
        </div>
        
        {/* Main Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px]">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1B4332]" size={30} />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-[#F0F4F1] rounded-full flex items-center justify-center mb-3">
                <FileText size={28} className="text-[#1B4332]" />
              </div>
              <p className="text-gray-500 font-bold text-sm">No invoices found.</p>
              <p className="text-gray-400 text-xs mt-1">When you place an order, invoices will show up here.</p>
            </div>
          ) : (
            <div className="grid gap-3.5">
              {invoices.map((inv) => {
                const isPaid = inv.paymentStatus === 'PAID';
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-[#1B4332]/20 hover:bg-[#F9FBF9] transition-all gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <FileText size={18} className={isPaid ? 'text-green-600' : 'text-amber-600'} />
                      </div>
                      <div>
                        <h3 className="font-black text-[#1B4332] text-[14px] group-hover:underline group-hover:text-[#1B4332]/85">{inv.id}</h3>
                        <p className="text-[11px] text-gray-400 font-semibold mt-0.5 flex items-center gap-1">
                          <Calendar size={11} className="text-gray-300" /> Due: {inv.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                      <div className="text-left sm:text-right">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Amount</p>
                        <p className="font-black text-[#1B4332] text-[15px]">₹{inv.total?.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                          isPaid 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {inv.paymentStatus || 'UNPAID'}
                        </span>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#1B4332] transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
