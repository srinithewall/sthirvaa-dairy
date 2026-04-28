'use client';

import React from 'react';
import { Menu, Bell, Home, Settings, LogOut } from 'lucide-react';

export default function Navbar() {
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
      <button className="md:hidden text-white p-1">
        <Menu size={22} />
      </button>
      
      <div className="text-lg font-bold text-white flex items-center gap-1.5 tracking-tight">
        <span className="text-xl">🌿</span>
        <span>Sthirvaa<span className="text-accent"> Farms</span></span>
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
