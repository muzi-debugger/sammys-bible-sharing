import { parseReference } from '@/data/references';
import type { PassageContentKind, ScripturePassage, TranslationId } from '@/types';

export const TRANSLATION_LABEL = 'New Living Translation (NLT)';

/**
 * Builds an explicitly labelled preview passage.
 *
 * The New Living Translation is copyrighted and this build has no licensed
 * NLT source configured, so we never present substitute text as Scripture and
 * never reproduce NLT wording. The placeholder makes the gap visible instead.
 */
export function makePlaceholderPassage(
  reference: string,
  theme: string,
  focus: string,
  providerId: string,
  providerName: string,
  retrievedAt = new Date().toISOString(),
): ScripturePassage {
  const parsed = parseReference(reference);
  const text = [
    'Preview placeholder — not Scripture text.',
    `The New Living Translation text of ${reference} is not included in this build. No licensed NLT provider is connected yet, and the app deliberately shows no substitute translation.`,
    `This passage explores ${focus}.`,
    'Once a verified NLT provider is configured (Settings → Bible translation), the full passage will appear here and the translation badge will change from “Preview” to “NLT”.',
  ].join('\n\n');

  return {
    reference,
    book: parsed.book,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
    translation: 'NLT',
    text,
    attribution:
      'No NLT text reproduced. New Living Translation copyright © Tyndale House Publishers. Display and redistribution require a licence.',
    providerId,
    providerName,
    retrievedAt,
    contentKind: 'placeholder',
    theme,
    focus,
  };
}

export function passageParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export function passageExcerpt(passage: ScripturePassage, maxLength = 180): string {
  if (passage.contentKind === 'placeholder') {
    return `Preview placeholder. ${passage.focus.charAt(0).toUpperCase()}${passage.focus.slice(1)} — licensed NLT text pending.`;
  }
  const flat = passage.text.replace(/\s+/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength).trimEnd()}…` : flat;
}

export function translationBadgeLabel(
  translation: TranslationId,
  contentKind: PassageContentKind,
): string {
  return contentKind === 'licensed' ? translation : `${translation} · Preview`;
}
