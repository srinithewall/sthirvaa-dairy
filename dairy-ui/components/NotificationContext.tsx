'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, X, Info, Trash2 } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  id: string;
  message: string;
  type: NotificationType;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  type: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

interface NotificationContextType {
  showToast: (message: string, type?: NotificationType) => void;
  confirm: (message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-brand-dark',
    border: 'border-brand/40',
    iconColor: '#C5A059',
    label: 'Success',
  },
  error: {
    icon: XCircle,
    bg: 'bg-[#2A0A0A]',
    border: 'border-danger/30',
    iconColor: '#E05252',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-[#2A1F00]',
    border: 'border-warn/30',
    iconColor: '#F7B731',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bg: 'bg-[#0A1A2A]',
    border: 'border-info/30',
    iconColor: '#3A7BD5',
    label: 'Info',
  },
};

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
    }, 4500);
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

      {/* ── Toast Stack ── */}
      <div className="fixed bottom-6 right-6 z-[5000] flex flex-col gap-3 pointer-events-none" style={{ minWidth: 320, maxWidth: 400 }}>
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const cfg = TOAST_CONFIG[toast.type];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex items-start gap-3.5 px-5 py-4 rounded-2xl border shadow-2xl ${cfg.bg} ${cfg.border}`}
                style={{ backdropFilter: 'blur(12px)' }}
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <Icon size={20} color={cfg.iconColor} strokeWidth={2.5} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] mb-0.5" style={{ color: cfg.iconColor }}>
                    {cfg.label}
                  </p>
                  <p className="text-[13px] font-semibold text-white/90 leading-snug">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="flex-shrink-0 mt-0.5 p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
                >
                  <X size={15} />
                </button>

                {/* Bottom progress line */}
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4.5, ease: 'linear' }}
                  className="absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-b-2xl"
                  style={{ backgroundColor: cfg.iconColor, opacity: 0.6 }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={confirmState.onCancel}
              className="absolute inset-0"
              style={{ background: 'rgba(8, 28, 21, 0.75)', backdropFilter: 'blur(6px)' }}
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-[380px] overflow-hidden rounded-[28px] shadow-modal"
              style={{ background: '#FDFCF0', border: '1px solid rgba(27,67,50,0.12)' }}
            >
              {/* Top accent stripe */}
              <div
                className="h-1.5 w-full"
                style={{
                  background: confirmState.type === 'danger'
                    ? 'linear-gradient(90deg, #E05252, #c03030)'
                    : 'linear-gradient(90deg, #F7B731, #d4920a)',
                }}
              />

              <div className="px-8 pt-8 pb-6 text-center">
                {/* Icon badge */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner"
                  style={{
                    background: confirmState.type === 'danger' ? 'rgba(224,82,82,0.1)' : 'rgba(247,183,49,0.12)',
                    border: confirmState.type === 'danger' ? '1.5px solid rgba(224,82,82,0.25)' : '1.5px solid rgba(247,183,49,0.3)',
                  }}
                >
                  {confirmState.type === 'danger'
                    ? <Trash2 size={26} color="#E05252" strokeWidth={2} />
                    : <AlertTriangle size={26} color="#d4920a" strokeWidth={2} />
                  }
                </div>

                {/* Title */}
                <h3
                  className="text-[22px] font-black tracking-tight mb-2"
                  style={{ fontFamily: "'Playfair Display', serif", color: '#1B4332' }}
                >
                  {confirmState.type === 'danger' ? 'Delete Record?' : 'Confirm Action'}
                </h3>

                {/* Body */}
                <p className="text-[14px] font-medium leading-relaxed px-2" style={{ color: '#4A6355' }}>
                  {confirmState.message}
                </p>
                <p className="text-[11px] font-bold mt-1.5 uppercase tracking-widest" style={{ color: '#7A9485' }}>
                  This action cannot be undone.
                </p>
              </div>

              {/* Buttons */}
              <div className="px-6 pb-7 flex flex-col gap-2.5">
                <button
                  onClick={confirmState.onConfirm}
                  className="w-full py-3.5 rounded-2xl font-black text-[13px] uppercase tracking-widest text-white transition-all active:scale-[0.97] shadow-lg"
                  style={{
                    background: confirmState.type === 'danger'
                      ? 'linear-gradient(135deg, #E05252, #c03030)'
                      : 'linear-gradient(135deg, #2D6A4F, #1B4332)',
                    boxShadow: confirmState.type === 'danger'
                      ? '0 8px 20px rgba(224,82,82,0.3)'
                      : '0 8px 20px rgba(27,67,50,0.3)',
                  }}
                >
                  {confirmState.type === 'danger' ? 'Yes, Delete' : 'Yes, Proceed'}
                </button>
                <button
                  onClick={confirmState.onCancel}
                  className="w-full py-3.5 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.97]"
                  style={{
                    background: 'transparent',
                    color: '#7A9485',
                    border: '1.5px solid rgba(27,67,50,0.15)',
                  }}
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
