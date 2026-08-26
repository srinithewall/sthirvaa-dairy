import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  trendType?: 'up' | 'down';
  icon: string | React.ReactNode;
  variant?: 'green' | 'blue' | 'amber' | 'red';
  period?: 'daily' | 'monthly' | 'total';
  onPeriodChange?: (period: 'daily' | 'monthly' | 'total') => void;
  onIconClick?: () => void;
}

const variants = {
  green: 'bg-[#E8F5EE] text-brand',
  blue: 'bg-[#EBF3FD] text-info',
  amber: 'bg-[#FEF6E0] text-warn',
  red: 'bg-[#FDEAEA] text-danger'
};

export default function StatCard({ label, value, subValue, trend, trendType, icon, variant = 'green', period, onPeriodChange, onIconClick }: StatCardProps) {
  return (
    <div className="bg-white rounded-radius-custom-lg p-4 border border-border-custom card-shadow relative">
      {period && onPeriodChange && (
        <div className="absolute top-4 right-4 flex items-center bg-surface2 rounded-md p-[2px] border border-border-custom">
          <button 
            onClick={() => onPeriodChange('daily')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${period === 'daily' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            D
          </button>
          <button 
            onClick={() => onPeriodChange('monthly')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${period === 'monthly' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            M
          </button>
          <button 
            onClick={() => onPeriodChange('total')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-sm transition-colors ${period === 'total' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            T
          </button>
        </div>
      )}
      <div 
        onClick={onIconClick}
        className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center text-lg mb-3 ${variants[variant]} ${onIconClick ? 'cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-brand/30' : ''}`}
      >
        {icon}
      </div>
      <div className="text-[12px] text-text3 font-medium mb-1 uppercase tracking-tight">{label}</div>
      <div className="text-2xl font-extrabold text-text tracking-tight">{value}</div>
      {trend && (
        <div className={`text-[12px] mt-1 font-semibold ${trendType === 'up' ? 'text-[#1B6035]' : 'text-danger'}`}>
          {trendType === 'up' ? '↑' : '↓'} {trend}
        </div>
      )}
      {subValue && <div className="text-[11px] text-text3 mt-1">{subValue}</div>}
    </div>
  );
}
