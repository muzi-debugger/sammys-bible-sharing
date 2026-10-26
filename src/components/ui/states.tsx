import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Sprig } from '@/components/Botanical';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-journal-lg border border-dashed border-sage/50 bg-cream/30 px-6 py-14 text-center',
        className,
      )}
    >
      <Sprig className="mb-5 h-14 w-10 opacity-50" />
      <h3 className="font-serif text-[1.3rem] text-forest">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm font-sans text-[0.83rem] leading-relaxed text-charcoal/60">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = 'Preparing your page…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20" role="status" aria-live="polite">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-5 w-1.5 origin-bottom rounded-full bg-sage/70 animate-soft-pulse"
            style={{ animationDelay: `${index * 0.18}s`, height: `${14 + index * 5}px` }}
          />
        ))}
      </div>
      <p className="font-sans text-[0.78rem] tracking-[0.12em] text-charcoal/45 uppercase">{label}</p>
    </div>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-journal border border-terracotta/40 bg-terracotta/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-sans text-[0.8rem] leading-relaxed text-[#8a4f37]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-sans text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#8a4f37] underline decoration-[#8a4f37]/40 underline-offset-4 transition-colors hover:decoration-[#8a4f37]"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
