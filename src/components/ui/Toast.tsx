import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'info' | 'error';

interface ToastMessage {
  id: string;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = crypto.randomUUID();
      setMessages((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[92px] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
        role="status"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-journal border bg-soft-white px-4 py-3 shadow-paper-lift animate-fade-up',
              message.tone === 'success' && 'border-sage/60',
              message.tone === 'info' && 'border-gold/50',
              message.tone === 'error' && 'border-terracotta/50',
            )}
          >
            <span
              className={cn(
                'mt-0.5',
                message.tone === 'success' && 'text-forest',
                message.tone === 'info' && 'text-gold',
                message.tone === 'error' && 'text-terracotta',
              )}
            >
              {message.tone === 'success' ? (
                <Check size={15} />
              ) : message.tone === 'info' ? (
                <Info size={15} />
              ) : (
                <TriangleAlert size={15} />
              )}
            </span>
            <p className="flex-1 font-sans text-[0.79rem] leading-relaxed text-charcoal/85">
              {message.message}
            </p>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => dismiss(message.id)}
              className="text-charcoal/35 transition-colors hover:text-charcoal/70"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
