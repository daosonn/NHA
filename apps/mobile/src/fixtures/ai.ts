/**
 * Stand-in data for the AI section.
 *
 * Two rules are encoded here rather than in the screens, because they are
 * product rules and the UI must not be able to break them:
 *
 * 1. An occasion is a date the family keeps. Some follow the lunar calendar
 *    (`note`), so the Gregorian day drifts every year and cannot be stored
 *    as a fixed date — see `docs/00-shared/domain-model.md`.
 * 2. Every suggestion carries `why` and `source`. A gift idea nobody can
 *    trace back to a memo, a photo or the timeline is a guess wearing the
 *    family's clothes, and the person reading it has no way to tell.
 */

export type OccasionKind = 'birthday' | 'memorial' | 'anniversary' | 'holiday' | 'milestone';

export type Occasion = {
  id: string;
  title: string;
  /** Day of the month it lands on this year. */
  day: number;
  month: string;
  daysAway: number;
  kind: OccasionKind;
  /** Anything that qualifies the date — a lunar reckoning, a time, a place. */
  note: string | null;
};

export type FeaturedOccasion = Occasion & {
  /** What the family has arranged so far. */
  status: string;
  location: string | null;
};

export const featuredOccasion: FeaturedOccasion = {
  id: 'oc_dad_62',
  title: 'Dad turns 62',
  day: 14,
  month: 'Mar',
  daysAway: 9,
  kind: 'birthday',
  note: 'Sat 14 March',
  status: 'nothing planned',
  location: null,
};

export const upcomingOccasions: Occasion[] = [
  {
    id: 'oc_anniversary_30',
    title: 'Mom & Dad · 30 years',
    day: 29,
    month: 'Mar',
    daysAway: 24,
    kind: 'anniversary',
    note: null,
  },
  {
    id: 'oc_grandma_memorial',
    title: "Grandma's memorial",
    day: 6,
    month: 'Apr',
    daysAway: 32,
    kind: 'memorial',
    note: 'lunar 10/2',
  },
  {
    id: 'oc_linh_graduation',
    title: 'Linh graduates',
    day: 19,
    month: 'May',
    daysAway: 75,
    kind: 'milestone',
    note: null,
  },
];

/** Everything on the calendar, including the ones not shown above. */
export const occasionCount = 9;

export type GiftPerson = {
  id: string;
  name: string;
  tone: 'light' | 'dark';
};

export const giftPeople: GiftPerson[] = [
  { id: 'dad', name: 'Dad', tone: 'light' },
  { id: 'mom', name: 'Mom', tone: 'dark' },
  { id: 'minh', name: 'Minh', tone: 'light' },
  { id: 'lan', name: 'Lan', tone: 'dark' },
];

export type GiftIdea = {
  id: string;
  title: string;
  price: string;
  tags: string[];
  /** Why this, for this person — in the family's own evidence. */
  why: string;
  /** Where that evidence lives, so it can be checked. */
  source: string;
};

/**
 * What the suggestions were read out of, stated before the suggestions.
 * Counts rather than a sentence: the sentence is copy and lives in the
 * catalogue, the numbers are what the AI service will actually return.
 */
export const giftEvidence = { notes: 12, photos: 248, gifts: 3 };

export const giftIdeas: GiftIdea[] = [
  {
    id: 'gift_teapot',
    title: 'Clay teapot from Bat Trang',
    price: '800,000 – 1,200,000₫',
    tags: ['Bat Trang', 'In his taste'],
    why: 'He stopped at the shop near the ferry twice and kept looking at the same one.',
    source: "From Lan's note · 2 weeks ago",
  },
  {
    id: 'gift_shears',
    title: 'Bonsai pruning set, carbon steel',
    price: '450,000₫',
    tags: ['Hobbies', 'Practical'],
    why: 'Waters the bonsai every morning at 6. His current shears appear in a 2019 photo.',
    source: "From Minh's note + album",
  },
  {
    id: 'gift_reprint',
    title: 'Reprint the 1998 wedding photo',
    price: '120,000₫',
    tags: ['Sentimental', 'Under 200k'],
    why: 'Only one copy exists and it is fading. Mom mentioned reframing it.',
    source: 'From the Timeline · 1998',
  },
];
