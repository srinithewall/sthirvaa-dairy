'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InventoryScopeToggle from '@/components/InventoryScopeToggle';
import OverviewPopup from '@/components/store/OverviewPopup';
import { LayoutDashboard, Receipt, Truck, Boxes, Users } from 'lucide-react';

/** The shop's pages: the sub-menu under Shop. */
const tabs = [
  { label: 'New Bill', href: '/store/billing', icon: Receipt },
  { label: 'Stock', href: '/store/stock', icon: Boxes },
  { label: 'Stock In', href: '/store/purchases', icon: Truck },
  { label: 'Contacts', href: '/store/contacts', icon: Users },
];

/**
 * Shop header. Row 1: the Shop | Farm switch, then the page's actions and the Overview icon.
 * Row 2: the shop's pages as underline tabs (same style as the Farm page's Stock Items | Assets),
 * so they read as Shop's sub-menu rather than as peers of the switch.
 */
export default function StoreTabs({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  const [showOverview, setShowOverview] = React.useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <InventoryScopeToggle className="shrink-0" />
        <div className="flex items-center gap-2 ml-auto">
          {action}
          {/* Overview opens on demand as a popup, rather than as a tab. */}
          <button
            onClick={() => setShowOverview(true)}
            title="Overview"
            aria-label="Overview"
            className={`p-2.5 rounded-lg border transition-colors ${
              showOverview ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom hover:border-brand hover:text-brand'
            }`}
          >
            <LayoutDashboard size={16} />
          </button>
        </div>
      </div>
      <nav className="flex border-b border-border-custom">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              // The open page gets a soft mint fill, lighter than the solid green Shop | Farm switch above it.
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 sm:px-4 pt-2 pb-2 -mb-px border-b-2 rounded-t-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-[#D8F0E3] border-brand text-brand-dark' : 'border-transparent text-text3 hover:text-text hover:bg-white/70'
              }`}>
              <t.icon size={16} />
              {t.label}
            </Link>
          );
        })}
      </nav>
      {showOverview && <OverviewPopup onClose={() => setShowOverview(false)} />}
    </div>
  );
}
