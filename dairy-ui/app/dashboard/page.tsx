'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { ShoppingCart, Droplets, DollarSign, TrendingUp, ChevronDown, Search, Check, Calendar, Sun, Moon, Clock } from 'lucide-react';
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
import { Bar, Line, Pie } from 'react-chartjs-2';
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
  monthMilkProduction: number;
  totalMilkProduction: number;
  monthRevenue: number;
  totalRevenue: number;
  todayExpense: number;
  yesterdayExpense: number;
  monthExpense: number;
  totalExpense: number;
  todayProfit: number;
  currentMonthProfit: number;
  totalProfit: number;
  productionChartData: Record<string, number>;
  revenueChartData: Record<string, number>;
  expenseChartData: Record<string, number>;
  expensePieChartData: Record<string, number>;
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
  const [shiftFilter, setShiftFilter] = useState<'MORNING' | 'ALL' | 'EVENING'>('ALL');

  const [milkPeriod, setMilkPeriod] = useState<'daily'|'monthly'|'total'>('daily');
  const [revenuePeriod, setRevenuePeriod] = useState<'daily'|'monthly'|'total'>('monthly');
  const [expensePeriod, setExpensePeriod] = useState<'daily'|'monthly'|'total'>('monthly');
  const [profitPeriod, setProfitPeriod] = useState<'daily'|'monthly'|'total'>('monthly');
  
  // Modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [modalPeriod, setModalPeriod] = useState<'CURRENT_MONTH'|'LAST_2_MONTHS'|'LAST_3_MONTHS'|'ALL_TIME'>('CURRENT_MONTH');
  const [modalExpenses, setModalExpenses] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedPieCategory, setSelectedPieCategory] = useState<string | null>(null);

  useEffect(() => {
    if (showExpenseModal && modalExpenses.length === 0) {
      setModalLoading(true);
      api.get('/expenses').then(res => {
        setModalExpenses(res.data);
      }).catch(err => {
        console.error("Failed to load expenses for modal", err);
      }).finally(() => setModalLoading(false));
    }
  }, [showExpenseModal]);

  const finChartRef = React.useRef<any>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const profitLossPlugin = {
    id: 'profitLossOverlay',
    afterDraw: (chart: any) => {
      if (!overlayRef.current) return;
      try {
        const metaRev = chart.getDatasetMeta(0);
        const metaExp = chart.getDatasetMeta(1);
        if (!metaRev || !metaExp || !metaRev.data || !metaExp.data) return;
        
        const revData = chart.data.datasets[0].data;
        const expData = chart.data.datasets[1].data;
        
        let html = '';
        for (let i = 0; i < revData.length; i++) {
          const rev = revData[i] || 0;
          const exp = expData[i] || 0;
          const profit = rev - exp;
          if (profit === 0 && rev === 0) continue;
          
          let formattedProfit = '';
          if (profit > 0) {
            formattedProfit = '+' + (profit >= 1000 ? (profit/1000).toFixed(1).replace('.0', '') + 'k' : Math.round(profit));
          } else {
            formattedProfit = (profit <= -1000 ? (profit/1000).toFixed(1).replace('.0', '') + 'k' : Math.round(profit).toString());
          }
          
          if (metaRev.data[i] && metaExp.data[i]) {
            const x = metaRev.data[i].x;
            const y = Math.min(metaRev.data[i].y, metaExp.data[i].y) - 15;
            const color = profit > 0 ? '#2ECC71' : '#E74C3C';
            html += `<div class="absolute blink-node font-bold text-[11px] pointer-events-none" style="left: ${x}px; top: ${y}px; color: ${color}; transform: translateX(-50%); text-shadow: 0px 1px 2px rgba(255,255,255,0.8);">${formattedProfit}</div>`;
          }
        }
        overlayRef.current.innerHTML = html;
      } catch (e) {}
    }
  };

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
  const revenueTrend = Math.round(data.todayRevenue - data.yesterdayRevenue);
  const expenseTrend = Math.round(data.todayExpense - data.yesterdayExpense);

  const displayMilk = milkPeriod === 'monthly' ? (data.monthMilkProduction || 0) : milkPeriod === 'total' ? (data.totalMilkProduction || 0) : data.todayMilkProduction;
  const displayMilkLabel = milkPeriod === 'monthly' ? 'Month Milk Production' : milkPeriod === 'total' ? 'Total Milk Production' : 'Today Milk Production';
  
  const displayRev = revenuePeriod === 'monthly' ? (data.monthRevenue || 0) : revenuePeriod === 'total' ? (data.totalRevenue || 0) : data.todayRevenue;
  const displayRevLabel = revenuePeriod === 'monthly' ? 'Current Month Revenue' : revenuePeriod === 'total' ? 'Total Revenue' : 'Today Revenue';
  
  const displayExp = expensePeriod === 'monthly' ? (data.monthExpense || 0) : expensePeriod === 'total' ? (data.totalExpense || 0) : data.todayExpense;
  const displayExpLabel = expensePeriod === 'monthly' ? 'Current Month Expense' : expensePeriod === 'total' ? 'Total Expense' : 'Today Expense';
  
  const displayProfit = profitPeriod === 'monthly' ? (data.currentMonthProfit || 0) : profitPeriod === 'total' ? (data.totalProfit || 0) : (data.todayProfit || 0);
  const displayProfitLabel = profitPeriod === 'monthly' ? 'Month Net Profit' : profitPeriod === 'total' ? 'Total Net Profit' : 'Today Net Profit';

  // Modal logic
  const filteredModalExpenses = modalExpenses.filter(e => {
    if (modalPeriod === 'ALL_TIME') return true;
    const date = new Date(e.date);
    const now = new Date();
    if (modalPeriod === 'CURRENT_MONTH') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else if (modalPeriod === 'LAST_2_MONTHS') {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(now.getMonth() - 2);
      return date >= twoMonthsAgo;
    } else if (modalPeriod === 'LAST_3_MONTHS') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      return date >= threeMonthsAgo;
    }
    return true;
  });

  const modalPieDataMap = filteredModalExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const modalPieLabels = Object.keys(modalPieDataMap).sort((a, b) => modalPieDataMap[b] - modalPieDataMap[a]);
  const modalPieValues = modalPieLabels.map(label => modalPieDataMap[label]);

  const categoryExpenses = selectedPieCategory 
    ? filteredModalExpenses.filter(e => e.category === selectedPieCategory).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

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

  // Filter milk records by date range and shift (Morning, Evening, All Day)
  const filteredRecordsByDateRange = milkRecords.filter(r => {
    const matchesDate = (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate);
    if (!matchesDate) return false;
    if (shiftFilter === 'MORNING') return r.shift === 'MORNING';
    if (shiftFilter === 'EVENING') return r.shift === 'EVENING';
    return true;
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
      let cowName = cow?.animalName || 'Cow';
      if (cowName.length > 10) cowName = cowName.substring(0, 10) + '...';
      const label = cowName;
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

  const allYValues = dailyProductionDatasets.flatMap(d => d.data);
  const nonZeroYValues = allYValues.filter(v => v > 0);
  const minYValue = nonZeroYValues.length > 0 ? Math.min(...nonZeroYValues) : 0;
  const chartMinY = minYValue > 2 ? 2 : 0;

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
        itemSort: (a: any, b: any) => b.raw - a.raw,
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
        min: chartMinY,
        title: {
          display: true,
          text: 'Liters',
          font: { size: 10, weight: 'bold' as const }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          stepSize: 0.5
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
          label={displayMilkLabel} 
          value={`${Math.round(displayMilk * 10) / 10} L`} 
          trend={milkPeriod === 'daily' ? `${parseFloat(Math.abs(productionTrend).toFixed(1))}L vs yesterday` : undefined} 
          trendType={productionTrend >= 0 ? "up" : "down"} 
          icon="🥛" 
          variant={productionTrend >= 0 ? "green" : "red"}
          period={milkPeriod}
          onPeriodChange={setMilkPeriod}
        />
        <StatCard 
          label={displayRevLabel} 
          value={`₹${Math.round(displayRev)}`} 
          trend={revenuePeriod === 'daily' ? `₹${Math.abs(revenueTrend)} ${revenueTrend >= 0 ? 'more' : 'less'}` : undefined} 
          trendType={revenueTrend >= 0 ? "up" : "down"} 
          icon="💵" 
          variant="blue"
          period={revenuePeriod}
          onPeriodChange={setRevenuePeriod}
        />
        <StatCard 
          label={displayExpLabel} 
          value={`₹${Math.round(displayExp)}`} 
          trend={expensePeriod === 'daily' ? `₹${Math.abs(expenseTrend)} vs yesterday` : undefined} 
          trendType={expenseTrend <= 0 ? "down" : "up"} 
          icon="💸" 
          variant="amber"
          period={expensePeriod}
          onPeriodChange={setExpensePeriod}
          onIconClick={() => setShowExpenseModal(true)}
        />
        <StatCard 
          label={displayProfitLabel} 
          value={`₹${Math.round(displayProfit)}`} 
          icon="📈"
          variant={displayProfit >= 0 ? "green" : "red"}
          period={profitPeriod}
          onPeriodChange={setProfitPeriod}
        />
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={() => { setShowExpenseModal(false); setSelectedPieCategory(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-border-custom">
              <h3 className="font-bold text-xl text-text">Expenses Dashboard</h3>
              <button onClick={() => { setShowExpenseModal(false); setSelectedPieCategory(null); }} className="text-text3 hover:text-text bg-surface2 p-1.5 rounded-md transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
              {/* Left Column: Chart */}
              <div className="p-6 border-r border-border-custom overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-bold text-text">Distribution by Category</h4>
                  <select 
                    value={modalPeriod} 
                    onChange={e => { setModalPeriod(e.target.value as any); setSelectedPieCategory(null); }}
                    className="border border-border-custom rounded-md text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="CURRENT_MONTH">Current Month</option>
                    <option value="LAST_2_MONTHS">Last 2 Months</option>
                    <option value="LAST_3_MONTHS">Last 3 Months</option>
                    <option value="ALL_TIME">All Time</option>
                  </select>
                </div>
                
                {modalLoading ? (
                  <div className="h-64 flex items-center justify-center text-text3">Loading expenses...</div>
                ) : modalPieLabels.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-text3">No expenses found for this period.</div>
                ) : (
                  <div className="h-64 relative cursor-pointer">
                    <Pie
                      data={{
                        labels: modalPieLabels,
                        datasets: [{
                          data: modalPieValues,
                          backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED', '#8A2BE2'
                          ],
                          borderWidth: 2,
                          hoverOffset: 10
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          tooltip: {
                            callbacks: {
                              label: function(context: any) {
                                let label = context.label || '';
                                if (label) {
                                  label += ': ';
                                }
                                if (context.parsed !== null) {
                                  label += '₹' + context.parsed;
                                  const total = context.dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);
                                  const percentage = ((context.parsed / total) * 100).toFixed(1) + '%';
                                  label += ' (' + percentage + ')';
                                }
                                return label;
                              }
                            }
                          }
                        },
                        onClick: (event, elements, chart) => {
                          if (elements.length > 0) {
                            const dataIndex = elements[0].index;
                            const label = chart.data.labels![dataIndex] as string;
                            setSelectedPieCategory(label);
                          } else {
                            setSelectedPieCategory(null);
                          }
                        }
                      }}
                    />
                  </div>
                )}
                <div className="mt-6 text-[12px] text-text3 text-center">
                  Click on any slice of the pie chart to view specific entries.
                </div>
              </div>

              {/* Right Column: Entries */}
              <div className="p-6 bg-surface overflow-y-auto">
                {selectedPieCategory ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-text flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#36A2EB' }}></span>
                        {selectedPieCategory} Entries
                      </h4>
                      <span className="text-sm font-bold text-text2">
                        Total: ₹{modalPieDataMap[selectedPieCategory] || 0}
                      </span>
                    </div>
                    {categoryExpenses.length === 0 ? (
                      <div className="text-sm text-text3 mt-4">No entries found.</div>
                    ) : (
                      <div className="space-y-3">
                        {[...categoryExpenses].sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(expense => (
                          <div key={expense.id} className="bg-white p-3 rounded-lg border border-border-custom shadow-sm flex justify-between items-center">
                            <div>
                              <div className="text-sm font-semibold text-text">{expense.description || 'No description'}</div>
                              <div className="text-[11px] text-text3">{new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                            </div>
                            <div className="font-bold text-danger text-sm">
                              ₹{expense.amount}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-text3">
                    <svg className="w-12 h-12 text-border-custom mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p className="text-sm">Select a category from the chart<br/>to view its detailed expense entries.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

        <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow relative">
          <style>{`
            @keyframes blinkFade {
              0%, 100% { opacity: 1; transform: scale(1) translateX(-50%); }
              50% { opacity: 0.3; transform: scale(0.95) translateX(-50%); }
            }
            .blink-node {
              animation: blinkFade 1s infinite ease-in-out;
            }
          `}</style>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-bold text-text">Revenue vs Expense — 6 Months</h3>
          </div>
          <div className="h-[200px] relative">
            <Line 
              ref={finChartRef}
              data={finChartData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true } } }
              }} 
              plugins={[profitLossPlugin]}
            />
            <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Daily Milk Production Line Chart Card */}
      <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow mb-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[14px] font-bold text-text">Daily Milk Production</h3>
            <p className="text-[11px] text-text3 mt-0.5">Historical production trends by individual cow or aggregated</p>
          </div>

          <div className="grid grid-cols-[1fr_1fr] sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Start Date Calendar Input */}
            <div className="flex items-center gap-1.5 bg-white border border-border-custom px-2.5 py-1.5 rounded-xl shadow-sm min-w-0">
              <Calendar size={13} className="text-brand flex-shrink-0" />
              <span className="text-[10px] font-black text-brand uppercase tracking-wider flex-shrink-0">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[11px] font-bold text-text bg-transparent focus:outline-none w-full min-w-0"
              />
            </div>

            {/* End Date Calendar Input */}
            <div className="flex items-center gap-1.5 bg-white border border-border-custom px-2.5 py-1.5 rounded-xl shadow-sm min-w-0">
              <Calendar size={13} className="text-brand flex-shrink-0" />
              <span className="text-[10px] font-black text-brand uppercase tracking-wider flex-shrink-0">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[11px] font-bold text-text bg-transparent focus:outline-none w-full min-w-0"
              />
            </div>

            {/* Shift Toggle + Cow Selector row */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:gap-3">
            {/* 3-Way Shift Toggle */}
            <div className="relative flex items-center bg-[#f1f5f3] rounded-full p-[3px] shadow-sm border border-border-custom flex-shrink-0">
              {/* Sliding pill indicator */}
              <div
                className="absolute top-[3px] bottom-[3px] w-[34px] rounded-full bg-brand shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  left: shiftFilter === 'MORNING'
                    ? '3px'
                    : shiftFilter === 'ALL'
                      ? 'calc(50% - 17px)'
                      : 'calc(100% - 37px)'
                }}
              />
              <button
                type="button"
                onClick={() => setShiftFilter('MORNING')}
                className={`relative z-10 w-[34px] h-[28px] flex items-center justify-center rounded-full transition-colors duration-200 ${
                  shiftFilter === 'MORNING' ? 'text-white' : 'text-text3 hover:text-brand'
                }`}
                title="Morning"
              >
                <Sun size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setShiftFilter('ALL')}
                className={`relative z-10 w-[34px] h-[28px] flex items-center justify-center rounded-full transition-colors duration-200 ${
                  shiftFilter === 'ALL' ? 'text-white' : 'text-text3 hover:text-brand'
                }`}
                title="All Day"
              >
                <Clock size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => setShiftFilter('EVENING')}
                className={`relative z-10 w-[34px] h-[28px] flex items-center justify-center rounded-full transition-colors duration-200 ${
                  shiftFilter === 'EVENING' ? 'text-white' : 'text-text3 hover:text-brand'
                }`}
                title="Evening"
              >
                <Moon size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* Premium Selector dropdown */}
            <div className="cow-selector-container relative flex-1 sm:flex-none sm:w-auto">
            <button 
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between gap-2.5 bg-white border border-border-custom px-4 py-2 rounded-xl text-[12px] font-bold text-text hover:border-brand hover:text-brand transition-all cursor-pointer shadow-sm w-full sm:w-auto sm:min-w-[170px]"
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
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-[calc(100vw-4rem)] sm:w-72 max-w-[288px] bg-white border border-border-custom rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
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
        </div>

        <div className="h-[400px]">
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
                <th className="p-3">Morn</th>
                <th className="p-3">Even</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody>
               {data.topMilkers.map((cow, i) => (
                 <tr key={i} className="border-b border-border-custom/50 last:border-0">
                   <td className="p-3"><strong className="text-brand">{cow.cowId}</strong> {cow.cowName}</td>
                   <td className="p-3">{Math.round((cow.morningYield || 0) * 10) / 10}L</td>
                   <td className="p-3">{Math.round((cow.eveningYield || 0) * 10) / 10}L</td>
                   <td className="p-3 font-bold text-brand-dark">{Math.round((cow.totalYield || 0) * 10) / 10}L</td>
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
