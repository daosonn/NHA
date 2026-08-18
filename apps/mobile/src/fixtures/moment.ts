import type { AudienceGroup } from '../components/moment/audience-picker';
import type { DraftMedia } from '../components/moment/media-strip';

/**
 * Stand-in data for the New moment screen.
 *
 * Shapes follow `apps/api/prisma/schema.prisma`:
 *
 * - a moment is a `Post` (`type: POST | EVENT`, `content`, `place`),
 * - the audience is `PostFamily` — one row per family the post reaches, so a
 *   post can go to several families at once,
 * - **no `PostFamily` rows at all means private to the author**
 *   (`database.md` § Post). That is why the screen has no separate "private"
 *   switch: deselecting every group *is* the private case, and the button
 *   says so.
 * - each attachment is a `Media` row; `mimeType` is what separates a photo
 *   from a video, so the draft carries `kind` rather than two lists.
 */

/**
 * Every family the author belongs to. The picker starts with all of them
 * selected, which matches the mockup: sharing widely is the normal case and
 * narrowing is the deliberate act.
 */
export const audienceGroups: AudienceGroup[] = [
  { id: 'g1', name: 'Nguyen family', tone: 'light', memberCount: 12 },
  { id: 'g2', name: 'Cousins', tone: 'dark', memberCount: 8 },
  { id: 'g3', name: 'Hue side', tone: 'light', memberCount: 5 },
  { id: 'g4', name: 'Grandma', tone: 'dark', memberCount: 4 },
  { id: 'g5', name: 'Bac Ninh', tone: 'light', memberCount: 9 },
];

export const draftMedia: DraftMedia[] = [
  { id: 'm1', kind: 'photo', tone: 'light' },
  { id: 'm2', kind: 'video', tone: 'dark', duration: '0:12' },
];

export const draftCaption = 'Sunday lunch at the old house';
