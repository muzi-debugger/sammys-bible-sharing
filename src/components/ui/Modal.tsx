import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-charcoal/35 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${width} rounded-t-journal-lg border border-sage/35 bg-ivory shadow-paper-lift animate-fade-up sm:rounded-journal-lg`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-sage/25 px-6 py-5">
          <div>
            {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
            <h2 className="text-[1.35rem] leading-snug text-forest">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-transparent p-1.5 text-charcoal/40 transition-colors hover:border-sage/40 hover:text-charcoal/80"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-sage/25 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
