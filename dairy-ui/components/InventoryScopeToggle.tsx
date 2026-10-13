'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tractor, Store } from 'lucide-react';

// Switches between the feed shop (opens on New Bill; used most so listed first) and farm inventory (/inventory).
const scopes = [
  { label: 'Shop', href: '/store/billing', icon: Store },
  { label: 'Farm', href: '/inventory', icon: Tractor },
];

export default function InventoryScopeToggle({ className = 'mb-4' }: { className?: string }) {
  const pathname = usePathname();
  return (
    <div className={`inline-flex rounded-lg border border-border-custom bg-white p-0.5 ${className}`}>
      {scopes.map((s) => {
        const active = s.label === 'Shop' ? pathname.startsWith('/store') : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              active ? 'bg-brand text-white' : 'text-text2 hover:text-brand'
            }`}
          >
            <s.icon size={15} />
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
