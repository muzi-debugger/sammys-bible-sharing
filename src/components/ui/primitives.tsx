import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-forest text-ivory border border-forest hover:bg-forest-soft hover:border-forest-soft shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]',
  secondary: 'bg-transparent text-forest border border-sage/70 hover:border-forest/60 hover:bg-cream/40',
  ghost: 'bg-transparent text-forest/80 border border-transparent hover:bg-cream/50 hover:text-forest',
  quiet: 'bg-cream/70 text-forest border border-cream hover:bg-cream',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  full,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-sans font-medium tracking-[0.01em] transition-all duration-300 ease-gentle disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'px-5 py-2.5 text-[0.82rem]' : 'px-3.5 py-2 text-[0.76rem]',
        VARIANTS[variant],
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

export function Card({
  children,
  className,
  tone = 'paper',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'paper' | 'cream' | 'bare';
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag
      className={cn(
        'rounded-journal-lg border transition-shadow duration-500 ease-gentle',
        tone === 'paper' && 'border-sage/30 bg-soft-white/90 shadow-paper',
        tone === 'cream' && 'border-cream bg-cream/60',
        tone === 'bare' && 'border-sage/25 bg-transparent',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'sage',
  className,
}: {
  children: ReactNode;
  tone?: 'sage' | 'gold' | 'terracotta' | 'forest' | 'muted';
  className?: string;
}) {
  const tones = {
    sage: 'border-sage/50 bg-sage/10 text-forest/80',
    gold: 'border-gold/50 bg-gold/10 text-[#8a6f3f]',
    terracotta: 'border-terracotta/40 bg-terracotta/10 text-[#93573f]',
    forest: 'border-forest/25 bg-forest/[0.07] text-forest',
    muted: 'border-charcoal/15 bg-charcoal/[0.04] text-charcoal/60',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-sans text-[0.62rem] font-medium uppercase tracking-[0.14em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-[1.55rem] leading-tight text-forest sm:text-[1.75rem]">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-reading font-sans text-[0.85rem] leading-relaxed text-charcoal/65">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block font-sans text-[0.7rem] font-medium uppercase tracking-[0.16em] text-forest/70"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="font-sans text-[0.72rem] leading-relaxed text-charcoal/50">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'w-full rounded-[10px] border border-sage/45 bg-soft-white px-3.5 py-2.5 font-sans text-[0.86rem] text-charcoal transition-colors duration-300 ease-gentle placeholder:text-charcoal/30 focus:border-forest/50 focus:outline-none';

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 py-3.5">
      <div>
        <p className="font-sans text-[0.85rem] font-medium text-charcoal">{label}</p>
        {description ? (
          <p className="mt-1 max-w-[46ch] font-sans text-[0.75rem] leading-relaxed text-charcoal/55">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full border transition-colors duration-300 ease-gentle',
          'after:absolute after:-inset-2 after:content-[""]',
          checked ? 'border-forest bg-forest' : 'border-sage/60 bg-cream',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-soft-white shadow-sm transition-all duration-300 ease-gentle',
            checked ? 'left-[24px]' : 'left-[3px]',
          )}
        />
      </button>
    </div>
  );
}
