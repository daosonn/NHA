import type { MemberProfile } from '../../fixtures/member';
import type { ProfileDetail } from '../../lib/api';

/**
 * Real profile fields laid over the fixture the screen still needs.
 *
 * `GET …/profile` owns five things — name, bio, interests, birth and death.
 * Everything else the Life Profile draws (the timeline, the derived gallery,
 * the relation word, the avatar tone) has no endpoint yet, so the fixture
 * keeps supplying it. This is the seam: when `LifeEvent` and the gallery
 * arrive, they replace fields here rather than the whole screen.
 *
 * The fixture still supplies the text while the query is in flight, so the
 * screen renders something the moment it opens instead of blinking — but
 * **never the permission**. `whenUnknown` says what to assume until the
 * server has spoken, and the answer for anyone but yourself is `locked`:
 * the fixtures mark most people wiki-editable, and trusting that would draw
 * an Edit pencil on a stranger's face for as long as the request took, or
 * forever if it failed. Permissions are the server's to state
 * (`CLAUDE.md` § 3); the honest default is no.
 */
export function withProfileDetail(
  base: MemberProfile,
  detail: ProfileDetail | undefined,
  viewerUserId: string | null,
  whenUnknown: MemberProfile['editability'] = 'locked',
): MemberProfile {
  if (detail === undefined) return { ...base, editability: whenUnknown };

  return {
    ...base,
    displayName: detail.displayName,
    bio: detail.bio,
    interests: detail.interests,
    birthDate: detail.birthDate,
    deathDate: detail.deathDate,
    editability: editability(detail, viewerUserId),
  };
}

/**
 * Who the Edit affordance is drawn for: **you, on your own profile, and
 * nobody else** (decided 2026-08-19).
 *
 * This deliberately narrows the domain model, which makes a placeholder
 * wiki-editable by the whole family (`docs/00-shared/domain-model.md`,
 * 2026-08-13). A life story written about someone by someone else is a
 * different kind of object from one they wrote themselves, and the app was
 * offering no way to tell which you were reading. What the family edits about
 * another person is their *place in the tree* — name and relationships, on the
 * family screen — not their biography.
 *
 * Two consequences worth knowing:
 *
 * - `'wiki'` is still in the type and `ProfileHero` still renders it, because
 *   the decision is a UI one and reversing it is this function alone.
 * - **The server has not narrowed.** `PATCH …/members/:memberId/profile` still
 *   accepts an edit from any member of the family. The app no longer offers
 *   it; making it impossible is a backend change to schedule.
 *
 * Only ever decides what to *draw*. Authorization stays the server's
 * (`CLAUDE.md` § 3) — a PATCH it refuses comes back 403 and the edit screen
 * says so.
 */
function editability(
  detail: ProfileDetail,
  viewerUserId: string | null,
): MemberProfile['editability'] {
  if (viewerUserId !== null && detail.userId === viewerUserId) return 'self';
  return 'locked';
}
