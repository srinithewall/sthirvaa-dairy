'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { MapPin, Phone, Mail, Clock, ChevronRight, CheckCircle, AlertCircle, Truck } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface DeliveryAddress {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  isDefault: boolean;
}

interface Order {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  deliveryDate?: string;
  address: DeliveryAddress;
}

/* ─── Sample Order Data ─── */
const SAMPLE_ORDERS: Order[] = [
  {
    id: 'STH-001-2024',
    date: '2024-01-15',
    items: [
      { id: 1, name: 'A2 Milk (1L)', price: 65, quantity: 2, category: 'dairy' },
      { id: 3, name: 'Paneer (200g)', price: 120, quantity: 1, category: 'dairy' },
      { id: 8, name: 'Capsicum Mix (250g)', price: 35, quantity: 1, category: 'vegetables' }
    ],
    subtotal: 285,
    tax: 51,
    deliveryFee: 0,
    total: 336,
    status: 'delivered',
    deliveryDate: '2024-01-17',
    address: {
      name: 'John Doe',
      phone: '+91 98765 43210',
      email: 'john@example.com',
      address: 'Apartment 301, Green Park Complex, Whitefield',
      city: 'Bengaluru',
      pincode: '560066',
      isDefault: true
    }
  },
  {
    id: 'STH-002-2024',
    date: '2024-01-18',
    items: [
      { id: 2, name: 'Curd (500g)', price: 45, quantity: 2, category: 'dairy' },
      { id: 14, name: 'Camphor Tablets (100g)', price: 150, quantity: 1, category: 'divine' }
    ],
    subtotal: 240,
    tax: 43,
    deliveryFee: 50,
    total: 333,
    status: 'shipped',
    address: {
      name: 'John Doe',
      phone: '+91 98765 43210',
      email: 'john@example.com',
      address: 'Apartment 301, Green Park Complex, Whitefield',
      city: 'Bengaluru',
      pincode: '560066',
      isDefault: true
    }
  },
  {
    id: 'STH-003-2024',
    date: '2024-01-19',
    items: [
      { id: 1, name: 'A2 Milk (1L)', price: 65, quantity: 1, category: 'dairy' },
      { id: 7, name: 'Cucumber (500g)', price: 25, quantity: 2, category: 'vegetables' }
    ],
    subtotal: 115,
    tax: 21,
    deliveryFee: 0,
    total: 136,
    status: 'processing',
    address: {
      name: 'John Doe',
      phone: '+91 98765 43210',
      email: 'john@example.com',
      address: 'Apartment 301, Green Park Complex, Whitefield',
      city: 'Bengaluru',
      pincode: '560066',
      isDefault: true
    }
  }
];

/* ─── Status Badge Component ─── */
function StatusBadge({ status }: { status: Order['status'] }) {
  const statusConfig = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmed' },
    processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Processing' },
    shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Shipped' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' }
  };

  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${config.bg} ${config.text}`}>
      {status === 'delivered' && <CheckCircle size={12} />}
      {status === 'shipped' && <Truck size={12} />}
      {status === 'processing' && <Clock size={12} />}
      {config.label}
    </span>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: (order: Order) => void }) {
  return (
    <div className="bg-white border border-border-custom rounded-2xl shadow-md hover:shadow-lg transition-all p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-border-custom">
        <div>
          <h3 className="font-black text-[13px] text-text tracking-tight">{order.id}</h3>
          <p className="text-[11px] text-text3 mt-1">{new Date(order.date).toLocaleDateString('en-IN')}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Items Summary */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-2">Items ({order.items.length})</p>
        <div className="space-y-1">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px]">
              <span className="text-text">{item.name}</span>
              <span className="text-text3">
                ₹{item.price} × {item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-surface rounded-lg p-3 mb-4 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text3">Subtotal</span>
          <span className="text-text">₹{order.subtotal}</span>
        </div>
        {order.tax > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text3">Tax</span>
            <span className="text-text">₹{order.tax}</span>
          </div>
        )}
        {order.deliveryFee > 0 && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text3">Delivery</span>
            <span className="text-text">₹{order.deliveryFee}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-black text-[12px] pt-2 border-t border-border-custom">
          <span>Total</span>
          <span className="text-brand">₹{order.total}</span>
        </div>
      </div>

      {/* Delivery Info */}
      {order.deliveryDate && order.status === 'delivered' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-[10px] font-bold text-green-700">
            ✓ Delivered on {new Date(order.deliveryDate).toLocaleDateString('en-IN')}
          </p>
        </div>
      )}

      {/* Address */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-1.5">Delivery Address</p>
        <p className="text-[11px] text-text font-medium mb-1">{order.address.name}</p>
        <p className="text-[10px] text-text3 line-clamp-2">{order.address.address}</p>
        <p className="text-[10px] text-text3 mt-1">
          {order.address.city} - {order.address.pincode}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={() => onViewDetails(order)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-brand text-brand rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-brand hover:text-white transition-all"
      >
        View Details
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ─── Order Detail Modal ─── */
function OrderDetailModal({ order, onClose }: { order?: Order; onClose: () => void }) {
  if (!order) return null;

  const timeline = [
    { status: 'pending', label: 'Order Placed', completed: true },
    { status: 'confirmed', label: 'Confirmed', completed: order.status !== 'pending' },
    { status: 'processing', label: 'Processing', completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
    { status: 'shipped', label: 'Shipped', completed: ['shipped', 'delivered'].includes(order.status) },
    { status: 'delivered', label: 'Delivered', completed: order.status === 'delivered' }
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border-custom bg-white">
          <div>
            <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">{order.id}</h2>
            <p className="text-[11px] text-text3 mt-1">Placed on {new Date(order.date).toLocaleDateString('en-IN')}</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-surface rounded-lg transition-colors font-bold text-[12px]"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Order Timeline</h3>
            <div className="space-y-2">
              {timeline.map((step, idx) => (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] ${
                    step.completed
                      ? 'bg-green-100 text-green-700'
                      : order.status === step.status
                      ? 'bg-brand text-white'
                      : 'bg-surface text-text3'
                  }`}>
                    {step.completed ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-[12px] ${step.completed ? 'text-green-700' : 'text-text3'}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Order Items</h3>
            <div className="space-y-2 bg-surface rounded-xl p-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border-custom last:border-0">
                  <div>
                    <p className="font-bold text-[12px] text-text">{item.name}</p>
                    <p className="text-[10px] text-text3">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-black text-[12px] text-text">₹{item.price * item.quantity}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="space-y-3">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Price Breakdown</h3>
            <div className="bg-surface rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text3">Subtotal</span>
                <span className="font-bold">₹{order.subtotal}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text3">Tax (18%)</span>
                  <span className="font-bold">₹{order.tax}</span>
                </div>
              )}
              {order.deliveryFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text3">Delivery Fee</span>
                  <span className="font-bold">₹{order.deliveryFee}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-black text-[13px] pt-2 border-t border-border-custom">
                <span>Total Amount</span>
                <span className="text-brand">₹{order.total}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-3">
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Delivery Address</h3>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
              <p className="font-bold text-[13px] text-text mb-3">{order.address.name}</p>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-brand mt-0.5 flex-shrink-0" />
                  <p className="text-text">{order.address.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-brand flex-shrink-0" />
                  <p className="text-text">
                    {order.address.city}, {order.address.pincode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-brand flex-shrink-0" />
                  <p className="text-text">{order.address.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-brand flex-shrink-0" />
                  <p className="text-text">{order.address.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t border-border-custom bg-surface flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-border-custom rounded-xl font-black text-[12px] uppercase transition-colors hover:bg-white"
          >
            Close
          </button>
          <button className="flex-1 px-4 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-black text-[12px] uppercase transition-colors">
            Download Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Orders Page ─── */
export default function OrdersPage() {
  const [orders] = useState<Order[]>(SAMPLE_ORDERS);
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('all');

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  return (
    <AppLayout>
      {/* ─── Header ─── */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">
          My Orders
        </h1>
        <p className="text-[12px] text-text3 mt-1 font-medium">
          Track and manage all your Sthirvaa shop purchases
        </p>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">Total Orders</p>
          <p className="text-2xl font-black text-text">{orders.length}</p>
        </div>
        <div className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">Total Spent</p>
          <p className="text-2xl font-black text-brand">₹{orders.reduce((sum, o) => sum + o.total, 0)}</p>
        </div>
        <div className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">Delivered</p>
          <p className="text-2xl font-black text-green-600">{orders.filter(o => o.status === 'delivered').length}</p>
        </div>
        <div className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">In Transit</p>
          <p className="text-2xl font-black text-purple-600">{orders.filter(o => o.status === 'shipped' || o.status === 'processing').length}</p>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase whitespace-nowrap transition-all flex-shrink-0 ${
              filterStatus === status
                ? 'bg-brand text-white shadow-lg'
                : 'bg-surface text-text3 hover:bg-surface2'
            }`}
          >
            {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Orders List ─── */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-text3 opacity-30 mb-4" />
          <p className="text-text3 font-medium">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetails={setSelectedOrder}
            />
          ))}
        </div>
      )}

      {/* ─── Order Detail Modal ─── */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(undefined)}
      />
    </AppLayout>
  );
}
