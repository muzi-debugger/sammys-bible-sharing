import { cn } from '@/lib/cn';

/**
 * Hand-drawn style botanical line art. No figures, faces or religious
 * characters — only stems, leaves and sprigs used as quiet ornament.
 */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      fill="none"
      aria-hidden="true"
      className={cn('text-sage', className)}
    >
      <path d="M60 152V28" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <path
        d="M60 52c-14-6-24-16-26-30 14 2 24 12 26 30Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M60 76c14-6 24-16 26-30-14 2-24 12-26 30Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M60 100c-12-5-20-13-22-25 12 2 20 10 22 25Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M60 124c12-5 20-13 22-25-12 2-20 10-22 25Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="24" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function LeafCorner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 196C4 120 44 62 128 26"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M26 148c18 0 32-8 40-24-18-2-32 6-40 24Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M44 112c18 0 32-8 40-24-18-2-32 6-40 24Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M68 80c18 0 32-8 40-24-18-2-32 6-40 24Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M22 158c-2-18-12-30-24-36 0 18 8 30 24 36Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M52 122c-2-18-12-30-24-36 0 18 8 30 24 36Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OpenBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path
        d="M20 32c0-8 4-14 13-17-1.4 8-5.6 14-13 17Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M20 32c0-8-4-14-13-17 1.4 8 5.6 14 13 17Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M20 32V19" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

export function DivineDivider({ className }: { className?: string }) {
  return (
    <div className={cn('rule-divider', className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 shrink-0 text-gold">
        <path d="M12 2v20M4 9l8 5 8-5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function Candle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 90" fill="none" aria-hidden="true" className={className}>
      <path d="M30 6c4 6 6 10 6 14a6 6 0 1 1-12 0c0-4 2-8 6-14Z" stroke="currentColor" strokeWidth="0.9" />
      <path d="M30 26v6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <rect x="18" y="34" width="24" height="46" rx="3" stroke="currentColor" strokeWidth="0.9" />
      <path d="M14 84h32" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
