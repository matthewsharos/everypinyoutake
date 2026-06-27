import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastKind = 'success' | 'error';
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  /** Pop a green confirmation toast (auto-dismisses). */
  success: (message: string) => void;
  /** Pop a clay error toast (auto-dismisses). */
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Admin-wide toast access. Must be used inside <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const DURATION = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++seq.current;
      setToasts((list) => [...list, { id, kind, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  // Clear pending timers on unmount.
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-white shadow-2xl ${
              t.kind === 'success' ? 'bg-[#2f8f7c]' : 'bg-magenta'
            }`}
          >
            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-base">
              {t.kind === 'success' ? '✓' : '!'}
            </span>
            <span className="flex-1">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
