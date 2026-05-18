'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MobileHeader from '@/components/MobileHeader';
import BottomNav from '@/components/BottomNav';
import { Download, User, Calendar, Clock, ShieldCheck, Phone, Mail, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const isUnpaid = status === 'UNPAID';
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
      isUnpaid
        ? 'text-[#1B4332] border-[#1B4332] bg-transparent'
        : 'text-green-700 border-green-500 bg-green-50'
    }`}>
      {status}
    </span>
  );
}

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
      <div className="min-h-screen bg-[#F5F9F6] flex flex-col max-w-md mx-auto">
        <MobileHeader title="Invoice" />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin text-[#1B4332]" size={30} />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="min-h-screen bg-[#F5F9F6] flex flex-col max-w-md mx-auto">
        <MobileHeader title="Invoice" />
        <div className="flex-1 flex justify-center items-center text-sm text-gray-500">
          Invoice not found.
        </div>
        <BottomNav />
      </div>
    );
  }

  const isPaid = inv.paymentStatus === 'PAID';

  return (
    <div className="min-h-screen bg-[#F5F9F6] flex flex-col max-w-md mx-auto">
      <MobileHeader
        title="Invoice"
        rightAction={
          <button className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/10 rounded-full transition-colors">
            <Download size={18} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-[#1B4332] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🌿</div>
            <div>
              <h2 className="font-black text-[#1B4332] text-lg leading-tight">Sthirvaa Farms</h2>
              <p className="text-gray-400 text-[11px] font-medium">Pure. Fresh. From Our Farm to Your Home.</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Invoice ID</p>
              <p className="text-[#1B4332] font-black text-[15px]">{inv.id}</p>
            </div>
            <StatusBadge status={inv.paymentStatus || 'UNPAID'} />
          </div>

          <div className="flex gap-6 py-3 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Invoice Date</p>
              <p className="text-gray-800 font-bold text-sm">{inv.invoiceDate}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Due Date</p>
              <p className="text-gray-800 font-bold text-sm">{inv.dueDate}</p>
            </div>
          </div>
        </div>

        <div className="bg-white mx-4 mt-3 rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-wider mb-3">Bill To</p>
              <div className="flex items-start gap-2">
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
              <p className="text-[10px] font-black text-[#1B4332] uppercase tracking-wider mb-3">Plan Details</p>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5">🥛</span>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold">Plan</p>
                    <p className="text-gray-800 font-bold text-[12px]">Subscription</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold">Billing Cycle</p>
                    <p className="text-gray-800 font-bold text-[12px]">Monthly</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold">Delivery Time</p>
                    <p className="text-gray-800 font-bold text-[12px]">6:00 AM – 8:00 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white mx-4 mt-3 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[11px] font-black text-[#1B4332] uppercase tracking-wider">Invoice Summary</p>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-5 py-2 bg-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Item</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide text-right">Qty</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide text-right">Price (₹)</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide text-right">Amount (₹)</p>
          </div>

          <div className="divide-y divide-gray-50">
            {inv.items?.map((item: any, i: number) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-5 py-3 items-start">
                <div>
                  <p className="text-[12px] font-bold text-gray-800">{item.name}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{item.description}</p>
                </div>
                <p className="text-[12px] text-gray-600 font-medium text-right">{item.qty}</p>
                <p className="text-[12px] text-gray-600 font-medium text-right">{item.price?.toFixed(2)}</p>
                <p className="text-[12px] text-gray-800 font-bold text-right">{item.amount?.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 divide-y divide-gray-50 px-5">
            <div className="flex items-center justify-between py-2.5">
              <p className="text-[12px] text-gray-500 font-medium">Subtotal</p>
              <p className="text-[12px] text-gray-800 font-bold">{inv.subtotal?.toFixed(2)}</p>
            </div>
            {inv.discount > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <p className="text-[12px] text-gray-500 font-medium">Discount</p>
                <p className="text-[12px] text-red-500 font-bold">-{inv.discount?.toFixed(2)}</p>
              </div>
            )}
            <div className="flex items-center justify-between py-2.5">
              <p className="text-[12px] text-gray-500 font-medium">Gateway Fee</p>
              <p className="text-[12px] text-gray-800 font-bold">{inv.gatewayFee?.toFixed(2)}</p>
            </div>
            <div className="flex items-center justify-between py-4">
              <p className="text-[13px] font-black text-[#1B4332] uppercase tracking-wide">Total Amount</p>
              <p className="text-[18px] font-black text-[#1B4332]">₹ {inv.total?.toFixed(2)}</p>
            </div>
          </div>

          <div className="px-5 pb-4">
            <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
              <span className="text-gray-300">ⓘ</span>
              This is a computer generated invoice and does not require a signature.
            </p>
          </div>
        </div>

        {!isPaid && (
          <div className="mx-4 mt-4">
            <Link
              href="/checkout"
              className="w-full py-4 bg-[#1B4332] text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.15em] shadow-lg hover:bg-[#081C15] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              Pay ₹ {inv.total?.toFixed(2)} Now
            </Link>
          </div>
        )}

        <div className="bg-white mx-4 mt-3 mb-4 rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-black text-gray-700">Need Help?</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:support@sthirvaafarms.com" className="flex items-center gap-1.5 text-[11px] text-[#1B4332] font-bold hover:underline">
              <Mail size={12} />
              support@sthirvaafarms.com
            </a>
            <a href="tel:+919876543210" className="flex items-center gap-1.5 text-[11px] text-[#1B4332] font-bold hover:underline">
              <Phone size={12} />
              +91 98765 43210
            </a>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
