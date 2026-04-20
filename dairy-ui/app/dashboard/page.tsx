'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { ShoppingCart, Droplets, DollarSign, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Dashboard Overview</h1>
          <p className="text-[13px] text-text3 mt-1">Thursday, 16 April 2026 · Sthirvaa Farms (Shri Krishna Farm)</p>
        </div>
        <div className="flex gap-2.5">
          <button className="bg-accent text-brand-dark flex items-center gap-2 py-2 px-4 rounded-radius-custom font-semibold text-[13px] hover:bg-accent-dark transition-all shadow-sm">
            <PlusIcon />
            <span>Milk Entry</span>
          </button>
          <button className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm">
            <PlusIcon />
            <span>Sale</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Milk Production" 
          value="76 L" 
          trend="4L vs yesterday" 
          trendType="up" 
          icon="🥛" 
          variant="green"
        />
        <StatCard 
          label="Today Revenue" 
          value="₹4,550" 
          trend="₹320 more" 
          trendType="up" 
          icon="💵" 
          variant="blue"
        />
        <StatCard 
          label="Today Expense" 
          value="₹7,750" 
          trend="₹650 (med)" 
          trendType="down" 
          icon="💸" 
          variant="amber"
          subValue="Due to Kamala treatment"
        />
        <StatCard 
          label="Net Profit" 
          value="-₹3,200" 
          icon="📈"
          variant="red"
          subValue="Monthly: +₹18,400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold text-text">Milk Production — 14 Days</h3>
          </div>
          <div className="h-[200px]">
            <Bar 
              data={productionData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { min: 60 } }
              }} 
            />
          </div>
        </div>

        <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold text-text">Revenue vs Expense — 6 Months</h3>
          </div>
          <div className="h-[200px]">
            <Line 
              data={financeData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true } } }
              }} 
            />
          </div>
        </div>
      </div>

      <div className="card-shadow bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden">
        <div className="p-4 border-b border-border-custom flex items-center justify-between">
          <h3 className="text-[14px] font-bold">Top Milkers Today</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-[#F5F9F6] text-text2 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="p-3">Cow</th>
                <th className="p-3">Morning</th>
                <th className="p-3">Evening</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody>
               <tr>
                 <td className="p-3"><strong className="text-brand">COW006</strong> Meenakshi</td>
                 <td className="p-3">12L</td>
                 <td className="p-3">10L</td>
                 <td className="p-3 font-bold text-brand-dark">22L</td>
               </tr>
               <tr>
                 <td className="p-3"><strong className="text-brand">COW001</strong> Lakshmi</td>
                 <td className="p-3">10L</td>
                 <td className="p-3">8L</td>
                 <td className="p-3 font-bold text-brand-dark">18L</td>
               </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const productionData = {
  labels: ['2','3','4','5','6','7','8','9','10','11','12','13','14','15 Apr'],
  datasets: [{
    label: 'Liters',
    data: [72,68,75,71,76,74,70,78,73,77,69,74,72,76],
    backgroundColor: '#52B788',
    borderRadius: 4
  }]
};

const financeData = {
  labels: ['Nov','Dec','Jan','Feb','Mar','Apr'],
  datasets: [
    {
      label: 'Revenue',
      data: [72000, 68000, 81000, 75000, 84000, 86450],
      borderColor: '#2D6A4F',
      tension: 0.4,
      fill: true,
      backgroundColor: 'rgba(45,106,79,0.05)'
    },
    {
      label: 'Expense',
      data: [58000, 61000, 65000, 60000, 68000, 71200],
      borderColor: '#F7B731',
      tension: 0.4,
      pointStyle: 'circle'
    }
  ]
};
