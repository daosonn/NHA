/**
 * Stand-in data for the Home screen.
 *
 * Replace with react-query hooks against the NestJS API once the endpoints
 * exist — see docs/01-frontend/architecture.md. Shapes here are a guess at
 * the contract, not the contract itself.
 */

export type Recommendation = {
  id: string;
  title: string;
  meta?: string;
  tone: 'light' | 'dark';
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
