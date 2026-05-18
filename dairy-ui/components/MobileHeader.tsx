'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Shield } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  secure?: boolean;
}

export default function MobileHeader({ title, onBack, rightAction, secure = false }: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <div className="h-14 bg-[#1B4332] flex items-center px-4 gap-3 sticky top-0 z-50 shadow-lg flex-shrink-0">
      <button
        onClick={handleBack}
        className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 transition-colors"
      >
        <ArrowLeft size={20} />
      </button>

      <h1 className="flex-1 text-center text-white font-bold text-[15px] tracking-wide">{title}</h1>

      <div className="w-9 h-9 flex items-center justify-center">
        {rightAction ? (
          rightAction
        ) : secure ? (
          <div className="flex items-center gap-1 text-white/70">
            <Shield size={14} />
            <span className="text-[10px] font-bold">Secure</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
