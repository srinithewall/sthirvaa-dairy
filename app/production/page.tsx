'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Droplets, Plus, FlaskConical } from 'lucide-react';

interface Production {
  id: number;
  itemName: string;
  quantity: number;
  unit: string;
  productionDate: string;
}

export default function ProductionPage() {
  const [records, setRecords] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduction();
  }, []);

  const fetchProduction = async () => {
    try {
      const res = await api.get('/production');
      setRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Daily Production</h1>
          <p className="text-[13px] text-text3 mt-1">Logging daily yield (Increases Inventory Stock)</p>
        </div>
        <button className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm">
          <Plus size={16} />
          <span>Log Yield</span>
        </button>
      </div>

      <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[#F5F9F6] text-text2 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Item Produced</th>
                <th className="p-4">Quantity</th>
                <th className="p-4">Unit</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-text3">Fetching production logs...</td></tr>
              ) : records.map((record) => (
                <tr key={record.id} className="border-b border-border-custom hover:bg-surface2 transition-colors last:border-0">
                  <td className="p-4 text-text3">{record.productionDate}</td>
                  <td className="p-4 font-bold text-brand-dark">{record.itemName}</td>
                  <td className="p-4 font-bold">{record.quantity}</td>
                  <td className="p-4 text-text3">{record.unit}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-brand">
                      <FlaskConical size={12}/> Verified
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
