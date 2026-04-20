'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Minus, Heart, ShoppingCart, Search, Filter, X, Loader2 } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface Product {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  unit: string;
  description: string;
  image?: string;
  inStock: boolean;
  quantity?: number;
  rating?: number;
  reviews?: number;
  tags?: string[];
}

interface CartItem extends Product {
  cartQuantity: number;
}

/* ─── Constants ──────────────────────────────────────── */
const CATEGORIES = [
  { id: 'dairy',      name: 'Dairy & Milk',      icon: '🥛', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'vegetables', name: 'Fresh Veggies',      icon: '🥬', color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'divine',     name: 'Divine Products',    icon: '🔥', color: 'text-red-600',   bgColor: 'bg-red-50' },
];

const CATEGORY_ICON: Record<string, string> = { dairy: '🥛', vegetables: '🥬', divine: '🔥' };

/* ─── Stat Card ─────────────────────────────────────── */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 flex flex-col shadow-md text-white ${color}`}>
      <div className="absolute -right-3 -top-3 opacity-15 scale-150">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-90">{label}</span>
      <span className="text-2xl font-black tracking-tight leading-none mt-1">{value}</span>
    </div>
  );
}

/* ─── Product Card ───────────────────────────────────── */
function ProductCard({ product, isInCart, cartQuantity, onAddToCart, onRemoveFromCart, onToggleFavorite, isFavorite }:
  { product: Product; isInCart: boolean; cartQuantity: number; onAddToCart: (p: Product) => void; onRemoveFromCart: (id: number) => void; onToggleFavorite: (id: number) => void; isFavorite: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
      <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 aspect-square flex items-center justify-center overflow-hidden">
        <div className="text-5xl group-hover:scale-110 transition-transform duration-300">
          {CATEGORY_ICON[product.category] ?? '📦'}
        </div>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-black text-sm">OUT OF STOCK</span>
          </div>
        )}
        <button onClick={() => onToggleFavorite(product.id)}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all">
          <Heart size={16} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-text3'} />
        </button>
        {product.rating && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-[10px] font-black">
            ⭐ {product.rating} ({product.reviews ?? 0})
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-black text-[13px] text-text leading-tight mb-1">{product.name}</h3>
          <p className="text-[11px] text-text3 mb-2 line-clamp-2">{product.description}</p>
          <span className="text-[10px] font-bold text-text3 bg-surface px-2 py-1 rounded-full">{product.unit}</span>
        </div>
        <div className="mt-3 space-y-3">
          <span className="text-2xl font-black text-brand">₹{product.price}</span>
          {isInCart ? (
            <div className="flex items-center gap-2 bg-surface rounded-xl p-2">
              <button onClick={() => onRemoveFromCart(product.id)}
                className="flex-1 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors flex items-center justify-center">
                <Minus size={14} />
              </button>
              <span className="font-black text-[12px] text-text w-6 text-center">{cartQuantity}</span>
              <button onClick={() => onAddToCart(product)}
                className="flex-1 p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors flex items-center justify-center">
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => onAddToCart(product)} disabled={!product.inStock}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-black text-[11px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider">
              <ShoppingCart size={14} /> Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Checkout Modal ─────────────────────────────────── */
function CheckoutModal({ cart, cartTotal, onClose, onSuccess }:
  { cart: CartItem[]; cartTotal: number; onClose: () => void; onSuccess: () => void }) {
  const [address, setAddress] = useState('');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');

  const handlePlaceOrder = async () => {
    if (!address.trim()) { setErr('Please enter your delivery address.'); return; }
    setPlacing(true);
    try {
      await api.post('/orders', {
        deliveryAddress: address,
        items: cart.map(i => ({ id: i.id, quantity: i.cartQuantity, price: i.price })),
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Failed to place order.');
    } finally { setPlacing(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-border-custom flex justify-between items-center">
          <h2 className="font-black text-[14px] uppercase tracking-wider">Checkout</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-surface rounded-xl p-4 space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-[12px]">
                <span className="text-text">{item.name} × {item.cartQuantity}</span>
                <span className="font-bold text-text">₹{item.price * item.cartQuantity}</span>
              </div>
            ))}
            <div className="flex justify-between font-black text-[13px] pt-2 border-t border-border-custom">
              <span>Total</span>
              <span className="text-brand">₹{cartTotal}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase mb-2">Delivery Address *</label>
            <textarea
              rows={3}
              value={address}
              onChange={e => { setAddress(e.target.value); setErr(''); }}
              placeholder="Enter your full delivery address..."
              className="w-full px-4 py-2.5 border border-border-custom rounded-lg text-[12px] focus:outline-none focus:border-brand resize-none"
            />
            {err && <p className="text-red-600 text-[10px] mt-1">{err}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 border border-border-custom rounded-xl font-bold text-[12px] uppercase hover:bg-surface transition-all">
              Cancel
            </button>
            <button onClick={handlePlaceOrder} disabled={placing}
              className="flex-[2] py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-black text-[12px] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {placing ? <><Loader2 size={14} className="animate-spin" /> Placing...</> : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Shopping Page ─────────────────────────────── */
export default function ShoppingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState('dairy');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'rating'>('price-low');

  // Fetch from backend
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await api.get('/products', { params: { category: activeCategory } });
        setProducts(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [activeCategory]);

  const filteredProducts = useMemo(() => {
    let list = products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sortBy === 'price-low') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high') list = [...list].sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [products, searchQuery, sortBy]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.cartQuantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.cartQuantity, 0), [cart]);

  const addToCart = (product: Product) =>
    setCart(prev => {
      const found = prev.find(i => i.id === product.id);
      return found
        ? prev.map(i => i.id === product.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i)
        : [...prev, { ...product, cartQuantity: 1 }];
    });

  const removeFromCart = (id: number) =>
    setCart(prev => {
      const found = prev.find(i => i.id === id);
      return found && found.cartQuantity > 1
        ? prev.map(i => i.id === id ? { ...i, cartQuantity: i.cartQuantity - 1 } : i)
        : prev.filter(i => i.id !== id);
    });

  const toggleFavorite = (id: number) =>
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);

  const handleOrderSuccess = () => {
    setShowCheckout(false);
    setShowCart(false);
    setCart([]);
    setOrderSuccess(true);
    setTimeout(() => setOrderSuccess(false), 4000);
  };

  return (
    <AppLayout>
      {/* ─── Success Toast ─── */}
      {orderSuccess && (
        <div className="fixed top-6 right-6 z-[9999] bg-white border border-green-200 rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-black text-lg">✓</div>
          <div>
            <p className="font-black text-[13px] text-text">Order Placed!</p>
            <p className="text-[11px] text-text3">We'll deliver your items soon.</p>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">Sthirvaa Shop</h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">Fresh dairy, organic vegetables & divine products</p>
        </div>
        <button onClick={() => setShowCart(!showCart)}
          className="relative bg-brand text-white flex items-center gap-2 py-3 px-4 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg active:scale-95">
          <ShoppingCart size={18} />
          <span className="hidden md:inline">Cart</span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<ShoppingCart size={48} />} label="Items in Cart" value={cartCount} color="bg-gradient-to-br from-brand to-brand-dark" />
        <StatCard icon={<span>🛍️</span>} label="Total Products" value={products.length} color="bg-gradient-to-br from-purple-600 to-purple-800" />
        <StatCard icon={<Heart size={48} />} label="Favorites" value={favorites.length} color="bg-gradient-to-br from-red-500 to-red-700" />
        <StatCard icon={<span>₹</span>} label="Cart Total" value={`₹${cartTotal}`} color="bg-gradient-to-br from-green-600 to-green-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ─── Category Sidebar ─── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border-custom shadow-lg p-6 sticky top-24">
            <h2 className="font-black text-[13px] uppercase tracking-[0.15em] text-text mb-4">Categories</h2>
            <div className="space-y-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[12px] uppercase tracking-wide transition-all text-left ${
                    activeCategory === cat.id ? 'bg-brand text-white shadow-lg' : 'bg-surface hover:bg-surface2 text-text3 hover:text-text'
                  }`}>
                  <span className="text-lg">{cat.icon}</span>
                  <span className="flex-1">{cat.name}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-border-custom my-4" />
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <input type="text" placeholder="Search products..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-[11px] border border-border-custom rounded-lg focus:border-brand focus:outline-none" />
            </div>
          </div>
        </div>

        {/* ─── Products Grid ─── */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-text3" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="text-[11px] font-bold px-3 py-2 rounded-lg border border-border-custom focus:outline-none focus:border-brand">
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
            <span className="text-[11px] text-text3 font-medium">{filteredProducts.length} products found</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 size={36} className="animate-spin text-brand" />
              <p className="text-text3 text-[12px] font-medium">Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product}
                  isInCart={cart.some(i => i.id === product.id)}
                  cartQuantity={cart.find(i => i.id === product.id)?.cartQuantity ?? 0}
                  onAddToCart={addToCart} onRemoveFromCart={removeFromCart}
                  onToggleFavorite={toggleFavorite} isFavorite={favorites.includes(product.id)} />
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl p-12 text-center">
              <Search size={48} className="mx-auto text-text3 opacity-30 mb-4" />
              <p className="text-text3 font-medium">No products found.</p>
              <button onClick={() => setSearchQuery('')} className="text-brand font-black text-[12px] mt-3 hover:underline">
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Cart Drawer ─── */}
      {showCart && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border-custom bg-surface">
              <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">Shopping Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white rounded-lg"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart size={48} className="mx-auto text-text3 opacity-30 mb-3" />
                  <p className="text-text3 font-medium text-[12px]">Your cart is empty</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} className="flex gap-3 p-3 bg-surface rounded-xl">
                  <div className="text-3xl">{CATEGORY_ICON[item.category] ?? '📦'}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[12px] text-text">{item.name}</h3>
                    <p className="text-[10px] text-text3">₹{item.price} × {item.cartQuantity} = <span className="font-bold text-brand">₹{item.price * item.cartQuantity}</span></p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => removeFromCart(item.id)} className="p-1 hover:bg-red-100 rounded"><Minus size={12} className="text-red-600" /></button>
                    <span className="w-5 text-center text-[11px] font-black">{item.cartQuantity}</span>
                    <button onClick={() => addToCart(item)} className="p-1 hover:bg-green-100 rounded"><Plus size={12} className="text-green-600" /></button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border-custom p-6 space-y-4 bg-surface">
                <div className="flex items-center justify-between font-black">
                  <span className="text-[13px] uppercase">Total</span>
                  <span className="text-2xl text-brand">₹{cartTotal}</span>
                </div>
                <button onClick={() => setShowCheckout(true)}
                  className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-xl font-black text-[12px] uppercase tracking-wider transition-all shadow-lg active:scale-95">
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Checkout Modal ─── */}
      {showCheckout && (
        <CheckoutModal cart={cart} cartTotal={cartTotal}
          onClose={() => setShowCheckout(false)} onSuccess={handleOrderSuccess} />
      )}
    </AppLayout>
  );
}
