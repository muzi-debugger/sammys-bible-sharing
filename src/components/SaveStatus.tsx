import { Check, CircleAlert, Loader2, PencilLine } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

const COPY: Record<SaveState, string> = {
  idle: 'All changes saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Unable to save — retry',
};

export function SaveStatus({
  state,
  onRetry,
  lastSavedAt,
  className,
}: {
  state: SaveState;
  onRetry?: () => void;
  lastSavedAt?: string;
  className?: string;
}) {
  const icon =
    state === 'saving' ? (
      <Loader2 size={12} className="animate-spin" />
    ) : state === 'error' ? (
      <CircleAlert size={12} />
    ) : state === 'unsaved' ? (
      <PencilLine size={12} />
    ) : (
      <Check size={12} />
    );

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-sans text-[0.7rem]',
          state === 'error' ? 'text-terracotta' : 'text-charcoal/55',
        )}
        aria-live="polite"
      >
        {icon}
        {COPY[state]}
      </span>
      {state === 'error' && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="font-sans text-[0.68rem] font-medium uppercase tracking-[0.12em] text-terracotta underline decoration-terracotta/40 underline-offset-2"
        >
          Try again
        </button>
      ) : null}
      {lastSavedAt && state !== 'saving' ? (
        <span className="font-sans text-[0.64rem] text-charcoal/35">
          ·{' '}
          {new Intl.DateTimeFormat('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(lastSavedAt))}
        </span>
      ) : null}
    </div>
  );
}
