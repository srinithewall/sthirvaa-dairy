'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, X, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  id: string;
  message: string;
  type: NotificationType;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  type?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

interface NotificationContextType {
  showToast: (message: string, type?: NotificationType) => void;
  confirm: (message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    type: 'warning',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showToast = useCallback((message: string, type: NotificationType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'warning') => {
    setConfirmState({
      isOpen: true,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Toasts Container */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[320px] max-w-[90vw] bg-white border-border-custom2"
            >
              <div className={`flex-shrink-0 ${
                toast.type === 'success' ? 'text-emerald-500' : 
                toast.type === 'error' ? 'text-red-500' : 
                'text-amber-500'
              }`}>
                {toast.type === 'success' ? <CheckCircle2 size={24} /> : 
                 toast.type === 'error' ? <XCircle size={24} /> : 
                 <AlertCircle size={24} />}
              </div>
              
              <div className="flex-1">
                <p className="text-[14px] font-bold text-slate-800 leading-tight">
                  {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
                </p>
                <p className="text-[13px] text-slate-600 mt-0.5 font-medium">
                  {toast.message}
                </p>
              </div>

              <button 
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="flex-shrink-0 p-1 hover:bg-black/5 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={confirmState.onCancel}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-border-custom"
            >
              <div className="p-8 pt-10 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${
                  confirmState.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {confirmState.type === 'danger' ? <XCircle size={32} /> : <AlertTriangle size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">
                  {confirmState.type === 'danger' ? 'Confirm Deletion' : 'Confirm Action'}
                </h3>
                <p className="text-[15px] text-slate-600 font-medium leading-relaxed px-2">
                  {confirmState.message}
                </p>
              </div>
              
              <div className="p-6 bg-slate-50/50 flex flex-col gap-3">
                <button
                  onClick={confirmState.onConfirm}
                  className={`w-full py-4 text-white rounded-2xl font-black text-[15px] shadow-lg transition-all active:scale-[0.98] ${
                    confirmState.type === 'danger' ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700' : 'bg-slate-900 shadow-slate-900/20 hover:bg-black'
                  }`}
                >
                  {confirmState.type === 'danger' ? 'Yes, Delete' : 'Yes, Proceed'}
                </button>
                <button
                  onClick={confirmState.onCancel}
                  className="w-full py-4 bg-white text-slate-600 rounded-2xl font-bold text-[15px] border border-border-custom hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
