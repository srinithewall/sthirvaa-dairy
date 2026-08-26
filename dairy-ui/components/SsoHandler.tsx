'use client';

import React, { useEffect, useState } from 'react';

export default function SsoHandler() {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code) {
      setIsProcessing(true);
      const processSso = async () => {
        try {
          const { default: api } = await import('@/lib/api');
          
          const res = await api.post('/auth/sso/exchange', {
            code,
            state,
            redirectUri: `${window.location.origin}${window.location.pathname}`
          });
          
          if (res.data && res.data.token) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            url.searchParams.delete('state');
            window.history.replaceState({}, '', url.toString());
            
            // Redirect to dashboard after successful auth
            window.location.href = '/dashboard';
          } else {
            throw new Error('No token returned');
          }
        } catch (err) {
          console.error('SSO exchange failed', err);
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
        <p className="text-[10px] font-bold text-[#1A5F3A] uppercase tracking-widest animate-pulse">Exchanging OAuth Code...</p>
      </div>
    );
  }

  return null;
}
