'use client';

import React from 'react';
import { Menu, Bell, Home, Settings, LogOut } from 'lucide-react';
import Image from 'next/image';

export default function Navbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [user, setUser] = React.useState({ username: 'User' });

  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const initials = user.username.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <nav className="h-[56px] bg-brand-dark flex items-center px-4 gap-3 z-[100] relative">
      <button 
        onClick={onToggleSidebar}
        className="md:hidden text-white p-1 hover:bg-white/10 rounded-md transition-colors"
      >
        <Menu size={22} />
      </button>
      
      <div className="flex items-center gap-3">
        {/* Pure CSS/SVG Premium Emblem */}
        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
          <div className="absolute inset-0 rounded-full border border-accent/80 shadow-[0_0_10px_rgba(247,183,49,0.2)]"></div>
          <div className="absolute inset-[3px] rounded-full border border-accent/40 border-dashed animate-[spin_60s_linear_infinite]"></div>
          <div className="bg-gradient-to-br from-accent to-accent-dark text-brand-dark p-1.5 rounded-full shadow-inner z-10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
              <path d="M2 22 12 12"/>
            </svg>
          </div>
        </div>
        
        {/* Typography */}
        <div className="flex flex-col leading-none">
          <span className="text-white font-bold text-[16px] tracking-[0.15em] uppercase font-serif" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Sthirvaa</span>
          <span className="text-accent text-[10px] font-bold tracking-[0.3em] uppercase mt-1">Farms</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">


        <button className="hidden sm:flex bg-white/10 hover:bg-white/20 border-none text-white py-1.5 px-3 rounded-md cursor-pointer text-[13px] items-center gap-2 transition-all">
          <Home size={14} />
          <span>Gopala Dairy</span>
        </button>
        
        <div className="flex items-center gap-3 ml-2 border-l border-white/10 pl-4">
          <div className="flex flex-col items-end hidden sm:block">
            <div className="text-[12px] font-bold text-white leading-none">{user.username}</div>
            <div className="text-[10px] text-accent font-medium mt-1 uppercase tracking-tighter">Sthirvaa Farms</div>
          </div>
          <div className="w-[32px] h-[32px] bg-accent rounded-full flex items-center justify-center font-bold text-brand-dark cursor-pointer text-sm shadow-inner group relative">
            {initials}
          </div>
          <button 
            onClick={handleLogout}
            className="p-1.5 text-white/60 hover:text-danger transition-colors hover:bg-white/5 rounded-md"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
