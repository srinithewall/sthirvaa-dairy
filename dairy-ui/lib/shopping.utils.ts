/**
 * Sthirvaa Farms Shopping Module
 * Utilities, Types, and Constants
 */

/* ─── TypeScript Types ──────────────────────────────── */

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem extends Product {
  cartQuantity: number;
}

export interface Order {
  id: string;
  userId?: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  deliveryDate?: string;
  address: DeliveryAddress;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DeliveryAddress {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  addressType?: 'home' | 'office' | 'other';
}

export interface CartState {
  items: CartItem[];
  count: number;
  total: number;
  lastUpdated: string;
}

export interface ShopFilters {
  category: ProductCategory | 'all';
  searchQuery: string;
  sortBy: SortOption;
  priceRange?: [number, number];
  inStockOnly?: boolean;
}

/* ─── Enums & Constants ────────────────────────────── */

export type ProductCategory = 'dairy' | 'vegetables' | 'divine';

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled'
  | 'returned';

export type SortOption = 'price-low' | 'price-high' | 'rating' | 'newest' | 'popular';

export type PaymentMethod = 'credit_card' | 'debit_card' | 'upi' | 'netbanking' | 'wallet' | 'cod';

export const PRODUCT_CATEGORIES = {
  dairy: {
    id: 'dairy',
    name: 'Dairy & Milk',
    icon: '🥛',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: 'Fresh milk, curd, paneer, ghee and dairy products'
  },
  vegetables: {
    id: 'vegetables',
    name: 'Fresh Veggies',
    icon: '🥬',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Organic vegetables from local farms'
  },
  divine: {
    id: 'divine',
    name: 'Divine Products',
    icon: '🔥',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: 'Incense, spiritual items, crystals and sacred products'
  }
};

export const SUBCATEGORIES = {
  dairy: ['Milk', 'Curd', 'Paneer', 'Ghee', 'Butter', 'Cheese', 'Beverages', 'Other'],
  vegetables: ['Leafy Greens', 'Root Vegetables', 'Cruciferous', 'Cucurbits', 'Fruits', 'Herbs', 'Mushrooms', 'Other'],
  divine: ['Incense', 'Dhoop', 'Camphor', 'Spiritual Items', 'Crystals', 'Beads', 'Oils', 'Other']
};

export const ORDER_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Order placed, awaiting confirmation'
  },
  confirmed: {
    label: 'Confirmed',
    icon: '✓',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Order confirmed and being prepared'
  },
  processing: {
    label: 'Processing',
    icon: '⚙️',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    description: 'Order is being prepared for shipment'
  },
  shipped: {
    label: 'Shipped',
    icon: '🚚',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    description: 'Order is on the way'
  },
  delivered: {
    label: 'Delivered',
    icon: '✓✓',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Order delivered successfully'
  },
  cancelled: {
    label: 'Cancelled',
    icon: '✕',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Order has been cancelled'
  },
  returned: {
    label: 'Returned',
    icon: '↩️',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    description: 'Order has been returned'
  }
};

export const PAYMENT_METHODS = {
  credit_card: { label: 'Credit Card', icon: '💳' },
  debit_card: { label: 'Debit Card', icon: '💳' },
  upi: { label: 'UPI', icon: '📱' },
  netbanking: { label: 'Net Banking', icon: '🏦' },
  wallet: { label: 'Digital Wallet', icon: '👛' },
  cod: { label: 'Cash on Delivery', icon: '💵' }
};

export const DELIVERY_FEES = {
  base: 50,
  freeAbove: 500,
  sameDayFee: 100
};

export const TAX_RATE = 0.18; // 18% GST

/* ─── Utility Functions ────────────────────────────── */

export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.cartQuantity, 0);
}

export function calculateTax(subtotal: number, taxRate: number = TAX_RATE): number {
  return parseFloat((subtotal * taxRate).toFixed(2));
}

export function calculateDeliveryFee(subtotal: number): number {
  if (subtotal >= DELIVERY_FEES.freeAbove) return 0;
  return DELIVERY_FEES.base;
}

export function calculateOrderTotal(
  subtotal: number,
  taxRate: number = TAX_RATE,
  deliveryFee: number = DELIVERY_FEES.base
): number {
  const tax = calculateTax(subtotal, taxRate);
  return parseFloat((subtotal + tax + deliveryFee).toFixed(2));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(price);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `STH-${random}-${new Date().getFullYear()}`;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  const digitsOnly = phone.replace(/\D/g, '');
  return phoneRegex.test(digitsOnly);
}

export function isValidPincode(pincode: string): boolean {
  const pincodeRegex = /^\d{6}$/;
  return pincodeRegex.test(pincode);
}

export function isValidAddress(address: DeliveryAddress): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!address.name || address.name.trim().length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (!isValidPhone(address.phone)) {
    errors.push('Invalid phone number');
  }

  if (!isValidEmail(address.email)) {
    errors.push('Invalid email address');
  }

  if (!address.address || address.address.trim().length < 5) {
    errors.push('Address must be at least 5 characters');
  }

  if (!address.city || address.city.trim().length < 2) {
    errors.push('City name is required');
  }

  if (!isValidPincode(address.pincode)) {
    errors.push('Invalid pincode (must be 6 digits)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function isValidProduct(product: Partial<Product>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!product.name || product.name.trim().length < 2) {
    errors.push('Product name must be at least 2 characters');
  }

  if (!product.category) {
    errors.push('Category is required');
  }

  if (!product.subcategory) {
    errors.push('Subcategory is required');
  }

  if (product.price === undefined || product.price < 0) {
    errors.push('Price must be a positive number');
  }

  if (!product.unit) {
    errors.push('Unit is required');
  }

  if (!product.description || product.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (product.rating !== undefined && (product.rating < 0 || product.rating > 5)) {
    errors.push('Rating must be between 0 and 5');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function searchProducts(
  products: Product[],
  query: string
): Product[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(product =>
    product.name.toLowerCase().includes(lowerQuery) ||
    product.description.toLowerCase().includes(lowerQuery) ||
    product.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function filterByCategory(
  products: Product[],
  category: ProductCategory | 'all'
): Product[] {
  if (category === 'all') return products;
  return products.filter(p => p.category === category);
}

export function sortProducts(
  products: Product[],
  sortBy: SortOption
): Product[] {
  const sorted = [...products];

  switch (sortBy) {
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'rating':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'newest':
      return sorted.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    case 'popular':
      return sorted.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
    default:
      return sorted;
  }
}

export function getOrderTimeline(status: OrderStatus) {
  const timeline = [
    { status: 'pending', label: 'Order Placed', completed: true },
    { status: 'confirmed', label: 'Confirmed', completed: status !== 'pending' },
    { status: 'processing', label: 'Processing', completed: ['processing', 'shipped', 'delivered'].includes(status) },
    { status: 'shipped', label: 'Shipped', completed: ['shipped', 'delivered'].includes(status) },
    { status: 'delivered', label: 'Delivered', completed: status === 'delivered' }
  ];
  return timeline;
}

export function getEstimatedDeliveryDate(
  orderDate: Date,
  daysToDeliver: number = 2
): Date {
  const estimated = new Date(orderDate);
  estimated.setDate(estimated.getDate() + daysToDeliver);
  return estimated;
}

export function isOrderReturnable(
  order: Order,
  returnWindowDays: number = 7
): boolean {
  if (order.status !== 'delivered') return false;
  
  const deliveryDate = new Date(order.deliveryDate || order.createdAt);
  const now = new Date();
  const daysSinceDelivery = Math.floor(
    (now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceDelivery <= returnWindowDays;
}

export function getCartSummary(items: CartItem[]) {
  const subtotal = calculateSubtotal(items);
  const tax = calculateTax(subtotal);
  const deliveryFee = calculateDeliveryFee(subtotal);
  const total = calculateOrderTotal(subtotal);

  return {
    itemCount: items.length,
    quantity: items.reduce((sum, item) => sum + item.cartQuantity, 0),
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    deliveryFee,
    total: parseFloat(total.toFixed(2)),
    isFreeDelivery: subtotal >= DELIVERY_FEES.freeAbove
  };
}

export function getRecommendationScore(product: Product): number {
  let score = 0;
  
  if (product.rating && product.rating >= 4.5) score += 30;
  else if (product.rating && product.rating >= 4) score += 20;
  
  if (product.reviews && product.reviews >= 100) score += 20;
  else if (product.reviews && product.reviews >= 50) score += 10;
  
  if (product.inStock) score += 20;
  
  if (product.tags?.includes('bestseller') || product.tags?.includes('popular')) score += 20;
  
  return score;
}

export function simulateApiDelay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const shoppingUtils = {
  calculateSubtotal,
  calculateTax,
  calculateDeliveryFee,
  calculateOrderTotal,
  formatPrice,
  formatDate,
  formatDateTime,
  generateOrderId,
  isValidEmail,
  isValidPhone,
  isValidPincode,
  isValidAddress,
  isValidProduct,
  searchProducts,
  filterByCategory,
  sortProducts,
  getOrderTimeline,
  getEstimatedDeliveryDate,
  isOrderReturnable,
  getCartSummary,
  getRecommendationScore,
  simulateApiDelay
};

export default shoppingUtils;
