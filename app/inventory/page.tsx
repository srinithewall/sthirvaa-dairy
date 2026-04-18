'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Package, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InventoryItem {
  id: number;
  itemName: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch inventory', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Inventory Management</h1>
          <p className="text-[13px] text-text3 mt-1">Real-time stock of yield, feed, and supplies</p>
        </div>
        <button className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all">
          <Plus size={16} />
          <span>Update Stock</span>
        </button>
      </div>

      {items.some(i => i.quantity < i.reorderLevel) && (
        <div className="bg-[#FEF6E0] border border-orange-200 p-3.5 rounded-radius-custom mb-5 flex gap-3 text-[13px] text-[#7a4e08]">
          <AlertTriangle size={20} className="text-warn flex-shrink-0" />
          <div>
            <strong>Low Stock Alert:</strong> Some items are below critical levels. Please check the list below.
          </div>
        </div>
      )}

      <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface2 border-bottom border-border-custom2">
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider">Item</th>
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider">Current Stock</th>
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider">Unit</th>
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider">Min Level</th>
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider">Status</th>
                <th className="p-3 font-bold text-text2 uppercase text-[11px] tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan={6} className="p-8 text-center text-text3">Fetching latest inventory...</td></tr>
              ) : items.map((item) => {
                const isLow = item.quantity < item.reorderLevel;
                return (
                  <tr key={item.id} className="hover:bg-surface2 transition-colors border-b border-border-custom last:border-0">
                    <td className="p-3 font-bold text-text">{item.itemName}</td>
                    <td className={`p-3 font-bold ${isLow ? 'text-danger' : 'text-text'}`}>
                      {item.quantity}
                    </td>
                    <td className="p-3 text-text3">{item.unit}</td>
                    <td className="p-3 text-text3">{item.reorderLevel} {item.unit}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${isLow ? 'bg-red-50 text-danger' : 'bg-green-50 text-brand'}`}>
                        {isLow ? <><AlertTriangle size={12}/> Low</> : <><CheckCircle2 size={12}/> OK</>}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-brand hover:underline font-semibold">Restock</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
