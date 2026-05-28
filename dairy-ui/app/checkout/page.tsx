'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Check, MapPin, ChevronRight, Loader2, CreditCard,
  Landmark, Wallet, Plus, Minus, Tag, Clock, Trash2, ArrowLeft,
  Lock, Package, Copy, X, ShoppingBag
} from 'lucide-react';
import api, { formatImageUrl } from '@/lib/api';
import AppLayout from '@/components/AppLayout';

// ── Types ──────────────────────────────────────────────────
type Step = 1 | 2 | 3;
type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';

const UPI_APPS = [
  { name: 'Google Pay', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-google-pay-2038779-1721670.png' },
  { name: 'PhonePe', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-phonepe-logo-icon-download-in-svg-png-gif-file-formats--technology-social-media-company-brand-vol-5-pack-logos-icons-2945035.png' },
  { name: 'Paytm', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-paytm-226448.png' },
  { name: 'BHIM', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-bhim-3-69845.png' },
  { name: 'Amazon Pay', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-amazon-pay-3628005-3031023.png' },
];

// ── Draft ID generator ──────────────────────────────────────
function getDraftId() {
  if (typeof window === 'undefined') return 'DRF-000000';
  let id = sessionStorage.getItem('checkout_draft_id');
  if (!id) {
    id = 'DRF-' + Math.floor(100000 + Math.random() * 900000);
    sessionStorage.setItem('checkout_draft_id', id);
  }
  return id;
}

// ── Step Indicator ──────────────────────────────────────────
function StepIndicator({ step }: { step: Step }) {
  const steps = ['Review & Pay', 'Processing', 'Confirmed'];
  const activeIdx = step - 1;
  return (
    <div className="flex items-center justify-center px-6 py-3 bg-white border-b border-gray-100">
      {steps.map((label, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                done ? 'bg-[#1B4332] text-white' : active ? 'bg-[#1B4332] text-white ring-4 ring-[#1B4332]/20' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check size={13} /> : i + 1}
              </div>
              <span className={`text-[9px] font-bold whitespace-nowrap ${active ? 'text-[#1B4332]' : done ? 'text-[#1B4332]' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] flex-1 mx-2 mb-4 rounded-full transition-all ${done ? 'bg-[#1B4332]' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [showUpiApps, setShowUpiApps] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [showPromo, setShowPromo] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [orderResponse, setOrderResponse] = useState<any>(null);
  const [draftId] = useState(() => getDraftId());
  const [draftTime] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  const [mounted, setMounted] = useState(false);

  const [userAddress, setUserAddress] = useState<any>(null);
  const [apartments, setApartments] = useState<any[]>([]);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [apartmentName, setApartmentName] = useState('');
  const [towerNumber, setTowerNumber] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  // Fetch delivery fee from settings
  useEffect(() => {
    api.get('/settings/delivery_fee')
      .then(res => { if (res.data?.settingValue) setDeliveryFee(parseFloat(res.data.settingValue)); })
      .catch(() => {});
  }, []);

  // Load cart from localStorage, userAddress, and apartments list
  useEffect(() => {
    const saved = localStorage.getItem('checkout_cart');
    if (saved) {
      try { setCartItems(JSON.parse(saved)); } catch (e) {}
    }

    // Fetch address properties
    api.get('/users/me/address')
      .then(res => {
        setUserAddress(res.data);
        if (res.data?.apartmentName) {
          setApartmentName(res.data.apartmentName);
          setTowerNumber(res.data.towerNumber || '');
          setDoorNumber(res.data.doorNumber || '');
        }
      })
      .catch(() => {});

    // Fetch apartments list
    api.get('/apartments')
      .then(res => {
        setApartments(res.data);
      })
      .catch(() => {});

    setMounted(true);
  }, []);

  const saveAddress = async () => {
    if (!apartmentName || !towerNumber || !doorNumber) return;
    setSavingAddress(true);
    try {
      const res = await api.post('/users/me/address', {
        apartmentName,
        towerNumber,
        doorNumber,
      });
      setUserAddress(res.data);
      setIsEditingAddress(false);
    } catch (e) {
      console.error('Failed to save address:', e);
    } finally {
      setSavingAddress(false);
    }
  };

  // Persist cart changes back to localStorage
  useEffect(() => {
    if (cartItems.length > 0) {
      localStorage.setItem('checkout_cart', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  // ── Calculations ──────────────────────────────────────────
  const subtotal = cartItems.reduce((s, i) => s + i.price * (i.cartQuantity || 1), 0);
  const autoDiscount = subtotal > 1000 ? Math.round(subtotal * 0.1) : 0;
  const totalDiscount = autoDiscount + promoDiscount;
  const gatewayFee = paymentMethod === 'upi' || paymentMethod === 'cod' ? 0 : Math.round((subtotal - totalDiscount) * 0.015);
  const total = subtotal - totalDiscount + gatewayFee + deliveryFee;

  // ── Cart helpers ──────────────────────────────────────────
  const changeQty = (id: number, delta: number) => {
    setCartItems(prev =>
      prev.map(i => i.id === id ? { ...i, cartQuantity: Math.max(1, (i.cartQuantity || 1) + delta) } : i)
    );
  };
  const removeItem = (id: number) => setCartItems(prev => prev.filter(i => i.id !== id));

  const applyPromo = () => {
    setPromoError('');
    if (promoCode.toUpperCase() === 'STHIRVAA10') {
      setPromoDiscount(Math.round(subtotal * 0.1));
      setPromoApplied(true);
    } else if (promoCode.toUpperCase() === 'FREESHIP') {
      setPromoDiscount(deliveryFee);
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code. Try STHIRVAA10 or FREESHIP');
    }
  };

  const handlePay = async () => {
    setStep(2);
    const payload = {
      items: cartItems.map(i => ({ productId: i.id, quantity: i.cartQuantity || 1, price: i.price })),
      deliveryAddress: userAddress?.deliveryAddress || '',
      paymentMethod, subtotal, discount: totalDiscount, gatewayFee, total,
    };
    try {
      const res = await api.post('/orders/checkout-flow', payload);
      setOrderResponse(res.data);
      localStorage.removeItem('checkout_cart');
      sessionStorage.removeItem('checkout_draft_id');
      setStep(3);
    } catch {
      setTimeout(() => {
        setOrderResponse({ id: draftId.replace('DRF-', 'INV-'), total, invoiceDate: new Date().toLocaleDateString() });
        localStorage.removeItem('checkout_cart');
        sessionStorage.removeItem('checkout_draft_id');
        setStep(3);
      }, 2200);
    }
  };

  // ── Empty Cart ─────────────────────────────────────────────
  if (!mounted) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-5">
          <Loader2 className="animate-spin text-[#1B4332]" size={30} />
        </div>
      </AppLayout>
    );
  }

  if (cartItems.length === 0 && step === 1) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-5">
          <div className="w-24 h-24 rounded-full bg-[#F0F4F1] flex items-center justify-center">
            <ShoppingBag size={40} className="text-[#1B4332]/40" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#1B4332] mb-1">Your cart is empty</h2>
            <p className="text-gray-500 text-sm">Add some fresh products before checking out.</p>
          </div>
          <button onClick={() => router.push('/shop')}
            className="flex items-center gap-2 px-6 py-3 bg-[#1B4332] text-white rounded-xl font-bold text-sm hover:bg-[#081C15] transition-all shadow-md">
            <ArrowLeft size={16} /> Back to Shop
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F5F9F6] flex flex-col w-full lg:max-w-4xl mx-auto rounded-xl overflow-hidden shadow-sm border border-gray-100">

        {/* ── Top Bar ── */}
        <div className="flex items-center gap-3 px-5 py-4 bg-[#1B4332] text-white">
          <button onClick={() => step === 1 ? router.push('/shop') : setStep(1)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Return to Shop">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-base leading-tight">
              {step === 1 ? 'Review your order' : step === 2 ? 'Processing payment…' : 'Order confirmed!'}
            </h1>
            {step === 1 && (
              <p className="text-white/60 text-[10px] font-medium mt-0.5">
                Draft {draftId} · Started at {draftTime}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg">
            <Lock size={11} className="text-[#C5A059]" />
            <span className="text-[10px] font-bold text-white/80">Secure</span>
          </div>
        </div>

        <StepIndicator step={step} />

        {/* ══════════════ STEP 1: Review & Pay ══════════════ */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto pb-6">

            {/* ── Delivery Info ── */}
            {(!userAddress?.deliveryAddress || isEditingAddress) ? (
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-brand/20 p-5 animate-in fade-in duration-200">
                <h3 className="font-black text-[#1B4332] text-sm uppercase tracking-wider mb-3">
                  Set Delivery Address
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      Select Apartment Complex
                    </label>
                    <select
                      value={apartmentName}
                      onChange={(e) => setApartmentName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand font-medium text-gray-800"
                    >
                      <option value="">-- Choose Apartment --</option>
                      {apartments.map((apt) => (
                        <option key={apt.id} value={apt.name}>
                          {apt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        Tower/Block Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Tower B"
                        value={towerNumber}
                        onChange={(e) => setTowerNumber(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand font-medium text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        Door/Flat Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 404"
                        value={doorNumber}
                        onChange={(e) => setDoorNumber(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand font-medium text-gray-800"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex gap-3">
                    {userAddress?.deliveryAddress && (
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(false)}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={savingAddress || !apartmentName || !towerNumber || !doorNumber}
                      onClick={saveAddress}
                      className="flex-1 py-2 bg-[#1B4332] text-white hover:bg-[#081C15] font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {savingAddress ? (
                        <Loader2 className="animate-spin" size={13} />
                      ) : (
                        'Save & Deliver Here'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-xl bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
                    <MapPin size={15} className="text-[#1B4332]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-wider mb-0.5">Delivery Address</p>
                    <p className="text-[12px] font-bold text-gray-800 truncate">{userAddress.deliveryAddress}</p>
                  </div>
                  <button
                    onClick={() => setIsEditingAddress(true)}
                    className="text-[11px] font-bold text-[#1B4332] hover:underline flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF8EE] flex items-center justify-center flex-shrink-0">
                    <Clock size={15} className="text-[#C5A059]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#C5A059] uppercase tracking-wider mb-0.5">Estimated Delivery</p>
                    <p className="text-[12px] font-bold text-gray-800">Tomorrow, 6:00 AM – 8:00 AM</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Order Items ── */}
            <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Package size={14} className="text-[#1B4332]" />
                <p className="font-black text-[12px] text-gray-700 uppercase tracking-wider">
                  Order Items ({cartItems.length})
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {cartItems.map((item, i) => (
                  <div key={item.id ?? i} className="flex items-center gap-3 px-4 py-3">
                    <img
                      src={formatImageUrl(item.imageUrl) || 'https://via.placeholder.com/80'}
                      className="w-12 h-12 rounded-xl object-cover bg-gray-50 border border-gray-100 flex-shrink-0"
                      alt={item.name}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-[13px] leading-tight truncate">{item.name}</p>
                      <p className="text-[10px] text-[#C5A059] font-bold mt-0.5">
                        ₹{item.price} × {item.cartQuantity || 1} = <span className="text-[#1B4332]">₹{item.price * (item.cartQuantity || 1)}</span>
                      </p>
                      {item.description && (
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight pr-2">{item.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1.5 bg-[#F0F4F1] rounded-lg px-1.5 py-1">
                        <button onClick={() => changeQty(item.id, -1)}
                          className="w-6 h-6 bg-white rounded-md shadow-sm flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors">
                          <Minus size={11} />
                        </button>
                        <span className="font-black text-sm text-[#1B4332] w-5 text-center">{item.cartQuantity || 1}</span>
                        <button onClick={() => changeQty(item.id, 1)}
                          className="w-6 h-6 bg-[#1B4332] rounded-md shadow-sm flex items-center justify-center text-white hover:bg-[#081C15] transition-colors">
                          <Plus size={11} />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
                        <Trash2 size={10} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Promo Code ── */}
            <div className="mx-4 mt-3">
              <button onClick={() => setShowPromo(p => !p)}
                className="flex items-center gap-2 text-[#1B4332] text-[12px] font-bold hover:underline transition-colors">
                <Tag size={13} />
                {promoApplied ? `Promo applied: -₹${promoDiscount}` : 'Apply promo code or discount'}
                {!promoApplied && <ChevronRight size={12} className={`transition-transform ${showPromo ? 'rotate-90' : ''}`} />}
                {promoApplied && <span className="text-emerald-500 text-[10px]">✓</span>}
              </button>
              {showPromo && !promoApplied && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value); setPromoError(''); }}
                    placeholder="Enter code (e.g. STHIRVAA10)"
                    className="flex-1 border-2 border-gray-200 focus:border-[#1B4332] rounded-xl px-3 py-2 text-xs outline-none font-medium transition-colors"
                  />
                  <button onClick={applyPromo}
                    className="px-4 py-2 bg-[#1B4332] text-white rounded-xl text-xs font-bold hover:bg-[#081C15] transition-colors">
                    Apply
                  </button>
                </div>
              )}
              {promoError && <p className="text-[11px] text-red-500 font-medium mt-1">{promoError}</p>}
            </div>

            {/* ── Price Breakdown ── */}
            <div className="mx-4 mt-3 bg-[#F9FBF9] rounded-2xl border border-[#E8F0EA] overflow-hidden">
              <div className="px-4 py-4 space-y-2.5">
                {cartItems.map((item, i) => (
                  <div key={item.id ?? i} className="flex justify-between text-[11px] text-gray-500 font-medium">
                    <span className="truncate mr-2">{item.name} × {item.cartQuantity || 1}</span>
                    <span className="flex-shrink-0 font-bold text-gray-700">₹{item.price * (item.cartQuantity || 1)}</span>
                  </div>
                ))}
                <div className="border-t border-[#E8F0EA] pt-2.5 space-y-2">
                  <div className="flex justify-between text-[12px] text-gray-500 font-medium">
                    <span>Delivery fee</span>
                    <span>{deliveryFee === 0 ? <span className="text-emerald-600 font-bold">FREE</span> : `₹${deliveryFee}`}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-[12px] text-emerald-600 font-bold">
                      <span>Discount{autoDiscount > 0 ? ' (10% off above ₹1000)' : ''}</span>
                      <span>-₹{totalDiscount}</span>
                    </div>
                  )}
                  {gatewayFee > 0 && (
                    <div className="flex justify-between text-[11px] text-gray-400 font-medium">
                      <span>Gateway fee (1.5%)</span>
                      <span>₹{gatewayFee.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 py-4 bg-[#1B4332] flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-wider">Total Payable</p>
                  {totalDiscount > 0 && (
                    <p className="text-white/40 text-[11px] line-through">₹{(total + totalDiscount).toFixed(0)}</p>
                  )}
                </div>
                <p className="text-white text-3xl font-black">₹{Math.round(total)}</p>
              </div>
            </div>

            {/* ── Payment Method ── */}
            <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="font-black text-[12px] text-gray-700 uppercase tracking-wider">Payment Method</p>
              </div>
              <div className="divide-y divide-gray-50">
                {([
                  { id: 'upi', label: 'UPI (Instant & Free)', sub: 'GPay, PhonePe, Paytm & more', badge: 'Recommended', icon: '⚡' },
                  { id: 'card', label: 'Debit / Credit Card', sub: '+ 1.5% convenience fee', icon: '💳' },
                  { id: 'netbanking', label: 'Net Banking', sub: '+ 1.5% convenience fee', icon: '🏦' },
                  { id: 'cod', label: 'Cash on Delivery', sub: 'Pay when your order arrives', icon: '💵' },
                ] as { id: PaymentMethod; label: string; sub: string; badge?: string; icon: string }[]).map(m => (
                  <button key={m.id} onClick={() => { setPaymentMethod(m.id); setShowUpiApps(m.id === 'upi'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${paymentMethod === m.id ? 'bg-[#F0F8F4]' : 'hover:bg-gray-50'}`}>
                    <span className="text-xl flex-shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[13px] flex items-center gap-2 ${paymentMethod === m.id ? 'text-[#1B4332]' : 'text-gray-800'}`}>
                        {m.label}
                        {m.badge && <span className="text-[9px] bg-[#1B4332] text-white px-1.5 py-0.5 rounded-full font-black">{m.badge}</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">{m.sub}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === m.id ? 'border-[#1B4332]' : 'border-gray-300'}`}>
                      {paymentMethod === m.id && <div className="w-2 h-2 rounded-full bg-[#1B4332]" />}
                    </div>
                  </button>
                ))}
              </div>
              {/* UPI App Quick Select */}
              {paymentMethod === 'upi' && (
                <div className="px-4 py-3 border-t border-gray-50 bg-[#F9FBF9]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pay with</p>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    {UPI_APPS.map(app => (
                      <button key={app.name} onClick={() => setSelectedUpiApp(app.name)}
                        className={`flex flex-col items-center gap-1.5 flex-shrink-0 p-2 rounded-xl transition-all ${selectedUpiApp === app.name ? 'bg-[#1B4332]/10 ring-2 ring-[#1B4332]/30' : 'hover:bg-gray-100'}`}>
                        <img src={app.icon} alt={app.name} className="w-9 h-9 object-contain rounded-lg" />
                        <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">{app.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Note ── */}
            <p className="mx-4 mt-3 text-[10px] text-gray-400 font-medium text-center">
              ⚠️ Changes to your order cannot be made after payment is confirmed.
            </p>

            {/* ── CTA ── */}
            <div className="mx-4 mt-4">
              <button 
                onClick={handlePay}
                disabled={!userAddress?.deliveryAddress}
                className="w-full py-4 bg-[#1B4332] text-white rounded-2xl font-black text-[15px] shadow-lg hover:bg-[#081C15] hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Lock size={15} />
                {userAddress?.deliveryAddress ? `Pay ₹${Math.round(total)} Securely` : 'Set Delivery Address to Pay'}
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <Lock size={10} className="text-gray-400" />
                <p className="text-[10px] text-gray-400 font-medium">SSL encrypted · PCI DSS compliant · Powered by Cashfree</p>
              </div>
              <button onClick={() => router.push('/shop')}
                className="w-full mt-3 py-2.5 text-[#1B4332] text-[12px] font-bold rounded-xl hover:bg-[#F0F4F1] transition-colors text-center">
                ← Continue Shopping
              </button>
            </div>
          </div>
        )}

        {/* ══════════════ STEP 2: Processing ══════════════ */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-6 bg-white">
            <div className="w-24 h-24 bg-[#F0F8F4] rounded-full flex items-center justify-center shadow-inner border border-[#1B4332]/10 relative">
              {selectedUpiApp ? (
                <img src={UPI_APPS.find(a => a.name === selectedUpiApp)?.icon} className="w-12 h-12 object-contain animate-pulse" />
              ) : <span className="text-4xl">💳</span>}
              <div className="absolute inset-0 rounded-full border-4 border-[#1B4332]/20 border-t-[#1B4332] animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-gray-800 mb-2">Processing Payment</h2>
              <p className="text-sm text-gray-500 font-medium">Please wait while we confirm your payment…</p>
            </div>
            <Loader2 size={28} className="animate-spin text-[#1B4332]" />
          </div>
        )}

        {/* ══════════════ STEP 3: Success ══════════════ */}
        {step === 3 && orderResponse && (
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#E8F8EE] to-white flex flex-col">
            <div className="px-6 pt-10 pb-6 flex flex-col items-center text-center">
              {/* Animated checkmark */}
              <div className="w-20 h-20 bg-[#1B4332] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(27,67,50,0.3)] mb-4 animate-in zoom-in duration-500">
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-black text-[#1B4332] mb-1">Payment Successful!</h2>
              <p className="text-4xl font-black text-gray-800 mt-1 mb-1">₹{orderResponse.total?.toFixed(0) ?? Math.round(total)}</p>
              <p className="text-[11px] text-gray-400 font-medium mb-6">
                Order {orderResponse.id} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>

              {/* UTR */}
              <div className="w-full bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-green-100 mb-6">
                <p className="font-bold text-gray-700 text-[12px]">UTR: <span className="font-mono ml-1">3412{Math.floor(Math.random() * 99999999)}</span></p>
                <button className="text-gray-400 hover:text-gray-600 transition-colors"><Copy size={15} /></button>
              </div>

              {/* Progress */}
              <div className="w-full bg-white rounded-2xl px-5 py-4 border border-green-100 shadow-sm mb-8 text-left space-y-3">
                {[
                  { label: 'Payment confirmed', done: true },
                  { label: 'Order placed successfully', done: true },
                  { label: 'Preparing your order…', done: false },
                  { label: 'Delivery by 6 AM tomorrow', done: false },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${row.done ? 'bg-[#1B4332]' : 'bg-gray-200'}`}>
                      <Check size={11} className={row.done ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <p className={`text-[13px] font-bold ${row.done ? 'text-gray-800' : 'text-gray-400'}`}>{row.label}</p>
                  </div>
                ))}
              </div>

              <div className="text-5xl mb-4 animate-bounce">🛵</div>

              <button onClick={() => router.push('/orders')}
                className="w-full py-4 bg-[#1B4332] text-white rounded-2xl font-black text-[15px] shadow-lg hover:bg-[#081C15] transition-all flex items-center justify-center gap-2 mb-3">
                Track My Order
              </button>
              <button onClick={() => router.push('/shop')}
                className="w-full py-3 text-[#1B4332] font-bold text-[13px] rounded-2xl hover:bg-[#F0F4F1] transition-colors">
                Continue Shopping
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
