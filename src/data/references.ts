export type Theme =
  | 'Hope'
  | 'Love'
  | 'Wisdom'
  | 'Faith'
  | 'Courage'
  | 'Patience'
  | 'Gratitude'
  | 'Peace'
  | 'Perseverance'
  | 'Forgiveness';

export interface ReferenceDefinition {
  reference: string;
  theme: Theme;
  /** One line describing what the passage explores. Never Scripture text. */
  focus: string;
}

export function parseReference(reference: string): {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
} {
  const match = /^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/.exec(reference.trim());
  if (!match) {
    return { book: reference, chapter: 1, verseStart: 1, verseEnd: 1 };
  }
  const [, book, chapter, verseStart, verseEnd] = match;
  return {
    book,
    chapter: Number(chapter),
    verseStart: Number(verseStart),
    verseEnd: Number(verseEnd ?? verseStart),
  };
}

/** Broader pool used by the weekly assignment generator. */
export const WEEKLY_REFERENCE_POOL: ReferenceDefinition[] = [
  { reference: 'Psalm 23:1-6', theme: 'Faith', focus: 'God as shepherd, provider and guide' },
  { reference: 'Philippians 4:6-7', theme: 'Peace', focus: 'prayer that steadies an anxious heart' },
  { reference: 'Proverbs 3:5-6', theme: 'Wisdom', focus: 'trusting God’s direction over our own understanding' },
  { reference: 'Isaiah 40:28-31', theme: 'Patience', focus: 'renewed strength for those who wait' },
  { reference: '1 Corinthians 13:4-7', theme: 'Love', focus: 'what patient, enduring love looks like in practice' },
  { reference: 'Hebrews 11:1-3', theme: 'Faith', focus: 'the substance of things hoped for' },
  { reference: 'Joshua 1:7-9', theme: 'Courage', focus: 'courage rooted in God’s constant presence' },
  { reference: 'Psalm 100:1-5', theme: 'Gratitude', focus: 'grateful worship and God’s steadfast goodness' },
  { reference: 'James 1:2-4', theme: 'Perseverance', focus: 'endurance that matures our character' },
  { reference: 'Colossians 3:12-14', theme: 'Forgiveness', focus: 'clothing ourselves in compassion and forgiveness' },
  { reference: 'Romans 15:4-6', theme: 'Hope', focus: 'endurance and encouragement drawn from Scripture' },
  { reference: 'Psalm 119:105-112', theme: 'Wisdom', focus: 'God’s word as light for the path ahead' },
  { reference: 'Ephesians 4:29-32', theme: 'Forgiveness', focus: 'gracious words and letting go of resentment' },
  { reference: 'Romans 12:9-13', theme: 'Love', focus: 'sincere love expressed in ordinary devotion' },
  { reference: 'Psalm 27:1-5', theme: 'Courage', focus: 'confidence in God when circumstances feel uncertain' },
  { reference: 'Matthew 11:28-30', theme: 'Peace', focus: 'rest offered to the weary' },
  { reference: 'Lamentations 3:22-26', theme: 'Hope', focus: 'mercies that are new every morning' },
  { reference: 'Galatians 6:7-10', theme: 'Perseverance', focus: 'not growing weary in doing good' },
  { reference: 'Proverbs 4:20-27', theme: 'Wisdom', focus: 'guarding the heart and choosing a steady path' },
  { reference: '1 Thessalonians 5:16-18', theme: 'Gratitude', focus: 'giving thanks in every season' },
  { reference: 'John 15:9-12', theme: 'Love', focus: 'remaining in love and sharing joy' },
  { reference: 'Psalm 34:1-8', theme: 'Gratitude', focus: 'blessing the Lord at all times' },
  { reference: 'Micah 6:8', theme: 'Faith', focus: 'walking humbly with God' },
  { reference: '2 Corinthians 4:16-18', theme: 'Perseverance', focus: 'renewing the inward self day by day' },
  { reference: 'Psalm 139:1-6', theme: 'Faith', focus: 'being fully known and fully loved' },
  { reference: 'Isaiah 41:8-13', theme: 'Courage', focus: 'strength for the fearful heart' },
];

/** Curated motivational references, grouped by theme for the daily encouragement. */
export const DAILY_REFERENCE_POOL: ReferenceDefinition[] = [
  { reference: 'Psalm 42:11', theme: 'Hope', focus: 'speaking hope to a discouraged heart' },
  { reference: 'Romans 15:13', theme: 'Hope', focus: 'overflowing with hope by the power of the Spirit' },
  { reference: 'Jeremiah 29:11', theme: 'Hope', focus: 'God’s good intentions for our future' },
  { reference: '1 Corinthians 13:4-7', theme: 'Love', focus: 'love that is patient and kind' },
  { reference: '1 John 4:19', theme: 'Love', focus: 'loving because we are first loved' },
  { reference: 'Proverbs 17:17', theme: 'Love', focus: 'friendship and love that stands firm' },
  { reference: 'Proverbs 3:5-6', theme: 'Wisdom', focus: 'trusting God with the whole heart' },
  { reference: 'James 1:5', theme: 'Wisdom', focus: 'asking God for wisdom' },
  { reference: 'Psalm 119:105', theme: 'Wisdom', focus: 'God’s word as a lamp to our feet' },
  { reference: 'Hebrews 11:1', theme: 'Faith', focus: 'the substance of things hoped for' },
  { reference: '2 Corinthians 5:7', theme: 'Faith', focus: 'walking by faith rather than sight' },
  { reference: 'Mark 11:24', theme: 'Faith', focus: 'praying with believing hearts' },
  { reference: 'Joshua 1:9', theme: 'Courage', focus: 'strength and courage in God’s presence' },
  { reference: 'Isaiah 41:10', theme: 'Courage', focus: 'fear not, for God upholds us' },
  { reference: '2 Timothy 1:7', theme: 'Courage', focus: 'power, love and a sound mind' },
  { reference: 'Psalm 27:14', theme: 'Patience', focus: 'waiting with a strengthened heart' },
  { reference: 'Romans 12:12', theme: 'Patience', focus: 'rejoicing in hope and being patient in trouble' },
  { reference: 'Galatians 6:9', theme: 'Perseverance', focus: 'not growing weary in doing good' },
  { reference: '1 Thessalonians 5:18', theme: 'Gratitude', focus: 'giving thanks in every circumstance' },
  { reference: 'Psalm 107:1', theme: 'Gratitude', focus: 'giving thanks for God’s enduring love' },
  { reference: 'Colossians 3:15', theme: 'Gratitude', focus: 'a thankful heart at peace' },
  { reference: 'Psalm 4:8', theme: 'Peace', focus: 'resting in safety' },
  { reference: 'John 14:27', theme: 'Peace', focus: 'a peace the world cannot give' },
  { reference: 'Isaiah 26:3', theme: 'Peace', focus: 'a steady mind kept in perfect peace' },
  { reference: 'Romans 5:3-5', theme: 'Perseverance', focus: 'hope shaped through endurance' },
  { reference: 'Philippians 3:13-14', theme: 'Perseverance', focus: 'pressing on toward the goal' },
  { reference: 'Ephesians 4:31-32', theme: 'Forgiveness', focus: 'kindness and tender forgiveness' },
  { reference: 'Colossians 3:13', theme: 'Forgiveness', focus: 'forgiving as we have been forgiven' },
  { reference: 'Psalm 103:11-12', theme: 'Forgiveness', focus: 'mercy that removes our transgressions' },
  { reference: 'Matthew 6:14', theme: 'Forgiveness', focus: 'forgiving others from the heart' },
];

export const DAILY_THEMES: Theme[] = [
  'Hope',
  'Love',
  'Wisdom',
  'Faith',
  'Courage',
  'Patience',
  'Gratitude',
  'Peace',
  'Perseverance',
  'Forgiveness',
];
