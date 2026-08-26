'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  useEffect(() => {
    // If we're processing an SSO code, wait for SsoHandler to do its job
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (token) {
      redirect('/dashboard');
    } else {
      redirect('/login');
    }
  }, []);

  return null;
}
