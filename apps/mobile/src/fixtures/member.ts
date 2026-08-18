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

export type MemoItem = {
  id: string;
  content: string;
  category: MemoCategory;
  updatedAt: string;
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
      content: 'Allergic to shellfish — the whole family forgets this every Tet.',
      category: 'health',
      updatedAt: '2026-07-02',
    },
    {
      id: 'n2',
      content: 'Wants the blue ceramic planters from the shop on Le Loi. Birthday idea.',
      category: 'gift',
      updatedAt: '2026-06-21',
    },
    {
      id: 'n3',
      content:
        'Ask her about the year in Hue before she moved — she has never told the whole story.',
      category: 'memories',
      updatedAt: '2026-05-30',
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
