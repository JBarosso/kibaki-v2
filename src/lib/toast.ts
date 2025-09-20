export type ToastType = 'success' | 'error' | 'info';

const EVENT_NAME = 'app:toast';

export function showToast({ type, message }: { type: ToastType; message: string }) {
  if (typeof window === 'undefined') return;
  const detail = { type, message } as const;
  const evt = new CustomEvent(EVENT_NAME, { detail });
  window.dispatchEvent(evt);
}


