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
  marketValue?: number;
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
  const [cows, setCows] = useState<any[]>([]);
  const [formData, setFormData] = useState<Asset>({
    name: '',
    category: 'Cow',
    purchaseDate: new Date().toISOString().split('T')[0],
    value: 0,
    marketValue: 0,
    status: 'ACTIVE',
    serialNumber: '',
    location: '',
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/herds').then(res => {
        const allCows = res.data.herds || res.data || [];
        setCows(allCows.filter((c: any) => c.status !== 'DISPOSED'));
      }).catch(err => console.error("Error fetching herds in AssetModal:", err));
    }
  }, [isOpen]);

  const [customLocation, setCustomLocation] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);

  useEffect(() => {
    if (asset) {
      setFormData({
        ...asset,
        purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0],
        marketValue: asset.marketValue ?? asset.value
      });
      if (asset.location && asset.location !== 'Halasahalli' && asset.location !== 'JP Nagar') {
        setIsCustomLocation(true);
        setCustomLocation(asset.location);
      } else {
        setIsCustomLocation(false);
        setCustomLocation('');
      }
    } else {
      setFormData({
        name: '',
        category: 'Cow',
        purchaseDate: new Date().toISOString().split('T')[0],
        value: 0,
        marketValue: 0,
        status: 'ACTIVE',
        serialNumber: '',
        location: '',
      });
      setIsCustomLocation(false);
      setCustomLocation('');
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
            {formData.category === 'Cow' ? (
              <select
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.serialNumber}
                onChange={(e) => {
                  const selectedTag = e.target.value;
                  const selectedCow = cows.find(c => c.tagNumber === selectedTag);
                  setFormData({
                    ...formData,
                    name: selectedCow ? `${selectedCow.animalName || 'Cow'} (${selectedCow.tagNumber})` : '',
                    serialNumber: selectedTag,
                    purchaseDate: selectedCow?.procuredDate ? selectedCow.procuredDate.split('T')[0] : formData.purchaseDate
                  });
                }}
              >
                <option value="">Select a Cow from Herd...</option>
                {cows.map((cow) => (
                  <option key={cow.id} value={cow.tagNumber}>
                    {cow.animalName || 'Unnamed'} ({cow.tagNumber})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Category</label>
              <select
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Cow">Cow</option>
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
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Purchase Cost (₹)</label>
              <input
                type="number"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Market Value (₹)</label>
              <input
                type="number"
                required
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.marketValue}
                onChange={(e) => setFormData({ ...formData, marketValue: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-xs font-bold text-text3 uppercase mb-1">Serial Number</label>
              <input
                type="text"
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text3 uppercase mb-1">Location</label>
            <select
              className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand mb-2"
              value={isCustomLocation ? 'OTHER' : (formData.location || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'OTHER') {
                  setIsCustomLocation(true);
                  setFormData({ ...formData, location: customLocation });
                } else {
                  setIsCustomLocation(false);
                  setFormData({ ...formData, location: val });
                }
              }}
            >
              <option value="">Select Location</option>
              <option value="Halasahalli">Halasahalli</option>
              <option value="JP Nagar">JP Nagar</option>
              <option value="OTHER">Other / Custom Location</option>
            </select>

            {isCustomLocation && (
              <input
                type="text"
                required
                placeholder="Enter custom location"
                className="w-full bg-surface2 border border-border-custom rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand animate-in slide-in-from-top-1 duration-200"
                value={customLocation}
                onChange={(e) => {
                  setCustomLocation(e.target.value);
                  setFormData({ ...formData, location: e.target.value });
                }}
              />
            )}
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
