import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  trendType?: 'up' | 'down';
  icon: string;
  variant?: 'green' | 'blue' | 'amber' | 'red';
}

const variants = {
  green: 'bg-[#E8F5EE] text-brand',
  blue: 'bg-[#EBF3FD] text-info',
  amber: 'bg-[#FEF6E0] text-warn',
  red: 'bg-[#FDEAEA] text-danger'
};

export default function StatCard({ label, value, subValue, trend, trendType, icon, variant = 'green' }: StatCardProps) {
  return (
    <div className="bg-white rounded-radius-custom-lg p-4 border border-border-custom card-shadow">
      <div className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center text-lg mb-3 ${variants[variant]}`}>
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
