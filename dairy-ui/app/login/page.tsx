'use client';

import React, { useEffect } from 'react';

export default function LoginPage() {
  useEffect(() => {
    const clientId = 'dairy-client';
    const redirectUri = `${window.location.origin}/`;
    const state = Math.random().toString(36).substring(2);
    
    // Redirect to ng_core SSO login (root page handles login/SSO)
    const ngBaseUrl = process.env.NEXT_PUBLIC_NG_URL || 'https://nammagrama.sthirvaa.com';
    window.location.href = `${ngBaseUrl}/?clientId=${clientId}&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F4F1] flex flex-col items-center justify-center p-4">
      <div className="w-8 h-8 border-4 border-[#1A5F3A] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-bold text-[#1A5F3A] uppercase tracking-widest animate-pulse">Redirecting to Sthirvaa Identity Provider...</p>
    </div>
  );
}
