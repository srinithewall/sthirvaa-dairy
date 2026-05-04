'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';

interface InventoryItem {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: InventoryItem | null;
}

export default function InventoryModal({ isOpen, onClose, onSuccess, item }: InventoryModalProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<InventoryItem>({
    itemName: '',
    quantity: 0,
    unit: 'KG',
    reorderLevel: 10,
  });

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({
        itemName: '',
        quantity: 0,
        unit: 'KG',
        reorderLevel: 10,
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item?.id) {
        await api.put(`/inventory/${item.id}`, formData);
        showToast('Inventory item updated successfully', 'success');
      } else {
        await api.post('/inventory', formData);
        showToast('Inventory item added successfully', 'success');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving inventory:', err);
      showToast('Failed to save inventory item', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-brand-dark p-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold">{item ? 'Edit' : 'Add'} Inventory Item</h2>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Item Name</label>
            <input
              type="text"
              required
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Unit</label>
              <input
                type="text"
                required
                placeholder="e.g. KG, Liters, Bags"
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Reorder Level</label>
            <input
              type="number"
              step="0.01"
              required
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              value={formData.reorderLevel}
              onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) })}
            />
          </div>
          <div className="pt-4 flex gap-3">
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
              {item ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
