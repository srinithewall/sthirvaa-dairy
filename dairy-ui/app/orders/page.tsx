'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { MapPin, Phone, Mail, Clock, ChevronRight, CheckCircle, AlertCircle, Truck, Loader2, RefreshCw } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface Order {
  id: string;
  createdAt: string;
  deliveryDate?: string;
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  deliveryAddress: string;
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: Order['status'] }) {
  const cfg: Record<string, { bg: string; text: string; label: string; icon?: React.ReactNode }> = {
    PENDING:    { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    CONFIRMED:  { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Confirmed' },
    PROCESSING: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Processing', icon: <Clock size={12} /> },
    SHIPPED:    { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Shipped', icon: <Truck size={12} /> },
    DELIVERED:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Delivered', icon: <CheckCircle size={12} /> },
    CANCELLED:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
  };
  const c = cfg[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}

/* ─── Order Card ─── */
function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: (o: Order) => void }) {
  const date = new Date(order.createdAt).toLocaleDateString('en-IN');
  const itemTotal = order.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? order.total;

  return (
    <div className="bg-white border border-border-custom rounded-2xl shadow-md hover:shadow-lg transition-all p-6">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-border-custom">
        <div>
          <h3 className="font-black text-[13px] text-text tracking-tight">{order.id}</h3>
          <p className="text-[11px] text-text3 mt-1">{date}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-2">Items ({order.items?.length ?? 0})</p>
        <div className="space-y-1">
          {(order.items ?? []).slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px]">
              <span className="text-text">{item.name}</span>
              <span className="text-text3">₹{item.price} × {item.quantity}</span>
            </div>
          ))}
          {(order.items?.length ?? 0) > 3 && (
            <p className="text-[10px] text-text3 italic">+{(order.items?.length ?? 0) - 3} more items</p>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between font-black text-[12px]">
          <span>Total</span>
          <span className="text-brand">₹{order.total.toFixed(0)}</span>
        </div>
      </div>

      {order.status === 'DELIVERED' && order.deliveryDate && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-[10px] font-bold text-green-700">
            ✓ Delivered on {new Date(order.deliveryDate).toLocaleDateString('en-IN')}
          </p>
        </div>
      )}

      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <p className="text-[10px] font-bold text-text3 uppercase mb-1.5">Delivery Address</p>
        <p className="text-[11px] text-text line-clamp-2">{order.deliveryAddress}</p>
      </div>

      <button onClick={() => onViewDetails(order)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-brand text-brand rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-brand hover:text-white transition-all">
        View Details <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ─── Order Detail Modal ─── */
function OrderDetailModal({ order, onClose }: { order?: Order; onClose: () => void }) {
  if (!order) return null;

  const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const currentIdx = statuses.indexOf(order.status);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border-custom bg-white">
          <div>
            <h2 className="font-black text-[14px] uppercase tracking-[0.15em]">{order.id}</h2>
            <p className="text-[11px] text-text3 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 hover:bg-surface rounded-lg transition-colors font-bold text-[12px]">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Timeline */}
          <div>
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3 mb-3">Order Timeline</h3>
            <div className="space-y-2">
              {statuses.map((s, idx) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] ${
                    idx < currentIdx ? 'bg-green-100 text-green-700' :
                    idx === currentIdx ? 'bg-brand text-white' : 'bg-surface text-text3'}`}>
                    {idx < currentIdx ? '✓' : idx + 1}
                  </div>
                  <p className={`font-bold text-[12px] ${idx <= currentIdx ? 'text-green-700' : 'text-text3'}`}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3 mb-3">Order Items</h3>
            <div className="bg-surface rounded-xl p-4 space-y-2">
              {(order.items ?? []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border-custom last:border-0">
                  <div>
                    <p className="font-bold text-[12px] text-text">{item.name}</p>
                    <p className="text-[10px] text-text3">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-black text-[12px] text-text">₹{(item.price * item.quantity).toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center justify-between font-black text-[14px]">
              <span>Total Amount</span>
              <span className="text-brand">₹{order.total.toFixed(0)}</span>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="font-bold text-[12px] uppercase tracking-wider text-text3 mb-3">Delivery Address</h3>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
              <div className="flex items-start gap-2 text-[12px]">
                <MapPin size={14} className="text-brand mt-0.5 flex-shrink-0" />
                <p className="text-text">{order.deliveryAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 border-t border-border-custom bg-surface flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 border border-border-custom rounded-xl font-black text-[12px] uppercase hover:bg-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Orders Page ─── */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('all');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);
  const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;
  const inTransitCount = orders.filter(o => ['SHIPPED', 'PROCESSING'].includes(o.status)).length;

  const STATUS_FILTERS = ['all', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">My Orders</h1>
          <p className="text-[12px] text-text3 mt-1 font-medium">Track and manage all your Sthirvaa shop purchases</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2.5 border border-border-custom rounded-xl font-bold text-[12px] hover:bg-surface transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: orders.length, color: 'text-text' },
          { label: 'Total Spent', value: `₹${totalSpent.toFixed(0)}`, color: 'text-brand' },
          { label: 'Delivered', value: deliveredCount, color: 'text-green-600' },
          { label: 'In Transit', value: inTransitCount, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border-custom rounded-2xl p-4 text-center shadow-md">
            <p className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status Filter chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUS_FILTERS.map(status => (
          <button key={status} onClick={() => setFilterStatus(status as any)}
            className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase whitespace-nowrap transition-all flex-shrink-0 ${
              filterStatus === status ? 'bg-brand text-white shadow-lg' : 'bg-surface text-text3 hover:bg-surface2'
            }`}>
            {status === 'all' ? 'All Orders' : status.charAt(0) + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Orders */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={36} className="animate-spin text-brand" />
          <p className="text-text3 text-[12px] font-medium">Fetching your orders...</p>
        </div>
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

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(undefined)} />
    </AppLayout>
  );
}
