'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  isVisible: boolean;
  onClose: () => void;
}

export default function Toast({ message, type, isVisible, onClose }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[320px] max-w-[90vw]"
          style={{
            backgroundColor: type === 'success' ? '#ECFDF5' : '#FEF2F2',
            borderColor: type === 'success' ? '#10B98120' : '#EF444420',
          }}
        >
          <div className={`flex-shrink-0 ${type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
            {type === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
          </div>
          
          <div className="flex-1">
            <p className="text-[14px] font-bold text-slate-800 leading-tight">
              {type === 'success' ? 'Success' : 'Attention'}
            </p>
            <p className="text-[13px] text-slate-600 mt-0.5 font-medium">
              {message}
            </p>
          </div>

          <button 
            onClick={onClose}
            className="flex-shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>

          {/* Progress Bar */}
          <motion.div 
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 4, ease: "linear" }}
            className={`absolute bottom-0 left-0 right-0 h-1 origin-left rounded-b-2xl ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
