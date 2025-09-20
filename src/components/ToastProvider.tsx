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

  const containerClasses = useMemo(
    () =>
      'pointer-events-none fixed top-4 right-4 z-[1000] flex w-[360px] max-w-[90vw] flex-col gap-2',
    []
  );

  return (
    <div className={containerClasses} aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const base = 'pointer-events-auto flex items-start gap-3 rounded-lg shadow-lg border p-3 text-sm bg-white';

  const colorByType: Record<ToastType, string> = {
    success: 'border-green-200 text-green-900',
    error: 'border-red-200 text-red-900',
    info: 'border-blue-200 text-blue-900',
  };

  const dotByType: Record<ToastType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className={`${base} ${colorByType[item.type]}`} role="status">
      <span className={`mt-1 inline-block h-2 w-2 rounded-full ${dotByType[item.type]}`} />
      <div className="flex-1 pr-2">{item.message}</div>
      <button
        aria-label="Fermer"
        className="rounded p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}


