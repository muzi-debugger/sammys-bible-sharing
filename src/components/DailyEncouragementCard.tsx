import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Candle } from '@/components/Botanical';
import { Button, Card } from '@/components/ui/primitives';
import { ScriptureReference, TranslationBadge } from '@/components/ScripturePanel';
import { passageParagraphs } from '@/services/passageFactory';
import type { DailyScriptureRecord } from '@/types';

export function DailyEncouragementCard({
  record,
  bookmarked,
  onToggleBookmark,
  onReflect,
}: {
  record: DailyScriptureRecord;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onReflect: () => void;
}) {
  const paragraphs = passageParagraphs(record.passage.text);

  return (
    <Card className="flex h-full flex-col p-6" tone="cream">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">A little encouragement for today</p>
          <p className="mt-2 font-sans text-[0.7rem] uppercase tracking-[0.14em] text-terracotta/80">
            {record.theme}
          </p>
        </div>
        <Candle className="h-8 w-5 shrink-0 text-gold/70" />
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {paragraphs.slice(1, 3).map((paragraph, index) => (
          <p
            key={index}
            className="font-serif text-[0.98rem] leading-[1.9] text-charcoal/65 italic"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sage/30 pt-3.5">
        <div className="flex items-center gap-2">
          <ScriptureReference reference={record.passage.reference} className="text-[0.92rem]" />
          <TranslationBadge
            translation={record.passage.translation}
            contentKind={record.passage.contentKind}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
            onClick={onToggleBookmark}
          >
            {bookmarked ? 'Saved' : 'Save'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReflect}>
            Reflect
          </Button>
        </div>
      </div>
    </Card>
  );
}
