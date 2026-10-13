'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Items and stock are one list now: products are created from supplier bills and edited on Stock.
export default function StoreItemsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/store/stock'); }, [router]);
  return null;
}
