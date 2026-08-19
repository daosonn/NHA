/**
 * Stand-in Life Profile data.
 *
 * Field names follow `apps/api/prisma/schema.prisma` so wiring the real API
 * later is a swap, not a rewrite:
 *
 * - `LifeProfile` holds bio / interests / birthDate / deathDate and is
 *   **global** — one per person, shown in every family they belong to.
 * - `relation` is NOT on the profile: it comes from `Relationship` and is
 *   therefore scoped to the family you are viewing from.
 * - `lifeEvents` is `LifeEvent`, ordered oldest first — a life reads forward.
 * - `gallery` is **derived**, not an album: media from posts that tag this
 *   member (`PostMemberTag`) plus media attached to their life events.
 *   `Album` in the schema is private to its owner and is a different thing.
 * - `memos` is `Memo` — notes *about* this member, visible only to their
 *   author (`ownerUserId`), on every profile they open.
 */

/** Who may edit this profile. Derived from the rules in domain-model.md. */
export type Editability =
  /** The viewer's own profile. */
  | 'self'
  /** Placeholder for someone without an account — wiki-editable by the family. */
  | 'wiki'
  /** A linked account that is not the viewer — only they can edit it. */
  | 'locked';

export type MemoCategory = 'hobbies' | 'health' | 'gift' | 'memories' | 'todo';

export type LifeEventItem = {
  id: string;
  title: string;
  description: string | null;
  /** ISO date. `LifeEvent.eventDate` is a DATE column — no time, no zone. */
  eventDate: string;
  place: string | null;
  mediaCount: number;
};

export type GalleryItem = {
  id: string;
  tone: 'light' | 'dark';
};

/**
 * A private note *about* a member, written by the viewer.
 *
 * No author field on purpose: `Memo.ownerUserId` is the only person who can
 * ever read one (`docs/00-shared/domain-model.md`), so on any profile you open
 * every note here is your own. An author line would be the same name repeated
 * down the screen, and would imply the notes are shared when they are not.
 */
export type MemoItem = {
  id: string;
  /** The bold line on the card and the heading of the detail screen. */
  title: string;
  /** The longer text under it. Paragraphs are split on a blank line. */
  body: string | null;
  category: MemoCategory;
  createdAt: string;
  updatedAt: string;
  /** Tone stand-ins, same as `gallery` — there are no real images yet. */
  photos: GalleryItem[];
};

export type MemberProfile = {
  id: string;
  displayName: string;
  /** From the family you are viewing through, not from the profile. */
  relation: string;
  tone: 'light' | 'dark';
  bio: string | null;
  birthDate: string | null;
  deathDate: string | null;
  interests: string[];
  editability: Editability;
  lifeEvents: LifeEventItem[];
  gallery: GalleryItem[];
  memos: MemoItem[];
};

const mai: MemberProfile = {
  id: 'mai',
  displayName: 'Mai',
  relation: 'Mother',
  tone: 'dark',
  bio: 'Grew up in Hue, moved south at nineteen and never stopped cooking for everyone who walked in. Keeps every letter she has ever received.',
  birthDate: '1968-04-12',
  deathDate: null,
  interests: ['Gardening', 'Hue cooking', 'Cải lương', 'Letter writing'],
  editability: 'locked',
  lifeEvents: [
    {
      id: 'e1',
      title: 'Born in Hue',
      description: 'The third of five children, in the house on Chi Lang street.',
      eventDate: '1968-04-12',
      place: 'Hue',
      mediaCount: 1,
    },
    {
      id: 'e2',
      title: 'Moved to Saigon',
      description: 'Left for work at nineteen, with one suitcase and her mother’s recipe book.',
      eventDate: '1987-09-01',
      place: 'Ho Chi Minh City',
      mediaCount: 3,
    },
    {
      id: 'e3',
      title: 'Married Hoang',
      description: null,
      eventDate: '1994-11-20',
      place: 'Ho Chi Minh City',
      mediaCount: 8,
    },
    {
      id: 'e4',
      title: 'Minh was born',
      description: 'Two weeks early, on a morning with no electricity.',
      eventDate: '1998-02-03',
      place: 'Ho Chi Minh City',
      mediaCount: 12,
    },
    {
      id: 'e5',
      title: 'Opened the garden',
      description: 'Turned the back lot into the vegetable garden that still feeds the street.',
      eventDate: '2019-05-18',
      place: 'Ho Chi Minh City',
      mediaCount: 5,
    },
  ],
  gallery: [
    { id: 'm1', tone: 'dark' },
    { id: 'm2', tone: 'light' },
    { id: 'm3', tone: 'light' },
    { id: 'm4', tone: 'dark' },
    { id: 'm5', tone: 'light' },
    { id: 'm6', tone: 'dark' },
    { id: 'm7', tone: 'dark' },
    { id: 'm8', tone: 'light' },
    { id: 'm9', tone: 'light' },
  ],
  memos: [
    {
      id: 'n1',
      title: 'Clay teapot she kept looking at',
      body: 'Bat Trang, the shop near the ferry. The brown one with the bamboo handle — she picked it up twice and put it back both times.\n\nAround 400k. Ask for the same shape but without the crack near the lid.',
      category: 'gift',
      createdAt: '2026-08-05',
      updatedAt: '2026-08-05',
      photos: [
        { id: 'p1', tone: 'dark' },
        { id: 'p2', tone: 'light' },
        { id: 'p3', tone: 'light' },
      ],
    },
    {
      id: 'n2',
      title: 'Allergic to shellfish',
      body: 'The whole family forgets this every Tet.',
      category: 'health',
      createdAt: '2026-07-02',
      updatedAt: '2026-08-12',
      photos: [],
    },
    {
      id: 'n3',
      title: 'Waters the garden at 6am',
      body: 'Never later than seven, even in the rain.',
      category: 'hobbies',
      createdAt: '2026-08-16',
      updatedAt: '2026-08-16',
      photos: [],
    },
    {
      id: 'n4',
      title: 'The year in Hue before she moved',
      body: 'She has never told the whole story. Record it this time.',
      category: 'memories',
      createdAt: '2026-05-30',
      updatedAt: '2026-05-30',
      photos: [],
    },
  ],
};

/** The viewer's own profile, for the Profile tab. */
const minh: MemberProfile = {
  id: 'minh',
  displayName: 'Minh',
  relation: 'You',
  tone: 'light',
  bio: null,
  birthDate: '1998-02-03',
  deathDate: null,
  interests: ['Film photography', 'Running'],
  editability: 'self',
  lifeEvents: [
    {
      id: 'e1',
      title: 'Born in Ho Chi Minh City',
      description: null,
      eventDate: '1998-02-03',
      place: 'Ho Chi Minh City',
      mediaCount: 12,
    },
  ],
  gallery: [
    { id: 'm1', tone: 'light' },
    { id: 'm2', tone: 'dark' },
    { id: 'm3', tone: 'light' },
  ],
  memos: [],
};

/** A placeholder: someone in the tree who has no account yet. */
const linh: MemberProfile = {
  id: 'linh',
  displayName: 'Linh',
  relation: 'Sister',
  tone: 'dark',
  bio: null,
  birthDate: null,
  deathDate: null,
  interests: [],
  editability: 'wiki',
  lifeEvents: [],
  gallery: [],
  memos: [],
};

const PROFILES: Record<string, MemberProfile> = {
  mai,
  minh,
  linh,
};

/** Every tree node routes here, so unknown ids must degrade, not crash. */
export function getMemberProfile(id: string): MemberProfile {
  return PROFILES[id] ?? { ...linh, id, displayName: id, relation: 'Family' };
}

export const viewerProfile = minh;
