'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

interface Asset {
  id?: number;
  name: string;
  category: string;
  purchaseDate: string;
  value: number;
  status: string;
  serialNumber: string;
  location: string;
}

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset?: Asset | null;
}

export default function AssetModal({ isOpen, onClose, onSuccess, asset }: AssetModalProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Asset>({
    name: '',
    category: 'Equipment',
    purchaseDate: new Date().toISOString().split('T')[0],
    value: 0,
    status: 'ACTIVE',
    serialNumber: '',
    location: '',
  });

  useEffect(() => {
    if (asset) {
      setFormData({
        ...asset,
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({
        name: '',
        category: 'Equipment',
        purchaseDate: new Date().toISOString().split('T')[0],
        value: 0,
        status: 'ACTIVE',
        serialNumber: '',
        location: '',
      });
    }
  }, [asset, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (asset?.id) {
        await api.put(`/assets/${asset.id}`, formData);
        showToast('Asset updated successfully', 'success');
      } else {
        await api.post('/assets', formData);
        showToast('Asset added successfully', 'success');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving asset:', err);
      showToast('Failed to save asset', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-brand-dark p-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold">{asset ? 'Edit' : 'Add'} Asset</h2>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Asset Name</label>
            <input
              type="text"
              required
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Category</label>
              <select
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Equipment">Equipment</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Land">Land</option>
                <option value="Building">Building</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Status</label>
              <select
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="DISPOSED">Disposed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Value (₹)</label>
              <input
                type="number"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Purchase Date</label>
              <input
                type="date"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Serial Number</label>
            <input
              type="text"
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              value={formData.serialNumber}
              onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Location</label>
            <input
              type="text"
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="pt-4 flex gap-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface2 text-text font-bold py-2 rounded-lg hover:bg-border-custom transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand text-white font-bold py-2 rounded-lg hover:bg-brand-dark transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {asset ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
