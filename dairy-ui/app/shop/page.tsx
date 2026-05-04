'use client';

import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { Plus, Minus, ShoppingCart, Search, X, Loader2, ChevronRight, Star, Clock, CheckCircle2, ShieldCheck, MapPin, Leaf, User } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';

/* ─── Types ─── */
interface Product {
  id: number; name: string; category: string; subcategory: string;
  price: number; unit: string; description: string; imageUrl?: string;
  inStock: boolean; quantity?: number; rating?: number; reviews?: number; slashedPrice?: number;
}

interface CartItem extends Product { cartQuantity: number; }
interface SubscriptionPlanItem {
  description: string; qty: number; unit: string; frequency: string; imageUrl?: string; mrp?: number; sellingPrice?: number;
}
interface SubscriptionPlan {
  id: number; name: string; tagline: string; monthlyPrice: number; badgeText?: string;
  imageUrl?: string; savings?: number; totalValue?: number; includesPoojaPack?: boolean; items: SubscriptionPlanItem[];
}

import AppLayout from '@/components/AppLayout';

const CATEGORIES = [
  { id: 'all', name: 'All Products', icon: '🛍️' },
  { id: 'dairy', name: 'Dairy & Milk', icon: '🥛' },
  { id: 'vegetables', name: 'Fresh Veggies', icon: '🥬' },
  { id: 'divine', name: 'Divine Products', icon: '🔥' },
  { id: 'meat', name: 'Meats', icon: '🍗' }
];



const SAMPLE_PRODUCTS: Product[] = [
  { id: 101, name: 'Sthirvaa A2 Gir Milk', category: 'dairy', subcategory: 'Milk', price: 90, unit: '1 Litre', description: 'Pure A2 milk from our Gir cows.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', mrp: 110 },
  { id: 102, name: 'Organic Buffalo Curd', category: 'dairy', subcategory: 'Curd', price: 65, unit: '500g', description: 'Thick, creamy curd made from buffalo milk.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1628045610815-37cb420ba679?w=400', mrp: 80 },
  { id: 103, name: 'Desi Cow Ghee', category: 'dairy', subcategory: 'Ghee', price: 850, unit: '500ml', description: 'Bilona method handmade ghee.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400', mrp: 999 },
  { id: 104, name: 'Farm Fresh Eggs', category: 'eggs', subcategory: 'Eggs', price: 120, unit: '12 pcs', description: 'Free-range organic brown eggs.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400', mrp: 150 },
  { id: 105, name: 'Premium Paneer', category: 'paneer', subcategory: 'Paneer', price: 140, unit: '250g', description: 'Soft, fresh paneer made daily.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?w=400', mrp: 180 },
  { id: 106, name: 'Fresh Chicken', category: 'meat', subcategory: 'Chicken', price: 280, unit: '1 kg', description: 'Tender, fresh chicken cut to order.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0881?w=400', mrp: 350 },
  { id: 107, name: 'Organic Tomatoes', category: 'vegetables', subcategory: 'Veggies', price: 40, unit: '1 kg', description: 'Pesticide-free red tomatoes.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400', mrp: 60 },
  { id: 108, name: 'Divine Pooja Pack', category: 'divine', subcategory: 'Divine', price: 250, unit: '1 Pack', description: 'Complete pooja essentials kit.', inStock: true, imageUrl: 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400', mrp: 300 }
];

const SAMPLE_PLANS: SubscriptionPlan[] = [
  {
    id: 1, name: 'Essential Dairy Pack', tagline: '1 Litre Pure Milk Daily + 500ml Ghee', monthlyPrice: 1999, badgeText: '₹66/day',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600', totalValue: 2459, savings: 460, includesPoojaPack: true,
    items: [{ description: '1 Litre Pure Milk Daily', qty: 1, unit: 'Litre', frequency: 'DAILY' }, { description: '500ml Ghee', qty: 500, unit: 'ml', frequency: 'MONTHLY' }]
  },
  {
    id: 2, name: 'Protein Pack', tagline: '1 Litre Milk Daily + 96 Eggs/month', monthlyPrice: 2499, badgeText: '₹83/day',
    imageUrl: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?w=600', totalValue: 3239, savings: 740, includesPoojaPack: true,
    items: [{ description: '1 Litre Milk Daily', qty: 1, unit: 'Litre', frequency: 'DAILY' }, { description: '96 Eggs/month', qty: 96, unit: 'pcs', frequency: 'MONTHLY' }, { description: 'Chicken 1kg', qty: 1, unit: 'kg', frequency: 'WEEKLY' }]
  },
  {
    id: 3, name: 'Family Smart Pack', tagline: '2 Litre Milk Daily + 96 Eggs/month', monthlyPrice: 2999, badgeText: '₹99/day',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600', totalValue: 3859, savings: 860, includesPoojaPack: true,
    items: [{ description: '2 Litre Milk Daily', qty: 2, unit: 'Litre', frequency: 'DAILY' }, { description: '96 Eggs/month', qty: 96, unit: 'pcs', frequency: 'MONTHLY' }]
  },
  {
    id: 4, name: 'Premium Family Pack', tagline: '2 Litre Milk Daily + 96 Eggs/month', monthlyPrice: 3499, badgeText: 'Most Popular',
    imageUrl: 'https://images.unsplash.com/photo-1494390248081-4e521a5940db?w=600', totalValue: 4529, savings: 1030, includesPoojaPack: true,
    items: [{ description: '2 Litre Milk Daily', qty: 2, unit: 'Litre', frequency: 'DAILY' }, { description: '96 Eggs/month', qty: 96, unit: 'pcs', frequency: 'MONTHLY' }, { description: 'Chicken 1kg', qty: 1, unit: 'kg', frequency: 'WEEKLY' }]
  }
];

function SubscriptionCard({ plan, onSubscribe }: { plan: SubscriptionPlan; onSubscribe: (p: SubscriptionPlan) => void }) {
  const savings = plan.savings || 0;
  const totalVal = plan.totalValue || plan.monthlyPrice + savings;
  
  // Helper to fix encoding issues with rupee symbol in badges
  const formattedBadge = plan.badgeText?.replace('???', '₹');

  return (
    <div className="bg-[#FDFCF0] rounded-xl border border-[#EADAB8] shadow-sm hover:shadow-lg hover:border-[#C5A059] transition-all duration-300 flex flex-col group overflow-hidden">
      {/* Header Image */}
      <div className="relative h-32 overflow-hidden bg-white">
        <img src={plan.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'} alt={plan.name} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
        {formattedBadge && (
          <div className="absolute top-2 left-2 bg-[#C5A059] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
             <Star size={10} fill="currentColor" /> {formattedBadge}
          </div>
        )}
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="text-white font-black text-base leading-tight drop-shadow-md">{plan.name}</h3>
        </div>
      </div>
      
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-[11px] font-bold text-gray-700 mb-3 line-clamp-1">{plan.tagline}</p>
        
        {/* Value vs Our Price */}
        <div className="bg-white rounded-lg p-2.5 mb-4 border border-gray-100 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#C5A059]/20" />
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Market Value</p>
            <p className="text-xs font-bold text-gray-400 line-through decoration-[#1B4332]/30">₹{totalVal}<span className="text-[9px] font-normal">/mo</span></p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-widest">Our Price</p>
            <p className="text-xl font-black text-[#1B4332] leading-none">₹{plan.monthlyPrice}<span className="text-[10px] font-bold text-gray-500">/mo</span></p>
          </div>
        </div>
        
        {/* Items List */}
        <div className="flex-1 space-y-2.5 mb-4">
          {plan.items?.map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-1.5">
              <div className="flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059] mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{item.description}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">{item.qty} {item.unit} • {item.frequency}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pt-0.5">
                <p className="text-[10px] font-black text-gray-800 leading-none">₹{item.sellingPrice}<span className="text-[8px] font-bold text-gray-400">/{item.unit}</span></p>
                {item.mrp > item.sellingPrice && (
                   <p className="text-[8px] text-gray-400 line-through mt-0.5">₹{item.mrp}</p>
                )}
              </div>
            </div>
          ))}
          {plan.includesPoojaPack && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-dashed border-[#EADAB8]">
              <Star size={11} className="text-amber-500" fill="currentColor" />
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-tight">Includes Divine Pooja Pack</p>
            </div>
          )}
        </div>
        
        {/* Action */}
        <div className="mt-auto">
          {savings > 0 && (
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><ShieldCheck size={11} className="text-green-600" /> Cancel Anytime</span>
              <span className="text-[10px] font-black text-[#1B4332] bg-[#E8F5EE] px-2 py-0.5 rounded-md border border-[#1B4332]/10">Save ₹{savings}/mo</span>
            </div>
          )}
          <button onClick={() => onSubscribe(plan)} className="w-full py-2.5 bg-[#1B4332] text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-[#081C15] hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-[#1B4332]/20 shadow-md">
            Subscribe Now <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}


function ProductCard({ product, isInCart, cartQuantity, onAddToCart, onRemoveFromCart }:
  { product: Product; isInCart: boolean; cartQuantity: number; onAddToCart: (p: Product) => void; onRemoveFromCart: (id: number) => void }) {
  const discount = product.slashedPrice ? Math.round(((product.slashedPrice - product.price) / product.slashedPrice) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group">
      <div className="relative overflow-hidden bg-[#F8F9FA] aspect-[4/3] h-28">
        <img src={product.imageUrl || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {discount > 0 && (
          <div className="absolute top-1.5 left-1.5 bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black shadow-sm">{discount}% OFF</div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-[9px] font-black text-[#C5A059] uppercase tracking-widest mb-0.5">{product.subcategory || product.category}</p>
        <h3 className="font-bold text-xs text-gray-900 leading-tight mb-2 line-clamp-2">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between">
          <div>
            {product.slashedPrice ? (
              <p className="text-[10px] text-gray-400 line-through leading-none">₹{product.slashedPrice}</p>
            ) : null}
            <p className="text-sm font-black text-[#1B4332] leading-none">
              ₹{product.price || 0}
              <span className="text-[9px] font-bold text-gray-400">/{product.unit || 'unit'}</span>
            </p>
          </div>


          {isInCart ? (
            <div className="flex items-center gap-1.5 bg-[#F0F4F1] rounded-lg p-0.5 shadow-inner">
              <button onClick={() => onRemoveFromCart(product.id)} className="w-6 h-6 flex items-center justify-center bg-white rounded flex-shrink-0 shadow-sm text-[#1B4332] hover:bg-gray-50 transition-all"><Minus size={12} /></button>
              <span className="font-black text-xs text-[#1B4332] w-4 text-center">{cartQuantity}</span>
              <button onClick={() => onAddToCart(product)} className="w-6 h-6 flex items-center justify-center bg-[#1B4332] rounded flex-shrink-0 text-white hover:bg-[#081C15] transition-all shadow-sm"><Plus size={12} /></button>
            </div>
          ) : (
            <button onClick={() => onAddToCart(product)} className="w-7 h-7 flex items-center justify-center bg-[#1B4332] text-white rounded-lg hover:bg-[#081C15] transition-all active:scale-95 shadow-sm group-hover:shadow-md"><Plus size={14} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsumerShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const { showToast } = useNotification();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [plansRes, productsRes] = await Promise.all([api.get('/subscription-plans'), api.get('/products')]);
        setPlans(plansRes.data || []);
        setProducts(productsRes.data || []);
      } catch (e) { 
        console.error(e); 
        setPlans([]); 
        setProducts([]);
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, searchQuery, activeCategory]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.cartQuantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.cartQuantity, 0), [cart]);

  const addToCart = (p: Product) => setCart(prev => {
    const f = prev.find(i => i.id === p.id);
    return f ? prev.map(i => i.id === p.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i) : [...prev, { ...p, cartQuantity: 1 }];
  });
  const removeFromCart = (id: number) => setCart(prev => {
    const f = prev.find(i => i.id === id);
    return f && f.cartQuantity > 1 ? prev.map(i => i.id === id ? { ...i, cartQuantity: i.cartQuantity - 1 } : i) : prev.filter(i => i.id !== id);
  });

  return (
    <AppLayout>
      <div className="flex flex-col font-sans w-full max-w-7xl mx-auto">
        
        {/* ── Shop Header ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-black text-[#1B4332] tracking-tight">Sthirvaa Shop</h1>
            <p className="text-[11px] font-bold text-[#C5A059] uppercase tracking-widest mt-0.5">Farm Fresh Essentials</p>
          </div>

          {/* Search */}
          <div className="flex-1 w-full max-w-md relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-gray-400 group-focus-within:text-[#1B4332] transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Search milk, veggies, eggs..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border-2 border-transparent rounded-xl text-xs focus:border-[#1B4332]/20 focus:ring-0 outline-none transition-all shadow-sm" 
            />
          </div>

          {/* Cart Action */}
          <button onClick={() => setShowCart(true)} className="w-full sm:w-auto relative flex items-center justify-center gap-2 bg-[#1B4332] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow hover:bg-[#081C15] transition-all active:translate-y-0">
            <ShoppingCart size={14} />
            <span>₹{cartTotal}</span>
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-[#C5A059] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border-2 border-[#1B4332]">{cartCount}</span>}
          </button>
        </div>
        
        {/* ── Hero Section ── */}
        <section className="relative w-full rounded-2xl overflow-hidden mb-8 shadow-lg group min-h-[160px] flex items-center bg-[#1B4332]">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-[3s] ease-out" alt="Farm Fresh Basket" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B4332] via-[#1B4332]/80 to-transparent" />
          
          <div className="relative z-10 p-6 md:p-8 max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-[#C5A059] text-white px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest mb-3 shadow-sm">
              <Leaf size={10} /> 100% Organic & Fresh
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-2 drop-shadow-md">
              Fresh Daily Deliveries <br/><span className="text-[#EADAB8] font-serif italic font-medium text-xl sm:text-2xl">to your doorstep.</span>
            </h2>
            <p className="text-white/80 text-xs sm:text-sm font-medium max-w-md line-clamp-2">
              Subscribe to pure A2 milk, farm-fresh eggs, and chemical-free vegetables. Sourced directly from our Hoskote farms.
            </p>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 shadow-lg">
            <div className="w-7 h-7 rounded-md bg-[#C5A059] flex items-center justify-center shadow-inner">
              <Clock size={14} className="text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[9px] font-black uppercase tracking-widest leading-none mb-0.5">Guaranteed</p>
              <p className="text-white text-[11px] font-black">6 AM – 8 AM Delivery</p>
            </div>
          </div>
        </section>

        {/* ── Subscription Plans ── */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-xl font-black text-[#1B4332] mb-1">Choose Your Family Plan</h2>
            <p className="text-gray-500 text-xs">Premium farm products at market-beating prices with convenient monthly subscriptions.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#1B4332]" size={30} /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => <SubscriptionCard key={plan.id} plan={plan} onSubscribe={p => showToast(`Subscription for ${p.name} selected!`)} />)}
            </div>
          )}
        </section>

        {/* ── Add-Ons Section ── */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-black text-[#1B4332] mb-1">Customize Your Order</h2>
              <p className="text-gray-500 text-xs">Add extra essentials to your cart for tomorrow's delivery.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
               <Clock size={12} className="text-[#1B4332]" />
               <p className="text-[11px] font-medium text-gray-700">Next Slot: <span className="font-black text-[#1B4332]">Tomorrow 6 AM</span></p>
            </div>
          </div>

          {/* Enhanced Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                  activeCategory === cat.id 
                    ? 'bg-[#1B4332] text-white ring-2 ring-[#1B4332]/20' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-[#1B4332] border border-gray-200'
                }`}>
                <span className="text-base">{cat.icon}</span> {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#1B4332]" size={30} /></div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                {filteredProducts.map(p => (
                  <ProductCard key={p.id} product={p} isInCart={cart.some(i => i.id === p.id)}
                    cartQuantity={cart.find(i => i.id === p.id)?.cartQuantity ?? 0}
                    onAddToCart={addToCart} onRemoveFromCart={removeFromCart} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 flex flex-col items-center">
                <Search size={32} className="text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium text-sm">No products found matching your search.</p>
                <button onClick={() => {setSearchQuery(''); setActiveCategory('all');}} className="mt-2 text-[#1B4332] text-xs font-bold hover:underline">Clear filters</button>
              </div>
            )}
          </div>
        </section>

        {/* ── Trust Signals ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { icon: <CheckCircle2 size={16} className="text-[#1B4332]" />, title: 'Direct from Farm', desc: 'Harvested daily.' },
            { icon: <Leaf size={16} className="text-green-600" />, title: '100% Natural', desc: 'Chemical-free & pure.' },
            { icon: <MapPin size={16} className="text-red-500" />, title: 'Free Delivery', desc: 'Zero extra charges.' },
            { icon: <ShieldCheck size={16} className="text-blue-600" />, title: 'Quality Assured', desc: 'Rigorous checks.' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-full bg-[#F0F4F1] flex items-center justify-center flex-shrink-0">{item.icon}</div>
              <div>
                <h4 className="font-black text-[#1B4332] text-xs mb-0.5">{item.title}</h4>
                <p className="text-[10px] text-gray-500 font-medium leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </section>


      {/* ── Cart Drawer ── */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[5000] flex justify-end transition-opacity" onClick={e => e.target === e.currentTarget && setShowCart(false)}>
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="font-black text-[#1B4332] text-lg flex items-center gap-3"><ShoppingCart size={20} /> Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-gray-500 hover:bg-gray-100 hover:text-red-500 shadow-sm transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-4">
                  <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                     <ShoppingCart size={40} strokeWidth={1.5} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-600">Your cart is empty</p>
                    <p className="text-sm mt-1">Looks like you haven't added any fresh items yet.</p>
                  </div>
                  <button onClick={() => setShowCart(false)} className="mt-4 text-[#1B4332] font-bold px-6 py-2 bg-[#F0F4F1] rounded-xl hover:bg-[#E2EAE4] transition-colors">Start Shopping</button>
                </div>
              ) : cart.map(item => (
                <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                  <img src={item.imageUrl} className="w-20 h-20 rounded-xl object-cover bg-gray-50" alt={item.name} />
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="font-bold text-[#1B4332] text-sm leading-tight">{item.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">₹{item.price} / {item.unit}</p>
                    <div className="flex items-center gap-3 mt-3 bg-gray-50 w-fit rounded-lg p-1 border border-gray-200">
                      <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 bg-white rounded-md shadow-sm flex items-center justify-center text-gray-600 hover:text-red-500"><Minus size={12} /></button>
                      <span className="font-black text-sm text-[#1B4332] w-4 text-center">{item.cartQuantity}</span>
                      <button onClick={() => addToCart(item)} className="w-7 h-7 bg-[#1B4332] rounded-md shadow-sm flex items-center justify-center text-white hover:bg-[#081C15]"><Plus size={12} /></button>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between items-end">
                     <p className="font-black text-[#1B4332] text-base">₹{item.price * item.cartQuantity}</p>
                     <button onClick={() => removeFromCart(item.id)} className="text-xs text-gray-400 hover:text-red-500 font-medium underline opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="space-y-3 mb-6">
                   <div className="flex justify-between text-sm text-gray-500 font-medium">
                      <span>Subtotal</span>
                      <span>₹{cartTotal}</span>
                   </div>
                   <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Delivery</span>
                      <span>FREE</span>
                   </div>
                   <div className="pt-3 border-t border-gray-100 flex items-end justify-between">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Payable</p>
                      <p className="text-3xl font-black text-[#1B4332]">₹{cartTotal}</p>
                   </div>
                </div>
                <button className="w-full py-4 bg-[#1B4332] text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg hover:bg-[#081C15] hover:-translate-y-0.5 transition-all active:translate-y-0">
                  Checkout Securely
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
}


