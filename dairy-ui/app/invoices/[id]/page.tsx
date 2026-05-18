'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { Download, User, Calendar, Clock, ShieldCheck, Phone, Mail, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const isUnpaid = status === 'UNPAID';
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
      isUnpaid
        ? 'text-amber-700 border-amber-300 bg-amber-50'
        : 'text-green-700 border-green-300 bg-green-50'
    }`}>
      {status}
    </span>
  );
}

export const runtime = 'edge';

export default function InvoicePage({ params }: { params: { id: string } }) {
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/orders/invoice/${params.id}`);
        setInv(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [params.id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="w-full max-w-3xl mx-auto flex flex-col font-sans min-h-[400px] justify-center items-center">
          <Loader2 className="animate-spin text-[#1B4332]" size={30} />
        </div>
      </AppLayout>
    );
  }

  if (!inv) {
    return (
      <AppLayout>
        <div className="w-full max-w-3xl mx-auto flex flex-col font-sans min-h-[400px] justify-center items-center text-center">
          <div className="text-gray-400 text-sm mb-3">Invoice not found.</div>
          <Link href="/invoices" className="text-[#1B4332] text-xs font-bold hover:underline">
            ← Back to Invoices
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isPaid = inv.paymentStatus === 'PAID';

  return (
    <AppLayout>
      <div className="w-full max-w-3xl mx-auto flex flex-col font-sans">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <Link href="/invoices" className="text-gray-500 hover:text-[#1B4332] transition-colors text-xs font-bold flex items-center gap-1">
            ← Back to Invoices
          </Link>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-[#1B4332] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#081C15] transition-all shadow-sm active:scale-95"
          >
            <Download size={14} /> Print / Save
          </button>
        </div>

        {/* Invoice Receipt Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          {/* Header Banner */}
          <div className="bg-[#1B4332]/5 px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#1B4332] rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">🌿</div>
              <div>
                <h2 className="font-black text-[#1B4332] text-lg leading-tight">Sthirvaa Farms</h2>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Pure. Fresh. Organic.</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Invoice ID</p>
              <h3 className="text-base font-black text-[#1B4332]">{inv.id}</h3>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Payment Status & Dates */}
            <div className="flex flex-wrap gap-6 items-center justify-between border-b border-gray-50 pb-5">
              <div className="flex gap-8">
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Invoice Date</p>
                  <p className="text-gray-800 font-black text-sm">{inv.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Due Date</p>
                  <p className="text-gray-800 font-black text-sm">{inv.dueDate}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 text-left sm:text-right">Payment Status</p>
                <StatusBadge status={inv.paymentStatus || 'UNPAID'} />
              </div>
            </div>

            {/* Bill To & Plan Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-50">
              <div>
                <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-wider mb-3.5">Bill To</p>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-[13px]">{inv.customer?.name}</p>
                    <p className="text-gray-500 text-[11px] mt-0.5">{inv.customer?.email}</p>
                    <p className="text-gray-500 text-[11px]">{inv.customer?.phone}</p>
                    <p className="text-gray-500 text-[11px] mt-1 leading-tight">{inv.customer?.address}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-wider mb-3.5">Plan Details</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">🥛</span>
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">Subscription</p>
                      <p className="text-gray-800 font-bold text-[12px] mt-0.5">Monthly Subscription</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">Billing Cycle</p>
                      <p className="text-gray-800 font-bold text-[12px] mt-0.5">Monthly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none">Delivery Window</p>
                      <p className="text-gray-800 font-bold text-[12px] mt-0.5">6:00 AM – 8:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Summary Table */}
            <div>
              <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-wider mb-3">Invoice Summary</p>
              
              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide">Item</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide text-center">Qty</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide text-right">Price (₹)</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wide text-right">Amount (₹)</p>
                </div>

                <div className="divide-y divide-gray-50">
                  {inv.items?.map((item: any, i: number) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_80px_100px] gap-2 px-4 py-3.5 items-center">
                      <div>
                        <p className="text-[12px] font-black text-gray-800 leading-tight">{item.name}</p>
                        <p className="text-[9px] text-gray-400 font-medium leading-none mt-1">{item.description}</p>
                      </div>
                      <p className="text-[12px] text-gray-600 font-bold text-center">{item.qty}</p>
                      <p className="text-[12px] text-gray-600 font-medium text-right">₹{item.price?.toFixed(2)}</p>
                      <p className="text-[12px] text-gray-800 font-black text-right">₹{item.amount?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 bg-[#F9FBF9]/40 divide-y divide-gray-50 px-4">
                  <div className="flex items-center justify-between py-2.5">
                    <p className="text-[11px] text-gray-500 font-semibold">Subtotal</p>
                    <p className="text-[11px] text-gray-800 font-bold">₹{inv.subtotal?.toFixed(2)}</p>
                  </div>
                  {inv.discount > 0 && (
                    <div className="flex items-center justify-between py-2.5">
                      <p className="text-[11px] text-gray-500 font-semibold">Discount</p>
                      <p className="text-[11px] text-red-500 font-bold">-{inv.discount?.toFixed(2)}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <p className="text-[11px] text-gray-500 font-semibold">Gateway Fee</p>
                    <p className="text-[11px] text-gray-800 font-bold">₹{inv.gatewayFee?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <p className="text-[12px] font-black text-[#1B4332] uppercase tracking-wide">Total Amount</p>
                    <p className="text-[16px] font-black text-[#1B4332]">₹ {inv.total?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pay Now Button */}
            {!isPaid && (
              <div className="pt-2">
                <Link
                  href="/checkout"
                  className="w-full py-4 bg-[#1B4332] text-white rounded-xl font-black text-[12px] uppercase tracking-[0.15em] shadow-lg hover:bg-[#081C15] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={16} /> Pay ₹ {inv.total?.toFixed(2)} Now
                </Link>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
              ⓘ This is a computer generated invoice and does not require a signature.
            </p>
            <div className="flex items-center gap-4">
              <a href="mailto:support@sthirvaafarms.com" className="text-[10px] text-[#1B4332] font-semibold hover:underline">
                support@sthirvaafarms.com
              </a>
              <a href="tel:+919876543210" className="text-[10px] text-[#1B4332] font-semibold hover:underline">
                +91 98765 43210
              </a>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
