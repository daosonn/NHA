import type { FamilyGroupSummary } from '../components/home/group-strip';

/**
 * Stand-in data for the Home screen.
 *
 * Replace with react-query hooks against the NestJS API once the endpoints
 * exist — see docs/01-frontend/architecture.md. Shapes here are a guess at
 * the contract, not the contract itself.
 */

export type UpcomingEvent = {
  id: string;
  countdown: string;
  title: string;
  when: string;
  where: string;
  /** How many events the widget can page through. */
  total: number;
  index: number;
};

export type Recommendation = {
  id: string;
  title: string;
  meta?: string;
  tone: 'light' | 'dark';
};

export const familyGroups: FamilyGroupSummary[] = [
  { id: 'g1', name: 'Nguyen family', tone: 'light' },
  { id: 'g2', name: 'Cousins', tone: 'dark' },
  { id: 'g3', name: 'Hue side', tone: 'light' },
];

/** Groups beyond the three the strip shows. */
export const remainingGroupCount = 6;

export const upcomingEvent: UpcomingEvent = {
  id: 'e1',
  countdown: 'IN 3 DAYS',
  title: "Grandma & Grandpa's 50th anniversary",
  when: 'Sun 16 Aug · 15:00',
  where: 'The old house garden',
  total: 3,
  index: 0,
};

export const recommendations: {
  feature: Recommendation;
  secondary: [Recommendation, Recommendation];
} = {
  feature: { id: 'r1', title: 'Tet at home', meta: '31 photos', tone: 'light' },
  secondary: [
    { id: 'r2', title: 'On this day, 2019', tone: 'dark' },
    { id: 'r3', title: 'Dad & the workshop', tone: 'light' },
  ],
};

export const notificationCount = 3;
