import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastEvent = CustomEvent<{ type: ToastType; message: string }>;

const EVENT_NAME = 'app:toast';
const AUTO_DISMISS_MS = 3500;

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current.get(id);
    if (typeof t === 'number') {
      window.clearTimeout(t);
      timersRef.current.delete(id);
    }
  };

  const scheduleAutoDismiss = (id: string) => {
    const timer = window.setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  };

  useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as ToastEvent;
      const type = ce.detail?.type ?? 'info';
      const message = ce.detail?.message ?? '';
      if (!message) return;
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message }]);
      scheduleAutoDismiss(id);
    };

    window.addEventListener(EVENT_NAME, onToast as EventListener);
    return () => {
      window.removeEventListener(EVENT_NAME, onToast as EventListener);
      // clear all timers on unmount
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return (
    <div className="toast-provider" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  return (
    <div className={`toast-provider__toast toast-provider__toast--${item.type}`} role="status">
      <span className={`toast-provider__dot toast-provider__dot--${item.type}`} />
      <div className="toast-provider__message">{item.message}</div>
      <button
        aria-label="Fermer"
        className="toast-provider__close"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}


