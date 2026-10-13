'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InventoryScopeToggle from '@/components/InventoryScopeToggle';
import OverviewPopup from '@/components/store/OverviewPopup';
import { LayoutDashboard, Receipt, Truck, Boxes, Users } from 'lucide-react';

const tabs = [
  { label: 'New Bill', href: '/store/billing', icon: Receipt },
  { label: 'Stock', href: '/store/stock', icon: Boxes },
  { label: 'Stock In', href: '/store/purchases', icon: Truck },
  { label: 'Contacts', href: '/store/contacts', icon: Users },
];

/** Shop tab row; the active tab names the page, so pages don't repeat it as a heading. */
export default function StoreTabs({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  const [showOverview, setShowOverview] = React.useState(false);
  return (
    // One row: Shop|Farm switch, tabs, then actions + Overview icon. On phones the switch and
    // actions wrap onto their own rows and the tabs fill a row (icon over label).
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <InventoryScopeToggle className="" />
      <div className="grid grid-cols-4 gap-1 w-full sm:flex sm:w-auto sm:flex-1 min-w-0">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors ${
                active ? 'bg-brand text-white border-brand' : 'bg-white text-text2 border-border-custom hover:border-brand'
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </Link>
          );
        })}
      </div>
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
      {showOverview && <OverviewPopup onClose={() => setShowOverview(false)} />}
    </div>
  );
}
