'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronDown, Droplets, LogOut, Loader2, Truck, ShoppingBag, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { PriceSlab, rupees } from '@/lib/customerPricing';
import PriceSlabTable from '@/components/PriceSlabTable';

interface Delivery { shift: string; litres: number; rate: number; deliveryRate: number; amount: number; location?: string | null; }
interface Day { date: string; morning: number; evening: number; litres: number; amount: number; deliveries: Delivery[]; }
interface Statement {
  customer: { id: number; name: string; phone: string; address?: string };
  from: string; to: string;
  days: Day[];
  totalLitres: number; totalAmount: number; totalDelivery: number; deliveryDays: number;
  slabs: PriceSlab[]; defaultRate: number;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const litres = (n: number) => `${+(n || 0).toFixed(1)} L`;
const monthName = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const dayName = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * A milk customer's own page: the milk delivered to them each day this month and what it costs.
 * Farm users open it as /my-milk?customer=ID to see exactly what that customer sees.
 */
export default function MyMilkPage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  /** The price list stays folded until asked for. */
  const [showPrices, setShowPrices] = useState(false);
  const [payNote, setPayNote] = useState(false);
  /** Set when a farm user is previewing a customer's page. */
  const [previewId, setPreviewId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let role = '';
    try { role = JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { /* not signed in */ }
    const id = new URLSearchParams(window.location.search).get('customer');
    setPreviewId(role !== 'CUSTOMER' && id ? id : null);
  }, []);

  const isThisMonth = useMemo(() => {
    const now = new Date();
    return month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  }, [month]);

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.replace('/login'); return; }
    if (previewId === undefined) return;
    const from = iso(month);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const to = isThisMonth ? iso(new Date()) : iso(end);
    setLoading(true);
    setError('');
    api.get(previewId ? `/customers/${previewId}/milk-statement?from=${from}&to=${to}` : `/my/milk?from=${from}&to=${to}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Could not load your milk deliveries'))
      .finally(() => setLoading(false));
  }, [month, isThisMonth, router, previewId]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const slabs = [...(data?.slabs || [])].sort((a, b) => a.fromLitres - b.fromLitres);
  const avgRate = data && data.totalLitres > 0 ? data.totalAmount / data.totalLitres : 0;

  return (
    <div className="min-h-screen shrink-0 bg-[#F0F4F1]">
      {/* Header */}
      <div className="bg-brand-dark text-white px-4 pt-5 pb-16">
        <div className="max-w-2xl mx-auto flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Sthirvaa Farms</div>
            <h1 className="text-lg font-bold truncate mt-0.5">{data?.customer.name || 'My Milk'}</h1>
            {data?.customer.address && <div className="text-[12px] text-white/60 truncate">{data.customer.address}</div>}
          </div>
          {/* Staff previewing a customer's page get a way back in place of the customer's own buttons. */}
          {previewId ? (
            <a href="/sales" className="flex items-center gap-1 flex-shrink-0 p-2 text-[12px] font-bold text-white/80 hover:text-white">
              <ArrowLeft size={14} /> Back
            </a>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              <a href="/shop" className="p-2 rounded-full hover:bg-white/10" title="Shop"><ShoppingBag size={18} /></a>
              <button onClick={logout} className="p-2 rounded-full hover:bg-white/10" title="Log out"><LogOut size={18} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-12 pb-10 space-y-4">
        {/* Month + totals */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => shift(-1)} className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-text2"><ChevronLeft size={18} /></button>
            <div className="text-[15px] font-bold text-text">{monthName(month)}</div>
            <button onClick={() => shift(1)} disabled={isThisMonth} className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-text2 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface2 rounded-xl py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text3">Milk</div>
              <div className="text-[17px] font-black text-brand">{litres(data?.totalLitres ?? 0)}</div>
            </div>
            <div className="bg-surface2 rounded-xl py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text3">Days</div>
              <div className="text-[17px] font-black text-text">{data?.deliveryDays ?? 0}</div>
            </div>
            <div className="bg-brand rounded-xl py-3 text-white">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{isThisMonth ? 'Bill so far' : 'Bill'}</div>
              <div className="text-[17px] font-black">{rupees(data?.totalAmount ?? 0)}</div>
            </div>
          </div>
          {data && data.totalLitres > 0 && (
            <div className="text-[11px] text-text3 text-center mt-2">
              Average {rupees(avgRate)} / L{data.totalDelivery > 0 ? ` · includes ${rupees(data.totalDelivery)} delivery` : ''}
            </div>
          )}
          {/* The bill runs from the 1st to the last day of the month and is paid once the month is over. */}
          {data && data.totalAmount > 0 && (() => {
            const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
            const short = month.toLocaleDateString('en-IN', { month: 'short' });
            const next = new Date(month.getFullYear(), month.getMonth() + 1, 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            return (
              <div className="mt-3">
                <button type="button" disabled={isThisMonth} onClick={() => setPayNote(true)}
                  className="w-full py-2.5 rounded-xl bg-brand text-white text-[14px] font-bold disabled:bg-surface2 disabled:text-text3 disabled:cursor-not-allowed">
                  Pay {rupees(data.totalAmount)}
                </button>
                <div className="text-[11px] text-text3 text-center mt-1">
                  Bill for 1–{lastDay.getDate()} {short}{isThisMonth ? ` · payable from ${next}` : ''}
                </div>
                {payNote && !isThisMonth && (
                  <div className="text-[12px] text-text2 text-center mt-1">Online payment is coming soon - please pay at the farm for now.</div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Daily deliveries */}
        <div className="bg-white rounded-2xl shadow-sm border border-border-custom overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Droplets size={16} className="text-brand" />
            <h2 className="text-[14px] font-bold text-text">Daily milk</h2>
          </div>
          {loading ? (
            <div className="p-10 flex justify-center text-text3"><Loader2 className="animate-spin" size={20} /></div>
          ) : error ? (
            <div className="p-6 text-center text-[13px] text-danger">{error}</div>
          ) : !data || data.days.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text3">No milk delivered in {monthName(month)}.</div>
          ) : (
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_40px_56px_60px_60px] gap-1 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text3 bg-surface2">
                <span>Date</span>
                <span className="text-right">Litres</span>
                <span className="text-right">Milk</span>
                <span className="text-right">Delivery</span>
                <span className="text-right">Amount</span>
              </div>
              {data.days.map(d => {
                // The day's delivery charge, from each delivery's per-litre charge; the rest is milk.
                const delivery = d.deliveries.reduce((t, x) => t + x.litres * (x.deliveryRate || 0), 0);
                return (
                <div key={d.date} className="border-t border-gray-50">
                  <button onClick={() => setOpen(open === d.date ? null : d.date)}
                    className="w-full grid grid-cols-[minmax(0,1fr)_40px_56px_60px_60px] gap-1 px-4 py-3 text-[13px] items-center hover:bg-surface2/60 text-left">
                    <span className="font-semibold text-text whitespace-nowrap">{dayName(d.date)}</span>
                    <span className="text-right font-bold text-brand">{+d.litres.toFixed(1)}</span>
                    <span className="text-right text-text2">{rupees(d.amount - delivery)}</span>
                    <span className="text-right text-text2">{delivery > 0 ? rupees(delivery) : '—'}</span>
                    <span className="text-right font-bold text-text">{rupees(d.amount)}</span>
                  </button>
                  {open === d.date && (
                    <div className="px-4 pb-3 space-y-1">
                      {d.deliveries.map((x, i) => (
                        <div key={i} className="flex justify-between text-[12px] bg-surface2 rounded-lg px-3 py-2">
                          <span className="text-text2">
                            <span className="capitalize">{x.shift === 'COMBINED' ? 'Whole day' : x.shift.toLowerCase()}</span> · {litres(x.litres)}
                            {x.location && <span className="block text-[11px] text-text3">Delivered to {x.location}</span>}
                          </span>
                          <span className="text-text3">
                            {x.deliveryRate > 0
                              ? <>₹{Math.round(x.rate - x.deliveryRate)} milk + ₹{Math.round(x.deliveryRate)} delivery</>
                              : <>₹{Math.round(x.rate)} / L</>}
                            <b className="text-text ml-2">{rupees(x.amount)}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Price list */}
        {data && (
          <div className="bg-white rounded-2xl shadow-sm border border-border-custom p-4">
            <button type="button" onClick={() => setShowPrices(v => !v)} aria-expanded={showPrices}
              className="w-full text-[14px] font-bold text-text flex items-center gap-2">
              <Truck size={16} className="text-brand" /> Your milk price
              <ChevronDown size={16} className={`ml-auto text-text3 transition-transform ${showPrices ? 'rotate-180' : ''}`} />
            </button>
            {showPrices && (slabs.length === 0 ? (
              <div className="text-[13px] text-text2 mt-3">{rupees(data.defaultRate)} per litre</div>
            ) : (
              <div className="mt-3">
                <PriceSlabTable slabs={slabs} totalLabel="You pay" />
                <p className="text-[11px] text-text3 pt-2">Your price depends on how many litres come in one delivery.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
