'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Plus, Minus, Heart, ShoppingCart, Search, Filter, X, MapPin, Phone, Clock } from 'lucide-react';

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

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  count: number;
}

/* ─── Constants ──────────────────────────────────────── */
const CATEGORIES: Category[] = [
  {
    id: 'all',
    name: 'All Products',
    icon: '✨',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    count: 0
  },
  {
    id: 'dairy',
    name: 'Dairy & Milk',
    icon: '🥛',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    count: 0
  },
  {
    id: 'vegetables',
    name: 'Fresh Veggies',
    icon: '🥬',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    count: 0
  },
  {
    id: 'divine',
    name: 'Divine Products',
    icon: '🔥',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    count: 0
  }
];

/* ─── Stat Card Component ───────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 flex flex-col shadow-md text-white ${color}`}>
      <div className="absolute -right-3 -top-3 opacity-15 scale-150">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-90">{label}</span>
      <span className="text-2xl font-black tracking-tight leading-none mt-1">{value}</span>
    </div>
  );
}

/* ─── Product Card Component ──────────────────────── */
function ProductCard({
  product,
  isInCart,
  cartQuantity,
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  isFavorite
}: {
  product: Product;
  isInCart: boolean;
  cartQuantity: number;
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
      <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 aspect-square flex items-center justify-center overflow-hidden">
        <div className="text-5xl group-hover:scale-110 transition-transform duration-300">
          {product.category === 'dairy' && '🥛'}
          {product.category === 'vegetables' && '🥬'}
          {product.category === 'divine' && '🔥'}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-black text-sm">OUT OF STOCK</span>
          </div>
        )}

        <button
          onClick={() => onToggleFavorite(product.id)}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all"
        >
          <Heart size={16} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-text3'} />
        </button>

        {product.rating && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-[10px] font-black">
            ⭐ {product.rating} ({product.reviews})
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-black text-[13px] text-text leading-tight mb-1">{product.name}</h3>
          <p className="text-[11px] text-text3 mb-2 line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-1 mb-3">
            <span className="text-[10px] font-bold text-text3 bg-surface px-2 py-1 rounded-full">
              {product.unit}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-brand">₹{product.price}</span>
          </div>

          {isInCart ? (
            <div className="flex items-center gap-2 bg-surface rounded-xl p-2">
              <button
                onClick={() => onRemoveFromCart(product.id)}
                className="flex-1 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors flex items-center justify-center"
              >
                <Minus size={14} />
              </button>
              <span className="font-black text-[12px] text-text w-6 text-center">{cartQuantity}</span>
              <button
                onClick={() => onAddToCart(product)}
                className="flex-1 p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddToCart(product)}
              disabled={!product.inStock}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-black text-[11px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <ShoppingCart size={14} />
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'rating'>('price-low');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [activeCategory, searchQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          category: activeCategory === 'all' ? null : activeCategory,
          search: searchQuery || null
        }
      });
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch products", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    const sorted = [...products];
    if (sortBy === 'price-low') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return sorted;
  }, [products, sortBy]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.cartQuantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.cartQuantity, 0), [cart]);

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.cartQuantity > 1) {
        return prev.map(item => item.id === productId ? { ...item, cartQuantity: item.cartQuantity - 1 } : item);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const handleToggleFavorite = (productId: number) => {
    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      await api.post('/orders', {
        items: cart.map(item => ({ id: item.id, quantity: item.cartQuantity })),
        deliveryAddress: "Selected Farm Address" // Simplified for now
      });
      alert("Order placed successfully!");
      setCart([]);
      setShowCart(false);
    } catch (err) {
      alert("Failed to place order");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">Sthirvaa Shop</h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">Fresh dairy, organic vegetables & divine products from our farms</p>
        </div>
        <button
          onClick={() => setShowCart(!showCart)}
          className="relative bg-brand text-white flex items-center gap-2 py-3 px-4 rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg active:scale-95"
        >
          <ShoppingCart size={18} />
          <span className="hidden md:inline">Cart</span>
          {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">{cartCount}</span>}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<ShoppingCart size={48} />} label="Items in Cart" value={cartCount} color="bg-gradient-to-br from-brand to-brand-dark" />
        <StatCard icon={<span>🛍️</span>} label="Stock Range" value={products.length} color="bg-gradient-to-br from-purple-600 to-purple-800" />
        <StatCard icon={<Heart size={48} />} label="Favorites" value={favorites.length} color="bg-gradient-to-br from-red-500 to-red-700" />
        <StatCard icon={<span>₹</span>} label="Cart Total" value={`₹${cartTotal}`} color="bg-gradient-to-br from-green-600 to-green-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border-custom shadow-lg p-6 sticky top-24">
            <h2 className="font-black text-[13px] uppercase tracking-[0.15em] text-text mb-4">Categories</h2>
            <div className="space-y-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[12px] uppercase tracking-wide transition-all text-left ${activeCategory === cat.id ? 'bg-brand text-white shadow-lg' : 'bg-surface hover:bg-surface2 text-text3 hover:text-text'}`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="flex-1">{cat.name}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-border-custom my-4"></div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-[11px] border border-border-custom rounded-lg focus:border-brand focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-text3" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-[11px] font-bold px-3 py-2 rounded-lg border border-border-custom focus:outline-none focus:border-brand">
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
            <span className="text-[11px] text-text3 font-medium">{filteredAndSortedProducts.length} products found</span>
          </div>

          {loading ? (
            <div className="p-20 text-center text-text3 font-bold">LOADING FRESH PRODUCTS...</div>
          ) : filteredAndSortedProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-max">
              {filteredAndSortedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isInCart={cart.some(item => item.id === product.id)}
                  cartQuantity={cart.find(item => item.id === product.id)?.cartQuantity || 0}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={favorites.includes(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl p-12 text-center">
              <Search size={48} className="mx-auto text-text3 opacity-30 mb-4" />
              <p className="text-text3 font-medium">No products found matching your search.</p>
              <button onClick={() => setSearchQuery('')} className="text-brand font-black text-[12px] mt-3 hover:underline">Clear search</button>
            </div>
          )}
        </div>
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-end md:items-center justify-end md:justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full md:max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-right md:zoom-in duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border-custom bg-surface">
              <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">Shopping Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white rounded-lg transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="mx-auto text-text3 opacity-30 mb-3" />
                  <p className="text-text3 font-medium text-[12px]">Your cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-3 p-3 bg-surface rounded-xl">
                    <div className="text-3xl">{item.category === 'dairy' && '🥛'}{item.category === 'vegetables' && '🥬'}{item.category === 'divine' && '🔥'}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[12px] text-text">{item.name}</h3>
                      <p className="text-[10px] text-text3">₹{item.price} × {item.cartQuantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRemoveFromCart(item.id)} className="p-1 hover:bg-red-100 rounded transition-colors"><Minus size={12} className="text-red-600" /></button>
                      <span className="w-5 text-center text-[11px] font-black">{item.cartQuantity}</span>
                      <button onClick={() => handleAddToCart(item)} className="p-1 hover:bg-green-100 rounded transition-colors"><Plus size={12} className="text-green-600" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border-custom p-6 space-y-4 bg-surface">
                <div className="flex items-center justify-between font-black">
                  <span className="text-[13px] uppercase">Total</span>
                  <span className="text-2xl text-brand">₹{cartTotal}</span>
                </div>
                <button 
                  disabled={checkingOut}
                  onClick={handleCheckout} 
                  className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-xl font-black text-[12px] uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {checkingOut ? 'PROCESSING...' : 'Proceed to Checkout'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
