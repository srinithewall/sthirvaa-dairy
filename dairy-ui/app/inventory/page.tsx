'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Package, Plus, AlertTriangle, CheckCircle2, Pencil, Trash2, Search, Box, Construction, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

export default function InventoryPage() {
  const { showToast, confirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'inventory' | 'assets'>('inventory');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [herds, setHerds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [assetSort, setAssetSort] = useState<{ key: 'purchaseDate' | 'value' | 'marketValue', direction: 'asc' | 'desc' } | null>(null);

  const handleAssetSort = (key: 'purchaseDate' | 'value' | 'marketValue') => {
    setAssetSort(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'desc' };
    });
  };


  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const res = await api.get('/inventory');
        setItems(res.data);
      } else {
        const [assetsRes, herdsRes] = await Promise.all([
          api.get('/assets'),
          api.get('/herds')
        ]);
        setAssets(assetsRes.data || []);
        const allHerds = herdsRes.data.herds || herdsRes.data || [];
        setHerds(allHerds);
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
    item.itemName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssets = assets.filter(asset => {
    // Exclude if asset status is DISPOSED
    if (asset.status === 'DISPOSED') return false;

    // Check linked herd: if category is 'Cow' and matches a disposed herd, exclude it
    if (asset.category === 'Cow' && asset.serialNumber) {
      const linkedHerd = herds.find(h => h.tagNumber === asset.serialNumber);
      if (linkedHerd && linkedHerd.status === 'DISPOSED') {
        return false;
      }
    }

    const matchesSearch = asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          asset.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || asset.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (assetSort) {
      const { key, direction } = assetSort;
      if (key === 'purchaseDate') {
        const dateA = a.purchaseDate || '';
        const dateB = b.purchaseDate || '';
        return direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      if (key === 'value') {
        const valA = a.value || 0;
        const valB = b.value || 0;
        return direction === 'asc' ? valA - valB : valB - valA;
      }
      if (key === 'marketValue') {
        // use marketValue if present, else fallback to purchase cost (value)
        const valA = (a.marketValue ?? a.value) || 0;
        const valB = (b.marketValue ?? b.value) || 0;
        return direction === 'asc' ? valA - valB : valB - valA;
      }
    }
    const dateA = a.purchaseDate || '';
    const dateB = b.purchaseDate || '';
    return dateB.localeCompare(dateA);
  });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Inventory Management</h1>
          <p className="text-[13px] text-text3 mt-1">Real-time stock and asset tracking</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab === 'assets' && (
            <select
              className="bg-white border border-border-custom rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-brand"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="Cow">Cow</option>
              <option value="Equipment">Equipment</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Land">Land</option>
              <option value="Building">Building</option>
              <option value="Other">Other</option>
            </select>
          )}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-9 pr-4 py-2 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand"
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
            className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm active:scale-95 whitespace-nowrap"
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

      {activeTab === 'assets' && (
        <div className="bg-[#E8F5EE] border border-brand/20 p-4 rounded-xl mb-5 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 text-brand rounded-lg">
              <Construction size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-brand-dark/70 uppercase tracking-widest block">Total Market Value</span>
              <span className="text-xl font-black text-brand-dark">
                ₹{filteredAssets.reduce((sum, a) => sum + (a.marketValue ?? a.value || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-text3 uppercase tracking-widest block">Assets Registered</span>
            <span className="text-sm font-extrabold text-text mt-0.5 block">{filteredAssets.length} Items</span>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && items.some(i => i.quantity < i.reorderLevel) && (
        <div className="bg-[#FEF6E0] border border-orange-200 p-3.5 rounded-lg mb-5 flex gap-3 text-[13px] text-[#7a4e08] animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="text-warn flex-shrink-0" />
          <div>
            <strong>Low Stock Alert:</strong> Some items are below critical levels. Please check the list below.
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden shadow-sm">
        <div>
          {activeTab === 'inventory' ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
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
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border-custom">
                {loading ? (
                  <div className="p-8 text-center text-text3">Loading inventory...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-text3 italic">No inventory items found.</div>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.quantity < item.reorderLevel;
                    return (
                      <div key={item.id} className="p-4 flex flex-col gap-3 hover:bg-surface2/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-text text-[14px]">{item.itemName}</div>
                            <div className="text-[11px] text-text3 mt-0.5">Min level: {item.reorderLevel} {item.unit}</div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isLow ? 'bg-red-50 text-danger border border-danger/10' : 'bg-green-50 text-brand border border-brand/10'}`}>
                            {isLow ? <><AlertTriangle size={10}/> Low</> : <><CheckCircle2 size={10}/> OK</>}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-surface p-2.5 rounded-lg border border-border-custom text-[12px]">
                          <div>
                            <span className="text-text3 block text-[9px] uppercase font-bold tracking-wider">Current Stock</span>
                            <span className={`font-black text-sm ${isLow ? 'text-danger' : 'text-text'}`}>
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setSelectedItem(item);
                                setIsInventoryModalOpen(true);
                              }}
                              className="p-2 text-text3 hover:text-brand bg-white border border-border-custom rounded-lg transition-colors shadow-sm"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            <button 
                              onClick={() => handleDeleteInventory(item.id)}
                              className="p-2 text-text3 hover:text-danger bg-white border border-border-custom rounded-lg transition-colors shadow-sm"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface2 border-b border-border-custom">
                      <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider">Asset Name</th>
                      <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider">Category</th>
                      <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Status</th>
                      <th 
                        className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center cursor-pointer hover:text-brand transition-colors select-none group"
                        onClick={() => handleAssetSort('purchaseDate')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Purchase Date
                          {assetSort?.key === 'purchaseDate' ? (
                            assetSort.direction === 'asc' ? <ArrowUp size={12} className="text-brand" /> : <ArrowDown size={12} className="text-brand" />
                          ) : <ArrowDown size={12} className="opacity-0 group-hover:opacity-30" />}
                        </div>
                      </th>
                      <th 
                        className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center cursor-pointer hover:text-brand transition-colors select-none group"
                        onClick={() => handleAssetSort('value')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Purchase Cost
                          {assetSort?.key === 'value' ? (
                            assetSort.direction === 'asc' ? <ArrowUp size={12} className="text-brand" /> : <ArrowDown size={12} className="text-brand" />
                          ) : <ArrowDown size={12} className="opacity-0 group-hover:opacity-30" />}
                        </div>
                      </th>
                      <th 
                        className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center cursor-pointer hover:text-brand transition-colors select-none group"
                        onClick={() => handleAssetSort('marketValue')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Market Value
                          {assetSort?.key === 'marketValue' ? (
                            assetSort.direction === 'asc' ? <ArrowUp size={12} className="text-brand" /> : <ArrowDown size={12} className="text-brand" />
                          ) : <ArrowDown size={12} className="opacity-0 group-hover:opacity-30" />}
                        </div>
                      </th>
                      <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-center">Location</th>
                      <th className="p-4 font-bold text-text3 uppercase text-[11px] tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                       <tr><td colSpan={8} className="p-8 text-center text-text3">Loading assets...</td></tr>
                    ) : filteredAssets.length === 0 ? (
                       <tr><td colSpan={8} className="p-8 text-center text-text3 italic">No assets found.</td></tr>
                    ) : filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-surface2 transition-colors border-b border-border-custom last:border-0">
                        <td className="p-4">
                          <div className="font-bold text-text">{asset.name}</div>
                          <div className="text-[11px] text-text3 font-mono">{asset.serialNumber || 'No Serial'}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-surface2 px-2 py-1 rounded text-text2 border border-border-custom font-semibold">
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
                        <td className="p-4 text-center text-text2 font-medium">
                          {formatDate(asset.purchaseDate) || 'N/A'}
                        </td>
                        <td className="p-4 text-center font-bold text-text2">₹{asset.value.toLocaleString()}</td>
                        <td className="p-4 text-center font-bold text-brand">₹{(asset.marketValue ?? asset.value).toLocaleString()}</td>
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
              </div>

              {/* Mobile Category Filter */}
              <div className="md:hidden px-4 py-3 bg-surface border-b border-border-custom flex items-center justify-between gap-4">
                <span className="text-[12px] font-bold text-text3 uppercase">Filter Category</span>
                <select
                  className="bg-white border border-border-custom rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-brand"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  <option value="Cow">Cow</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Land">Land</option>
                  <option value="Building">Building</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border-custom">
                {loading ? (
                  <div className="p-8 text-center text-text3">Loading assets...</div>
                ) : filteredAssets.length === 0 ? (
                  <div className="p-8 text-center text-text3 italic">No assets found.</div>
                ) : (
                  filteredAssets.map((asset) => (
                    <div key={asset.id} className="p-4 flex flex-col gap-3 hover:bg-surface2/30 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-text text-[14px]">{asset.name}</div>
                          <div className="text-[11px] text-text3 font-mono mt-0.5">{asset.serialNumber || 'No Serial'}</div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          asset.status === 'ACTIVE' ? 'bg-green-50 text-brand border border-brand/10' : 
                          asset.status === 'MAINTENANCE' ? 'bg-yellow-50 text-warn border border-warn/10' : 'bg-red-50 text-danger border border-danger/10'
                        }`}>
                          {asset.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[12px]">
                        <span className="bg-surface2 px-2 py-0.5 rounded text-text2 border border-border-custom font-semibold">
                          {asset.category}
                        </span>
                        <div className="flex items-center gap-3 text-text3 text-[11px]">
                          {asset.purchaseDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDate(asset.purchaseDate)}
                            </span>
                          )}
                          {asset.location && (
                            <span>📍 {asset.location}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center bg-surface p-2.5 rounded-lg border border-border-custom text-[12px] mt-1">
                        <div className="flex gap-4">
                          <div>
                            <span className="text-text3 block text-[9px] uppercase font-bold tracking-wider">Purchase Cost</span>
                            <span className="font-bold text-text2 text-xs">
                              ₹{asset.value.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-text3 block text-[9px] uppercase font-bold tracking-wider">Market Value</span>
                            <span className="font-black text-brand text-xs">
                              ₹{(asset.marketValue ?? asset.value).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setSelectedAsset(asset);
                              setIsAssetModalOpen(true);
                            }}
                            className="p-2 text-text3 hover:text-brand bg-white border border-border-custom rounded-lg transition-colors shadow-sm"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="p-2 text-text3 hover:text-danger bg-white border border-border-custom rounded-lg transition-colors shadow-sm"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
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
