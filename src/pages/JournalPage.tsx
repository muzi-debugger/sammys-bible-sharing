import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Feather,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApp } from '@/context/AppContext';
import { Badge, Button, Card, SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDayMonth, parseIsoDate } from '@/lib/dates';
import { journalService } from '@/services/journal';
import type { JournalEntry, JournalEntryType } from '@/types';

const FILTERS: Array<{ id: JournalEntryType | 'all'; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'weekly', label: 'Weekly studies' },
  { id: 'daily', label: 'Daily encouragement' },
  { id: 'bookmark', label: 'Bookmarked' },
  { id: 'reflection', label: 'Reflections' },
];

const TYPE_LABELS: Record<JournalEntryType, string> = {
  weekly: 'Weekly study',
  daily: 'Daily encouragement',
  bookmark: 'Bookmark',
  reflection: 'Reflection',
};

const TYPE_TONES: Record<JournalEntryType, 'forest' | 'gold' | 'terracotta' | 'sage'> = {
  weekly: 'forest',
  daily: 'gold',
  bookmark: 'sage',
  reflection: 'terracotta',
};

export function JournalPage() {
  const { db, user, partner } = useApp();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JournalEntryType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [editBody, setEditBody] = useState('');
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);

  const entries = useMemo(() => {
    return journalService.listForUser(user.id, {
      search,
      types: filter === 'all' ? [] : [filter],
    });
  }, [db, user.id, search, filter]);

  const counts = useMemo(() => {
    const all = journalService.listForUser(user.id, { search: '', types: [] });
    return {
      all: all.length,
      weekly: all.filter((entry) => entry.type === 'weekly').length,
      daily: all.filter((entry) => entry.type === 'daily').length,
      bookmark: all.filter((entry) => entry.type === 'bookmark').length,
      reflection: all.filter((entry) => entry.type === 'reflection').length,
    } as Record<JournalEntryType | 'all', number>;
  }, [db, user.id]);

  const openEditor = (entry: JournalEntry) => {
    setEditing(entry);
    setEditBody(entry.body);
  };

  const saveReflection = () => {
    if (!editing) return;
    if (!editBody.trim()) {
      notify('A reflection cannot be empty.', 'info');
      return;
    }
    journalService.saveReflection(user.id, editing.reference, editBody.trim());
    notify('Reflection updated.');
    setEditing(null);
  };

  const removeBookmark = (entry: JournalEntry) => {
    const bookmark = journalService.getBookmark(user.id, entry.reference);
    if (!bookmark) return;
    journalService.removeBookmark(user.id, bookmark.id);
    notify('Bookmark removed.', 'info');
    setPendingDelete(null);
  };

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Scripture Journal</p>
        <h1 className="mt-3 font-serif text-[2rem] leading-tight text-forest sm:text-[2.4rem]">
          A record of what you have read
        </h1>
        <p className="mt-2 max-w-reading font-sans text-[0.85rem] leading-relaxed text-charcoal/60">
          Your own notebooks, daily encouragements and bookmarks — searchable, and visible only to
          you. {partner.name}&rsquo;s journal stays entirely separate.
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/35"
            />
            <label htmlFor="journal-search" className="sr-only">
              Search your journal
            </label>
            <input
              id="journal-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by book, reference, or a word you wrote…"
              className="w-full rounded-[10px] border border-sage/45 bg-soft-white py-2.5 pl-10 pr-9 font-sans text-[0.85rem] text-charcoal placeholder:text-charcoal/35 focus:border-forest/50 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/35 hover:text-charcoal/70"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
          <p className="font-sans text-[0.7rem] text-charcoal/40 sm:text-right">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 font-sans text-[0.72rem] transition-colors duration-300',
                filter === entry.id
                  ? 'border-forest bg-forest text-ivory'
                  : 'border-sage/40 text-charcoal/55 hover:border-forest/40 hover:text-forest',
              )}
            >
              {entry.label}
              <span className={cn('ml-1.5', filter === entry.id ? 'text-ivory/60' : 'text-charcoal/30')}>
                {counts[entry.id]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="Your journey through the Word starts here."
          description={
            search
              ? 'Nothing in your own journal matches that search yet. Try another word or reference.'
              : 'Save a passage, write a reflection, or open your Sunday notebook — everything you keep will gather here.'
          }
          action={
            search ? (
              <Button variant="secondary" onClick={() => setSearch('')}>
                Clear search
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => navigate('/')}>
                Go to today&rsquo;s Scripture
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TYPE_TONES[entry.type]}>{TYPE_LABELS[entry.type]}</Badge>
                      <Badge tone="gold">NLT</Badge>
                      {entry.isSample ? <Badge tone="muted">Sample</Badge> : null}
                    </div>
                    <h2 className="mt-2.5 font-serif text-[1.25rem] leading-tight text-forest">
                      {entry.reference}
                    </h2>
                    <p className="mt-1 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-charcoal/40">
                      {formatDayMonth(parseIsoDate(entry.date))}
                      {entry.theme ? ` · ${entry.theme}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.type === 'weekly' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconRight={<ArrowRight size={12} />}
                        onClick={() => navigate('/sunday-study')}
                      >
                        Open notebook
                      </Button>
                    ) : null}
                    {entry.type === 'reflection' ? (
                      <Button variant="ghost" size="sm" onClick={() => openEditor(entry)}>
                        Edit
                      </Button>
                    ) : null}
                    {entry.type === 'bookmark' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        onClick={() => setPendingDelete(entry)}
                      >
                        Remove
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
                      className="rounded-full border border-sage/40 p-1.5 text-charcoal/45 transition-colors hover:text-forest"
                    >
                      <ChevronDown
                        size={13}
                        className={cn('transition-transform duration-300', isExpanded && 'rotate-180')}
                      />
                    </button>
                  </div>
                </div>

                {entry.note ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 font-sans text-[0.72rem] text-terracotta/80">
                    <Bookmark size={11} /> {entry.note}
                  </p>
                ) : null}

                <p
                  className={cn(
                    'mt-3 font-serif text-[0.98rem] leading-[1.9] text-charcoal/65',
                    !isExpanded && 'line-clamp-2',
                  )}
                >
                  {entry.body || 'No writing saved for this entry yet.'}
                </p>

                {isExpanded && entry.type === 'weekly' ? (
                  <p className="mt-3 flex items-center gap-1.5 font-sans text-[0.68rem] text-charcoal/40">
                    <Feather size={11} className="text-gold" />
                    This entry mirrors your own private notebook for that week.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <SectionHeading
        title="Sample entries are labelled"
        description="Entries marked Sample came from the preview seed. Anything you write or bookmark is saved in this browser and marked as yours, clearly separate from sample content."
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        eyebrow={editing ? `${editing.reference} · NLT` : ''}
        title="Edit your reflection"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveReflection}>Save changes</Button>
          </>
        }
      >
        <label htmlFor="edit-reflection" className="sr-only">
          Reflection
        </label>
        <textarea
          id="edit-reflection"
          value={editBody}
          onChange={(event) => setEditBody(event.target.value)}
          className="writing-area min-h-[200px]"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this bookmark?"
        description="The passage will disappear from your journal. Your reflections are not affected."
        confirmLabel="Remove bookmark"
        onConfirm={() => pendingDelete && removeBookmark(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
