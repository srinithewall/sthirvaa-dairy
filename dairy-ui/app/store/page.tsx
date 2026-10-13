'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The shop opens on New Bill; Overview is a popup from the tab row (see StoreTabs).
export default function StoreIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/store/billing'); }, [router]);
  return null;
}
