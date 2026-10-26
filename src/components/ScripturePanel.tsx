import { BookmarkCheck, Bookmark, Check, Copy, Quote } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/primitives';
import { passageParagraphs } from '@/services/passageFactory';
import type { PassageContentKind, ScripturePassage, TranslationId } from '@/types';

export function TranslationBadge({
  translation,
  contentKind,
  className,
}: {
  translation: TranslationId;
  contentKind: PassageContentKind;
  className?: string;
}) {
  if (contentKind === 'licensed') {
    return (
      <Badge tone="forest" className={className}>
        <Check size={10} strokeWidth={3} />
        {translation}
      </Badge>
    );
  }
  return (
    <Badge tone="gold" className={className} >
      {translation} · Preview
    </Badge>
  );
}

export function ScriptureReference({
  reference,
  className,
  as: Tag = 'p',
}: {
  reference: string;
  className?: string;
  as?: 'p' | 'span' | 'h3';
}) {
  return (
    <Tag className={cn('font-serif text-[1.02rem] italic tracking-[0.01em] text-forest/85', className)}>
      {reference}
    </Tag>
  );
}

export function PreviewNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-journal border border-gold/40 bg-gold/[0.07] px-4 py-3">
      <p className="font-sans text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#8a6f3f]">
        Preview content — not NLT text
      </p>
      {!compact ? (
        <p className="mt-1.5 font-sans text-[0.76rem] leading-relaxed text-charcoal/65">
          No licensed New Living Translation source is configured, so no substitute translation is
          shown. The NLT preference is preserved until a verified provider is connected.
        </p>
      ) : null}
    </div>
  );
}

interface ScripturePanelProps {
  passage: ScripturePassage;
  className?: string;
  size?: 'default' | 'large';
  bookmarked?: boolean;
  onBookmark?: () => void;
  onCopyReference?: () => void;
  actions?: React.ReactNode;
  showFocus?: boolean;
}

export function ScripturePanel({
  passage,
  className,
  size = 'default',
  bookmarked,
  onBookmark,
  onCopyReference,
  actions,
  showFocus = true,
}: ScripturePanelProps) {
  const paragraphs = passageParagraphs(passage.text);
  const isPlaceholder = passage.contentKind === 'placeholder';

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ScriptureReference reference={passage.reference} className="text-[1.1rem]" />
          {showFocus && passage.focus ? (
            <p className="mt-1 font-sans text-[0.72rem] uppercase tracking-[0.14em] text-charcoal/40">
              {passage.theme} · {passage.focus}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <TranslationBadge translation={passage.translation} contentKind={passage.contentKind} />
          {onCopyReference ? (
            <button
              type="button"
              onClick={onCopyReference}
              aria-label="Copy reference"
              title="Copy reference"
              className="rounded-full border border-sage/40 p-2.5 text-forest/60 transition-colors duration-300 hover:border-forest/40 hover:text-forest"
            >
              <Copy size={12} />
            </button>
          ) : null}
          {onBookmark ? (
            <button
              type="button"
              onClick={onBookmark}
              aria-label={bookmarked ? 'Remove bookmark' : 'Save to journal'}
              title={bookmarked ? 'Remove bookmark' : 'Save to journal'}
              className={cn(
                'rounded-full border p-2.5 transition-colors duration-300',
                bookmarked
                  ? 'border-gold/60 bg-gold/15 text-[#8a6f3f]'
                  : 'border-sage/40 text-forest/60 hover:border-forest/40 hover:text-forest',
              )}
            >
              {bookmarked ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        {isPlaceholder ? (
          <div className="space-y-4">
            <div className="flex gap-3 text-gold/80">
              <Quote size={16} className="mt-1 shrink-0" />
              <div className="space-y-3">
                {paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className={cn(
                      'font-serif leading-[1.95] text-charcoal/55',
                      index === 0
                        ? 'text-[1.02rem] italic tracking-[0.02em]'
                        : 'text-[0.98rem]',
                      index === paragraphs.length - 1 && 'not-italic text-[0.9rem]',
                    )}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'scripture-text',
              size === 'large' && 'text-scripture-lg',
            )}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-sage/25 pt-4">
        <p className="max-w-[52ch] font-sans text-[0.66rem] leading-relaxed text-charcoal/40">
          {passage.attribution}
        </p>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
