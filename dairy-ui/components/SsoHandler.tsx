'use client';

import React, { useEffect, useState } from 'react';

export default function SsoHandler() {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('ng_sso_token');
    
    if (token) {
      setIsProcessing(true);
      const processSso = async () => {
        try {
          // Dynamic import of api to avoid SSR issues
          const { default: api } = await import('@/lib/api');
          
          localStorage.setItem('token', token);
          
          const res = await api.get('/users/me');
          localStorage.setItem('user', JSON.stringify(res.data));
          
          const url = new URL(window.location.href);
          url.searchParams.delete('ng_sso_token');
          window.history.replaceState({}, '', url.toString());
          
          if (window.location.pathname === '/login' || window.location.pathname === '/') {
            window.location.href = '/dashboard';
          } else {
            window.location.reload();
          }
        } catch (err) {
          console.error('SSO failed', err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsProcessing(false);
        }
      };
      
      processSso();
    }
  }, []);

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F0F4F1]">
        <div className="w-8 h-8 border-4 border-[#1A5F3A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[10px] font-bold text-[#1A5F3A] uppercase tracking-widest">Seamlessly Authenticating...</p>
      </div>
    );
  }

  return null;
}
