'use client';

import React, { useState, useEffect } from 'react';
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
import api from '@/lib/api';

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

import Link from 'next/link';

interface TopMilker {
  cowId: string;
  cowName: string;
  morningYield: number;
  eveningYield: number;
  totalYield: number;
}

interface DashboardData {
  todayMilkProduction: number;
  yesterdayMilkProduction: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayExpense: number;
  yesterdayExpense: number;
  currentMonthProfit: number;
  productionChartData: Record<string, number>;
  revenueChartData: Record<string, number>;
  expenseChartData: Record<string, number>;
  topMilkers: TopMilker[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err?.response?.data?.message || `Server error (${err?.response?.status ?? 'network'}). Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-dark"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-text">Dashboard Unavailable</h2>
          <p className="text-sm text-text3 max-w-sm text-center">{error || 'No data returned from server.'}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition-all"
          >
            Retry
          </button>
        </div>
      </AppLayout>
    );
  }

  const productionTrend = Math.round((data.todayMilkProduction - data.yesterdayMilkProduction) * 100) / 100;
  const revenueTrend = Math.round((data.todayRevenue - data.yesterdayRevenue) * 100) / 100;
  const expenseTrend = Math.round((data.todayExpense - data.yesterdayExpense) * 100) / 100;

  const prodChartData = {
    labels: Object.keys(data.productionChartData),
    datasets: [{
      label: 'Liters',
      data: Object.values(data.productionChartData),
      backgroundColor: '#52B788',
      borderRadius: 4
    }]
  };

  const finChartData = {
    labels: Object.keys(data.revenueChartData),
    datasets: [
      {
        label: 'Revenue',
        data: Object.values(data.revenueChartData),
        borderColor: '#2D6A4F',
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(45,106,79,0.05)'
      },
      {
        label: 'Expense',
        data: Object.values(data.expenseChartData),
        borderColor: '#F7B731',
        tension: 0.4,
        pointStyle: 'circle'
      }
    ]
  };

  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Dashboard Overview</h1>
          <p className="text-[13px] text-text3 mt-1">{todayStr} · Sthirvaa Farms</p>
        </div>
        <div className="flex gap-2.5">
          <Link href="/production" className="bg-accent text-brand-dark flex items-center gap-2 py-2 px-4 rounded-radius-custom font-semibold text-[13px] hover:bg-accent-dark transition-all shadow-sm">
            <PlusIcon />
            <span>Milk Entry</span>
          </Link>
          <Link href="/sales" className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm">
            <PlusIcon />
            <span>Sale</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          label="Milk Production" 
          value={`${data.todayMilkProduction} L`} 
          trend={`${parseFloat(Math.abs(productionTrend).toFixed(1))}L vs yesterday`} 
          trendType={productionTrend >= 0 ? "up" : "down"} 
          icon="🥛" 
          variant={productionTrend >= 0 ? "green" : "red"}
        />
        <StatCard 
          label="Today Revenue" 
          value={`₹${data.todayRevenue}`} 
          trend={`₹${parseFloat(Math.abs(revenueTrend).toFixed(2))} ${revenueTrend >= 0 ? 'more' : 'less'}`} 
          trendType={revenueTrend >= 0 ? "up" : "down"} 
          icon="💵" 
          variant="blue"
        />
        <StatCard 
          label="Today Expense" 
          value={`₹${data.todayExpense}`} 
          trend={`₹${parseFloat(Math.abs(expenseTrend).toFixed(2))} vs yesterday`} 
          trendType={expenseTrend <= 0 ? "down" : "up"} 
          icon="💸" 
          variant="amber"
        />
        <StatCard 
          label="Net Profit" 
          value={`₹${data.currentMonthProfit}`} 
          icon="📈"
          variant={data.currentMonthProfit >= 0 ? "green" : "red"}
          subValue="Current Month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold text-text">Milk Production — 14 Days</h3>
          </div>
          <div className="h-[200px]">
            <Bar 
              data={prodChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { min: 0 } }
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
              data={finChartData} 
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
               {data.topMilkers.map((cow, i) => (
                 <tr key={i} className="border-b border-border-custom/50 last:border-0">
                   <td className="p-3"><strong className="text-brand">{cow.cowId}</strong> {cow.cowName}</td>
                   <td className="p-3">{cow.morningYield}L</td>
                   <td className="p-3">{cow.eveningYield}L</td>
                   <td className="p-3 font-bold text-brand-dark">{cow.totalYield}L</td>
                 </tr>
               ))}
               {data.topMilkers.length === 0 && (
                 <tr>
                   <td colSpan={4} className="p-4 text-center text-text3 italic">No milk recorded today yet.</td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
