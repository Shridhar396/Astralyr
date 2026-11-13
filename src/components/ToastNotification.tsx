import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
  durationMs?: number; // default 5000ms
}

interface ToastNotificationProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (!toast) return;

    const duration = toast.durationMs || 5000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setTimeLeft(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-[#0e1017] border border-white/15 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="text-xs font-medium">{toast.message}</div>

      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="px-2.5 py-1 rounded-lg bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-all shadow-sm"
        >
          {toast.action.label} ({timeLeft}s)
        </button>
      )}

      <button
        onClick={onDismiss}
        className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
