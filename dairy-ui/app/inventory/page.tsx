'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Package, Plus, AlertTriangle, CheckCircle2, Pencil, Trash2, Search, Box, Construction } from 'lucide-react';
import { useNotification } from '@/components/NotificationContext';
import InventoryModal from '@/components/InventoryModal';
import AssetModal from '@/components/AssetModal';

interface InventoryItem {
  id: number;
  itemName: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}

interface Asset {
  id: number;
  name: string;
  category: string;
  purchaseDate: string;
  value: number;
  status: string;
  serialNumber: string;
  location: string;
}

export default function InventoryPage() {
  const { showToast, confirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'inventory' | 'assets'>('inventory');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const res = await api.get('/inventory');
        setItems(res.data);
      } else {
        const res = await api.get('/assets');
        setAssets(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInventory = async (id: number) => {
    confirm('Are you sure you want to delete this inventory item?', async () => {
      try {
        await api.delete(`/inventory/${id}`);
        showToast('Item deleted successfully', 'success');
        fetchData();
      } catch (err) {
        showToast('Failed to delete item', 'error');
      }
    }, 'danger');
  };

  const handleDeleteAsset = async (id: number) => {
    confirm('Are you sure you want to delete this asset?', async () => {
      try {
        await api.delete(`/assets/${id}`);
        showToast('Asset deleted successfully', 'success');
        fetchData();
      } catch (err) {
        showToast('Failed to delete asset', 'error');
      }
    }, 'danger');
  };

  const filteredItems = items.filter(item => 
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Inventory Management</h1>
          <p className="text-[13px] text-text3 mt-1">Real-time stock and asset tracking</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              className="pl-9 pr-4 py-2 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              if (activeTab === 'inventory') {
                setSelectedItem(null);
                setIsInventoryModalOpen(true);
              } else {
                setSelectedAsset(null);
                setIsAssetModalOpen(true);
              }
            }}
            className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm"
          >
            <Plus size={16} />
            <span>Add {activeTab === 'inventory' ? 'Item' : 'Asset'}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border-custom">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 px-4 text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'inventory' ? 'text-brand border-b-2 border-brand' : 'text-text3 hover:text-text'
          }`}
        >
          <Box size={16} />
          Stock Items
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`pb-3 px-4 text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'assets' ? 'text-brand border-b-2 border-brand' : 'text-text3 hover:text-text'
          }`}
        >
          <Construction size={16} />
          Assets
        </button>
      </div>

      {activeTab === 'inventory' && items.some(i => i.quantity < i.reorderLevel) && (
        <div className="bg-[#FEF6E0] border border-orange-200 p-3.5 rounded-lg mb-5 flex gap-3 text-[13px] text-[#7a4e08] animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="text-warn flex-shrink-0" />
          <div>
            <strong>Low Stock Alert:</strong> Some items are below critical levels. Please check the list below.
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {activeTab === 'inventory' ? (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface2 border-b border-border-custom">
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider">Item</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Current Stock</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Unit</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Min Level</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Status</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={6} className="p-8 text-center text-text3">Loading inventory...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-text3 italic">No inventory items found.</td></tr>
                ) : filteredItems.map((item) => {
                  const isLow = item.quantity < item.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-surface2 transition-colors border-b border-border-custom last:border-0">
                      <td className="p-4 font-bold text-text">{item.itemName}</td>
                      <td className={`p-4 text-center font-bold ${isLow ? 'text-danger' : 'text-text'}`}>
                        {item.quantity}
                      </td>
                      <td className="p-4 text-center text-text2">{item.unit}</td>
                      <td className="p-4 text-center text-text2">{item.reorderLevel} {item.unit}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${isLow ? 'bg-red-50 text-danger' : 'bg-green-50 text-brand'}`}>
                          {isLow ? <><AlertTriangle size={12}/> Low</> : <><CheckCircle2 size={12}/> OK</>}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedItem(item);
                              setIsInventoryModalOpen(true);
                            }}
                            className="p-1.5 text-text3 hover:text-brand transition-colors"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteInventory(item.id)}
                            className="p-1.5 text-text3 hover:text-danger transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface2 border-b border-border-custom">
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider">Asset Name</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider">Category</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Status</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Value</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Location</th>
                  <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={6} className="p-8 text-center text-text3">Loading assets...</td></tr>
                ) : filteredAssets.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-text3 italic">No assets found.</td></tr>
                ) : filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-surface2 transition-colors border-b border-border-custom last:border-0">
                    <td className="p-4">
                      <div className="font-bold text-text">{asset.name}</div>
                      <div className="text-[11px] text-text3 font-mono">{asset.serialNumber || 'No Serial'}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-surface2 px-2 py-1 rounded text-text2 border border-border-custom">
                        {asset.category}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${
                        asset.status === 'ACTIVE' ? 'bg-green-50 text-brand' : 
                        asset.status === 'MAINTENANCE' ? 'bg-yellow-50 text-warn' : 'bg-red-50 text-danger'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-brand">₹{asset.value.toLocaleString()}</td>
                    <td className="p-4 text-center text-text2">{asset.location || 'N/A'}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIsAssetModalOpen(true);
                          }}
                          className="p-1.5 text-text3 hover:text-brand transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1.5 text-text3 hover:text-danger transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InventoryModal 
        isOpen={isInventoryModalOpen} 
        onClose={() => setIsInventoryModalOpen(false)} 
        onSuccess={fetchData}
        item={selectedItem}
      />

      <AssetModal 
        isOpen={isAssetModalOpen} 
        onClose={() => setIsAssetModalOpen(false)} 
        onSuccess={fetchData}
        asset={selectedAsset}
      />
    </AppLayout>
  );
}
