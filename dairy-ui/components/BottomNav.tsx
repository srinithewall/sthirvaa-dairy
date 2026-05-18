'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, RefreshCcw, FileText, User } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, href: '/shop' },
  { label: 'Orders', icon: ClipboardList, href: '/orders' },
  { label: 'Subscriptions', icon: RefreshCcw, href: '/subscriptions' },
  { label: 'Invoices', icon: FileText, href: '/invoices' },
  { label: 'Profile', icon: User, href: '/profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="h-16 bg-white border-t border-gray-100 flex items-stretch flex-shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? 'text-[#1B4332]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={`text-[10px] font-bold ${isActive ? 'text-[#1B4332]' : 'text-gray-400'}`}>
              {item.label}
            </span>
            {isActive && (
              <div className="absolute bottom-0 w-6 h-0.5 bg-[#1B4332] rounded-t-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
