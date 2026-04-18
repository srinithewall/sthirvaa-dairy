'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { MapPin, Phone, Mail, Clock, ChevronRight, CheckCircle, AlertCircle, Truck } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface CartItem {
  id: number;
  product?: { name: string; category: string; price: number };
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  createdAt: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | string;
  deliveryAddress: string;
}

/* ─── Status Badge Component ─── */
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Confirmed' },
    processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Processing' },
    shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Shipped' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' }
  };

  const lowerStatus = status.toLowerCase();
  const config = statusConfig[lowerStatus] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${config.bg} ${config.text}`}>
      {lowerStatus === 'delivered' && <CheckCircle size={12} />}
      {lowerStatus === 'shipped' && <Truck size={12} />}
      {lowerStatus === 'processing' && <Clock size={12} />}
      {config.label}
    </span>
  );
}

/* ─── Order Card Component ─── */
function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: (order: Order) => void }) {
  return (
    <div className="bg-white border border-border-custom rounded-2xl shadow-md hover:shadow-lg transition-all p-6">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-border-custom">
        <div>
          <h3 className="font-black text-[13px] text-text tracking-tight">{order.id}</h3>
          <p className="text-[11px] text-text3 mt-1">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-2">Items ({order.items.length})</p>
        <div className="space-y-1">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px]">
              <span className="text-text">{item.product?.name || 'Product'}</span>
              <span className="text-text3">₹{item.price} × {item.quantity}</span>
            </div>
          ))}
          {order.items.length > 3 && <p className="text-[10px] text-text3 italic">+{order.items.length - 3} more items</p>}
        </div>
      </div>

      <div className="bg-surface rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between font-black text-[12px]">
          <span>Total Paid</span>
          <span className="text-brand">₹{order.total}</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-1.5">Delivery Address</p>
        <p className="text-[10px] text-text3 line-clamp-1">{order.deliveryAddress}</p>
      </div>

      <button onClick={() => onViewDetails(order)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-brand text-brand rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-brand hover:text-white transition-all">
        View Full Details <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ─── Main Orders Page ─── */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status.toLowerCase() === filterStatus.toLowerCase());

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">My Orders</h1>
        <p className="text-[12px] text-text3 mt-1 font-medium">Track and manage all your Sthirvaa farm purchases</p>
      </div>

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
          <p className="text-2xl font-black text-green-600">{orders.filter(o => o.status.toLowerCase() === 'delivered').length}</p>
        </div>
        <div className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
          <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">In Transit</p>
          <p className="text-2xl font-black text-purple-600">{orders.filter(o => ['shipped', 'processing'].includes(o.status.toLowerCase())).length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const).map(status => (
          <button
            key={status} onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase whitespace-nowrap transition-all flex-shrink-0 ${filterStatus === status ? 'bg-brand text-white shadow-lg' : 'bg-surface text-text3 hover:bg-surface2'}`}
          >
            {status === 'all' ? 'All Orders' : status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-20 text-center font-bold text-text3">FETCHING YOUR ORDERS...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-text3 opacity-30 mb-4" />
          <p className="text-text3 font-medium">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} onViewDetails={setSelectedOrder} />
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border-custom bg-white">
              <div>
                <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">{selectedOrder.id}</h2>
                <p className="text-[11px] text-text3 mt-1">Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <button onClick={() => setSelectedOrder(undefined)} className="px-4 py-2 hover:bg-surface rounded-lg transition-colors font-bold text-[12px]">✕</button>
            </div>
            <div className="p-6 space-y-6 text-[12px]">
              <div className="space-y-3">
                <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Status: {selectedOrder.status.toUpperCase()}</h3>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Items</h3>
                <div className="space-y-2 bg-surface rounded-xl p-4">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-border-custom last:border-0">
                      <div><p className="font-bold text-text">{item.product?.name || 'Product'}</p><p className="text-[10px] text-text3">Quantity: {item.quantity}</p></div>
                      <p className="font-black">₹{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3">Delivery Information</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-border-custom">
                  <p className="text-text font-medium">{selectedOrder.deliveryAddress}</p>
                </div>
              </div>
              <div className="bg-brand text-white p-4 rounded-xl flex justify-between items-center font-black">
                <span className="uppercase text-[11px]">Total Paid</span>
                <span className="text-xl">₹{selectedOrder.total}</span>
              </div>
            </div>
            <div className="p-6 bg-surface">
              <button onClick={() => setSelectedOrder(undefined)} className="w-full bg-white border border-border-custom py-3 rounded-xl font-black text-[12px] uppercase">Close</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
