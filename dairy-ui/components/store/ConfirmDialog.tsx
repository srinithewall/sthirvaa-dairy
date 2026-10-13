'use client';

import React from 'react';
import Portal from '@/components/store/Portal';
import { AlertTriangle } from 'lucide-react';

/** App-styled confirmation popup, used instead of the browser's confirm() box. */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, busy, onConfirm, onCancel }: {
  title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-[2100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3">
            {danger && (
              <div className="w-10 h-10 rounded-full bg-red-50 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-text">{title}</h2>
              <div className="text-sm text-text2 mt-1">{message}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button onClick={onCancel} className="py-2.5 rounded-lg border border-border-custom font-bold text-sm text-text2">Cancel</button>
            <button onClick={onConfirm} disabled={busy}
              className={`py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-50 ${danger ? 'bg-danger' : 'bg-brand'}`}>
              {busy ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
