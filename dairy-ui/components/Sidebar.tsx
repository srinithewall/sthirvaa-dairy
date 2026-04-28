'use client';

import React from 'react';
import { LayoutDashboard, Bell, Layout, Droplets, ShoppingCart, DollarSign, Package, Package2, Users, BarChart3, LogOut, Settings, ClipboardList, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

const sidebarItems = [
  { group: 'Overview', items: [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' }
  ]},
  { group: 'Farm Management', items: [
    { name: 'Herd Management', icon: Layout, path: '/herds' },
    { name: 'Milk Production', icon: Droplets, path: '/production' }
  ]},
  { group: 'Business', items: [
    { name: 'Sales', icon: ShoppingCart, path: '/sales' },
    { name: 'Expenses', icon: DollarSign, path: '/ledger?type=EXPENSE' },
    { name: 'Inventory', icon: Package, path: '/inventory' }
  ]},
  { group: 'Shop', items: [
    { name: 'Sthirvaa Shop', icon: ShoppingCart, path: '/shop' },
    { name: 'My Orders', icon: ClipboardList, path: '/orders' },
    { name: 'Products Admin', icon: Package2, path: '/admin/products' }
  ]},
  { group: 'Operations', items: [
    { name: 'Staff Management', icon: Users, path: '/staff' },
    { name: 'Digital Ledger', icon: BarChart3, path: '/ledger' }
  ]}
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = React.useState({ username: 'Loading...', role: 'STAFF', staffId: null, customerId: null });
  const [showModal, setShowModal] = React.useState(false);
  const [staffInfo, setStaffInfo] = React.useState<any>(null);

  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  React.useEffect(() => {
    if (showModal && user.staffId) {
      fetchStaffDetails();
    }
  }, [showModal, user.staffId]);

  const fetchStaffDetails = async () => {
    try {
      const res = await api.get(`/staff/${user.staffId}`);
      setStaffInfo(res.data);
    } catch (err) {
      console.error('Error fetching staff info:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const displayName = user.username.split('@')[0];

  return (
    <div className="w-[230px] bg-white border-r border-border-custom2 flex flex-col h-screen overflow-y-auto flex-shrink-0 transition-transform hidden md:flex">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 bg-surface rounded-full flex-shrink-0 flex items-center justify-center text-text3 border border-border-custom shadow-sm">
            <Users size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="text-[15px] font-bold text-[#2D3E50] truncate">
              Hi, <span className="capitalize">{displayName}</span>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="text-[12px] text-[#4A90E2] font-semibold hover:underline text-left"
            >
              View My Info
            </button>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="p-1.5 text-[#4A90E2] hover:bg-surface rounded-md transition-all flex-shrink-0"
          title="Profile Settings"
        >
          <Settings size={18} />
        </button>
      </div>
      
      <div className="h-[1px] bg-[#E8EDF2] mx-4 mb-3" />

      {/* User Info Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-brand/20">
            <div className="bg-brand-dark p-6 text-white text-center relative">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
              >
                <LogOut size={16} className="rotate-180" />
              </button>
              <div className="w-16 h-16 bg-accent rounded-full mx-auto flex items-center justify-center text-brand-dark text-2xl font-bold mb-3 shadow-lg">
                {displayName.substring(0,2).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold capitalize">{displayName}</h2>
              <p className="text-accent text-xs font-bold uppercase tracking-widest mt-1">
                {staffInfo?.role || user.role}
              </p>
            </div>
            
            <div className="p-6 pt-4 space-y-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Description</span>
                  <p className="text-[12px] text-text2 leading-relaxed italic">
                    {staffInfo?.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Phone</span>
                    <span className="text-[13px] text-text font-medium">{staffInfo?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Location</span>
                    <span className="text-[13px] text-text font-medium">{staffInfo?.location || 'Bengaluru'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 pt-2 border-t border-border-custom mt-2">
                  <span className="text-[11px] text-text3 font-bold uppercase tracking-wider">Linked Email</span>
                  <span className="text-[13px] text-text2 truncate">{user.username}</span>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="w-full bg-brand text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark transition-colors mt-4 text-sm shadow-md"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarItems.map((section, idx) => (
        <React.Fragment key={idx}>
          <div className="px-4 pt-4 pb-1 text-[10px] font-bold text-text3 uppercase tracking-widest">
            {section.group}
          </div>
          {section.items.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer mx-2 my-0.5 transition-colors text-[13px] ${
                  isActive 
                    ? 'bg-[#E8F5EE] text-brand font-semibold shadow-sm' 
                    : 'text-text2 hover:bg-surface2 hover:text-text'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="bg-danger text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </React.Fragment>
      ))}

      <div className="mt-auto p-4">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-text3 hover:text-danger transition-colors text-sm font-medium w-full"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
