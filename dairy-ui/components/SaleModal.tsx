'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, User, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

interface Customer {
  id: number;
  name: string;
}

interface Sale {
  id?: number;
  itemName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  date: string;
  paymentStatus: string;
  customer: { id: number };
}

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sale?: Sale | null;
}

export default function SaleModal({ isOpen, onClose, onSuccess, sale }: SaleModalProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState<any>({
    itemName: 'Milk',
    quantity: 0,
    price: 0,
    totalAmount: 0,
    date: new Date().toISOString().split('T')[0],
    paymentStatus: 'PAID',
    customerId: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (sale) {
      setFormData({
        ...sale,
        customerId: sale.customer?.id || '',
        date: sale.date || new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData({
        itemName: 'Milk',
        quantity: 0,
        price: 0,
        totalAmount: 0,
        date: new Date().toISOString().split('T')[0],
        paymentStatus: 'PAID',
        customerId: '',
      });
    }
  }, [sale, isOpen]);

  // Auto-calculate total amount
  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.price) || 0;
    setFormData((prev: any) => ({ ...prev, totalAmount: qty * price }));
  }, [formData.quantity, formData.price]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      showToast('Please select a customer', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        customer: { id: parseInt(formData.customerId) }
      };

      if (sale?.id) {
        await api.put(`/sales/${sale.id}`, payload);
        showToast('Sale updated successfully', 'success');
      } else {
        await api.post('/sales', payload);
        showToast('New sale recorded successfully', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving sale:', err);
      showToast(err.response?.data?.message || 'Failed to record sale', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-brand-dark p-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag size={20} />
            {sale ? 'Edit' : 'Record'} Sale
          </h2>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Customer</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <select
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-brand appearance-none"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              >
                <option value="">Select a Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Product</label>
              <select
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              >
                <option value="Milk">Milk</option>
                <option value="Dung">Dung (Manure)</option>
                <option value="Calf">Calf</option>
                <option value="Grass">Grass/Feed</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Date</label>
              <input
                type="date"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Price per Unit (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-surface2 p-3 rounded-lg border border-border-custom flex justify-between items-center">
            <span className="text-xs font-bold text-text3 uppercase">Total Amount</span>
            <span className="text-lg font-black text-brand">₹{formData.totalAmount.toLocaleString()}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Payment Status</label>
            <div className="flex gap-4">
              {['PAID', 'PENDING'].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentStatus"
                    value={status}
                    checked={formData.paymentStatus === status}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="accent-brand"
                  />
                  <span className={`text-[13px] font-bold ${formData.paymentStatus === status ? 'text-brand' : 'text-text3'}`}>
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface2 text-text font-bold py-2 rounded-lg hover:bg-border-custom transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand text-white font-bold py-2 rounded-lg hover:bg-brand-dark transition-all flex items-center justify-center gap-2 text-sm shadow-md"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {sale ? 'Update' : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
