'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import BottomNav from '@/components/BottomNav';
import { FileText, ChevronRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await api.get('/orders/invoices');
        setInvoices(res.data);
      } catch (e) {
        console.error(e);
        // Fallback for demo
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
    <div className="min-h-screen bg-[#F5F9F6] flex flex-col max-w-md mx-auto">
      <MobileHeader title="My Invoices" />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
           <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#1B4332]" size={30} /></div>
        ) : invoices.map((inv) => {
          const isPaid = inv.paymentStatus === 'PAID';
          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-green-50' : 'bg-amber-50'}`}>
                <FileText size={18} className={isPaid ? 'text-green-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#1B4332] text-[13px]">{inv.id}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Due: {inv.dueDate}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-[#1B4332] text-[14px]">₹{inv.total?.toFixed(2)}</p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {inv.paymentStatus || 'UNPAID'}
                </span>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </Link>
          );
        })}
        {!loading && invoices.length === 0 && (
          <p className="text-center text-gray-500 py-10 text-sm">No invoices found.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
