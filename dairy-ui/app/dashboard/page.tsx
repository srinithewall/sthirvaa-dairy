'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { ShoppingCart, Droplets, DollarSign, TrendingUp, ChevronDown, Search, Check, Calendar } from 'lucide-react';
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

const getTodayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getPastDateString = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Daily Milk Production states
  const [cows, setCows] = useState<any[]>([]);
  const [milkRecords, setMilkRecords] = useState<any[]>([]);
  const [selectedCowIds, setSelectedCowIds] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [cowSearchQuery, setCowSearchQuery] = useState('');

  // Date range states
  const [startDate, setStartDate] = useState(getPastDateString(30));
  const [endDate, setEndDate] = useState(getTodayDateString());

  useEffect(() => {
    fetchDashboardData();
    fetchCowsAndRecords();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.cow-selector-container')) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showFilterDropdown]);

  const fetchCowsAndRecords = async () => {
    try {
      const [cowsRes, recordsRes] = await Promise.all([
        api.get('/herds'),
        api.get('/milk-records')
      ]);
      const allCows = cowsRes.data.herds || cowsRes.data || [];
      setCows(allCows.filter((c: any) => c.status?.toUpperCase() !== 'DISPOSED' && c.animalStatus?.toUpperCase() !== 'CALF'));
      setMilkRecords(recordsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch cows or milk records for daily chart:", err);
    }
  };

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

  // Daily Milk Production chart processing
  const COLORS = [
    '#2D6A4F', // Brand green
    '#3498db', // Blue
    '#9b59b6', // Purple
    '#e67e22', // Orange
    '#1abc9c', // Teal
    '#e74c3c', // Red
    '#2c3e50', // Dark Slate
    '#f1c40f', // Yellow/Gold
    '#d35400', // Rust
    '#27ae60', // Emerald
  ];

  // Filter milk records by date range
  const filteredRecordsByDateRange = milkRecords.filter(r => {
    return (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate);
  });

  const uniqueDates = Array.from(new Set(filteredRecordsByDateRange.map(r => r.date))).sort();
  const chartDates = uniqueDates;

  const dailyProductionDatasets: any[] = [];

  if (selectedCowIds.length === 0) {
    const dataPoints = chartDates.map(date => {
      return filteredRecordsByDateRange
        .filter(r => r.date === date)
        .reduce((sum, r) => sum + (r.quantity || 0), 0);
    });

    dailyProductionDatasets.push({
      label: 'All Cows (Total Yield)',
      data: dataPoints.map(v => Math.round(v * 10) / 10),
      borderColor: '#2D6A4F',
      backgroundColor: 'rgba(45, 106, 79, 0.08)',
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#2D6A4F',
      pointHoverRadius: 6,
    });
  } else {
    selectedCowIds.forEach((cowId, index) => {
      const cow = cows.find(c => String(c.id) === String(cowId));
      const label = cow ? `${cow.animalName || 'Cow'} (${cow.tagNumber})` : `Cow #${cowId}`;
      const color = COLORS[index % COLORS.length];

      const dataPoints = chartDates.map(date => {
        return filteredRecordsByDateRange
          .filter(r => r.date === date && String(r.herd?.id) === String(cowId))
          .reduce((sum, r) => sum + (r.quantity || 0), 0);
      });

      dailyProductionDatasets.push({
        label,
        data: dataPoints.map(v => Math.round(v * 10) / 10),
        borderColor: color,
        backgroundColor: 'transparent',
        tension: 0.3,
        fill: false,
        pointBackgroundColor: color,
        pointHoverRadius: 6,
      });
    });
  }

  const dailyProductionChartData = {
    labels: chartDates.map(date => {
      const [year, month, day] = date.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }),
    datasets: dailyProductionDatasets
  };

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 8,
          usePointStyle: true,
          font: { size: 11 }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const cleanedLabel = label.split(' (')[0];
            return ` ${cleanedLabel}: ${context.raw} L`;
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        title: {
          display: true,
          text: 'Liters',
          font: { size: 10, weight: 'bold' }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  const filteredCowsForDropdown = cows.filter(cow => {
    const search = cowSearchQuery.toLowerCase();
    const name = (cow.animalName || '').toLowerCase();
    const tag = (cow.tagNumber || '').toLowerCase();
    return name.includes(search) || tag.includes(search);
  });

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

      {/* Daily Milk Production Line Chart Card */}
      <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[14px] font-bold text-text">Daily Milk Production</h3>
            <p className="text-[11px] text-text3 mt-0.5">Historical production trends by individual cow or aggregated</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date Calendar Input */}
            <div className="flex items-center gap-2 bg-white border border-border-custom px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar size={13} className="text-brand" />
              <span className="text-[10px] font-black text-text3 uppercase tracking-wider border-r pr-2 border-border-custom">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[11px] font-bold text-text bg-transparent focus:outline-none"
              />
            </div>

            {/* End Date Calendar Input */}
            <div className="flex items-center gap-2 bg-white border border-border-custom px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar size={13} className="text-brand" />
              <span className="text-[10px] font-black text-text3 uppercase tracking-wider border-r pr-2 border-border-custom">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[11px] font-bold text-text bg-transparent focus:outline-none"
              />
            </div>

            {/* Premium Selector dropdown */}
            <div className="cow-selector-container relative">
            <button 
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between gap-2.5 bg-white border border-border-custom px-4 py-2 rounded-xl text-[12px] font-bold text-text hover:border-brand hover:text-brand transition-all cursor-pointer shadow-sm min-w-[170px]"
            >
              <span>
                {selectedCowIds.length === 0 
                  ? 'All Cows' 
                  : selectedCowIds.length === 1 
                    ? (() => {
                        const c = cows.find(cow => String(cow.id) === String(selectedCowIds[0]));
                        return c ? `${c.animalName || 'Cow'} (${c.tagNumber})` : '1 Cow Selected';
                      })()
                    : `${selectedCowIds.length} Cows Selected`
                }
              </span>
              <ChevronDown size={14} className={`text-text3 transition-transform ${showFilterDropdown ? 'rotate-180 text-brand' : ''}`} />
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-border-custom rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative flex items-center">
                  <Search size={13} className="absolute left-3.5 text-text3" />
                  <input
                    type="text"
                    placeholder="Search by name or tag..."
                    value={cowSearchQuery}
                    onChange={(e) => setCowSearchQuery(e.target.value)}
                    className="w-full border border-border-custom rounded-xl pl-9 pr-3 py-1.5 text-[12px] text-text focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-text3"
                  />
                </div>

                <div className="flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-wider">
                  <button 
                    onClick={() => setSelectedCowIds([])}
                    className="text-brand hover:underline font-bold"
                  >
                    All Cows (Clear)
                  </button>
                  <button 
                    onClick={() => setSelectedCowIds(cows.map(c => String(c.id)))}
                    className="text-brand hover:underline font-bold"
                  >
                    Select All
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {filteredCowsForDropdown.map(cow => {
                    const isSelected = selectedCowIds.includes(String(cow.id));
                    return (
                      <div 
                        key={cow.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCowIds(selectedCowIds.filter(id => id !== String(cow.id)));
                          } else {
                            setSelectedCowIds([...selectedCowIds, String(cow.id)]);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg hover:bg-surface/50 cursor-pointer transition-colors ${isSelected ? 'bg-surface/30' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded bg-brand/10 text-brand flex items-center justify-center text-[10px] font-bold">
                            {isSelected ? <Check size={12} strokeWidth={3} className="text-brand-dark" /> : '🐄'}
                          </div>
                          <div>
                            <span className="text-[12px] font-bold text-text block leading-none">{cow.animalName || 'Unnamed'}</span>
                            <span className="text-[9px] text-text3 font-mono opacity-80 mt-0.5">{cow.tagNumber}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 rounded border-gray-300 text-brand focus:ring-brand cursor-pointer"
                        />
                      </div>
                    );
                  })}
                  {filteredCowsForDropdown.length === 0 && (
                    <div className="p-4 text-center text-[11px] text-text3 italic">No cows match your search.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        <div className="h-[280px]">
          {milkRecords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text3 italic text-[13px] gap-2 bg-surface/10 rounded-xl border border-dashed border-border-custom">
              <span>🥛 No milk records found to display trends.</span>
            </div>
          ) : (
            <Line 
              data={dailyProductionChartData} 
              options={dailyChartOptions} 
            />
          )}
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
