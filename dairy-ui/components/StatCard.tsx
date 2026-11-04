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
    <div className="bg-white rounded-radius-custom-lg p-2.5 sm:p-3.5 border border-border-custom card-shadow min-w-0">
      {/* Icon and D/M/T toggle share one row so they never overlap on narrow phones. */}
      <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
      <div
        onClick={onIconClick}
        className={`w-6 h-6 sm:w-8 sm:h-8 shrink-0 rounded-md flex items-center justify-center text-[13px] sm:text-base ${variants[variant]} ${onIconClick ? 'cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-brand/30' : ''}`}
      >
        {icon}
      </div>
      {period && onPeriodChange && (
        <div className="flex items-center bg-surface2 rounded-md p-[2px] border border-border-custom shrink-0">
          <button 
            onClick={() => onPeriodChange('daily')}
            className={`px-1.5 py-px text-[10px] font-bold rounded-sm transition-colors ${period === 'daily' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            D
          </button>
          <button 
            onClick={() => onPeriodChange('monthly')}
            className={`px-1.5 py-px text-[10px] font-bold rounded-sm transition-colors ${period === 'monthly' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            M
          </button>
          <button 
            onClick={() => onPeriodChange('total')}
            className={`px-1.5 py-px text-[10px] font-bold rounded-sm transition-colors ${period === 'total' ? 'bg-white shadow-sm text-text' : 'text-text3 hover:text-text2'}`}
          >
            T
          </button>
        </div>
      )}
      </div>
      <div className="text-[10px] sm:text-[11px] leading-tight text-text3 font-medium mb-0.5 uppercase tracking-tight">{label}</div>
      <div className="text-lg sm:text-xl leading-tight font-extrabold text-text tracking-tight truncate">{value}</div>
      {trend && (
        <div className={`text-[11px] mt-0.5 font-semibold ${trendType === 'up' ? 'text-[#1B6035]' : 'text-danger'}`}>
          {trendType === 'up' ? '↑' : '↓'} {trend}
        </div>
      )}
      {subValue && <div className="text-[10px] sm:text-[11px] text-text3 mt-0.5">{subValue}</div>}
    </div>
  );
}
