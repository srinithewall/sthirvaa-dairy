'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { UserPlus, Mail, Phone, ShieldCheck, User } from 'lucide-react';

interface Staff {
  id: number;
  name: string;
  role: string;
  type: string;
  description: string;
  phone: string;
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const partners = staffList.filter(s => s.type === 'BUSINESS');
  const operations = staffList.filter(s => s.type === 'STAFF');

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Staff & Partners</h1>
          <p className="text-[13px] text-text3 mt-1">Managing the core team of Sthirvaa Farms</p>
        </div>
        <button className="bg-brand text-white flex items-center gap-2 py-2 px-4 rounded-radius-custom font-medium text-[13px] hover:bg-brand-dark transition-all shadow-sm">
          <UserPlus size={16} />
          <span>Add Member</span>
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-[14px] font-bold text-brand uppercase tracking-widest mb-4 flex items-center gap-2">
          <ShieldCheck size={18} /> Managing Partners
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-radius-custom-lg border border-brand/10 card-shadow flex gap-4">
              <div className="w-14 h-14 bg-brand-light/10 text-brand rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                {s.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-lg text-text">{s.name}</div>
                <div className="text-[12px] font-bold text-brand-dark mb-2">{s.role}</div>
                <p className="text-[13px] text-text2 leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-[14px] font-bold text-text3 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User size={18} /> Operations Staff
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {operations.map(s => (
            <div key={s.id} className="bg-white p-4 rounded-radius-custom-lg border border-border-custom card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-surface2 text-text3 rounded-full flex items-center justify-center font-bold">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-text leading-tight">{s.name}</div>
                  <div className="text-[11px] text-text3">{s.role}</div>
                </div>
              </div>
              <p className="text-[12px] text-text2 mb-4 h-12 overflow-hidden line-clamp-3">{s.description}</p>
              <div className="flex gap-2">
                <button className="flex-1 bg-surface2 text-text2 py-1.5 rounded text-[11px] font-bold hover:bg-border-custom transition-all">Profile</button>
                <button className="p-1.5 bg-brand/5 text-brand rounded hover:bg-brand/10 transition-all"><Phone size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
