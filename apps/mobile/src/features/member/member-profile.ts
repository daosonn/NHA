import type { FamilyMemberSummary, FamilyTree, ProfileDetail } from '../../lib/api';
import { relationshipKey } from '../family/relationship-label';

/**
 * Who may edit this profile: **you, on your own, and nobody else**
 * (decided 2026-08-19).
 *
 * This deliberately narrows the domain model, which makes a placeholder
 * wiki-editable by the whole family (`docs/00-shared/domain-model.md`,
 * 2026-08-13). A life story written about someone by someone else is a
 * different kind of object from one they wrote themselves, and the app was
 * offering no way to tell which you were reading. What the family edits about
 * another person is their *place in the tree* — name and relationships, on
 * the family screen — not their biography.
 *
 * **The server has not narrowed.** `PATCH …/members/:memberId/profile` still
 * accepts an edit from any member of the family. The app no longer offers it;
 * making it impossible is a backend change to schedule.
 */
export type Editability = 'self' | 'locked';

/**
 * A Life Profile as the screen needs it.
 *
 * Assembled from three sources, because no single endpoint owns all of it:
 *
 * - `GET …/profile` — bio, interests, birth and death, and the account behind it.
 * - `GET …/tree` — the display name and the relation word, both of which are
 *   scoped to the family you are looking through rather than to the person.
 * - the family list — the family's own name, for the line under the name.
 *
 * There is no fallback data any more. This used to be laid over a fixture so
 * the screen had something to draw while the request was in flight, which
 * meant a real person's page could briefly show a stranger's biography.
 * Screens render a loading state instead.
 */
export type MemberProfile = {
  displayName: string;
  /** Already translated. Null for yourself, and for anyone more than one edge away. */
  relation: string | null;
  /** The family being looked through. Null when none is active. */
  familyName: string | null;
  tone: 'light' | 'dark';
  bio: string | null;
  birthDate: string | null;
  deathDate: string | null;
  interests: string[];
  editability: Editability;
};

export type MemberProfileInput = {
  detail: ProfileDetail | undefined;
  /** The row in the tree, which owns the name a placeholder is known by. */
  member: FamilyMemberSummary | undefined;
  tree: FamilyTree | undefined;
  /** The viewer's own row in that tree — every relation word is measured from it. */
  viewerMemberId: string | null;
  viewerUserId: string | null;
  familyName: string | null;
  /** Name to fall back on before either request lands. */
  fallbackName?: string;
};

export function toMemberProfile(input: MemberProfileInput): MemberProfile {
  const { detail, member, tree, viewerMemberId, viewerUserId, familyName } = input;

  const relationKey =
    tree === undefined || member === undefined
      ? null
      : relationshipKey(tree, viewerMemberId, member.id);

  return {
    // The tree row wins: for a placeholder it is the only name there is, and
    // for a linked account it is the same `User.name` the profile carries.
    displayName: member?.displayName ?? detail?.displayName ?? input.fallbackName ?? '',
    relation: relationKey,
    familyName,
    tone: toneFor(member?.id ?? null),
    bio: detail?.bio ?? null,
    birthDate: detail?.birthDate ?? null,
    deathDate: detail?.deathDate ?? null,
    interests: detail?.interests ?? [],
    editability: editability(detail, viewerUserId),
  };
}

/**
 * Permission is never assumed while a request is in flight.
 *
 * Until the server has said whose profile this is, the answer is no. The
 * alternative — guessing from whatever the screen was handed — drew an Edit
 * pencil on a stranger's face for as long as the request took, and forever if
 * it failed. Authorization is the server's to state (`CLAUDE.md` § 3); the
 * honest default is locked.
 */
function editability(detail: ProfileDetail | undefined, viewerUserId: string | null): Editability {
  if (detail === undefined || viewerUserId === null) return 'locked';
  return detail.userId === viewerUserId ? 'self' : 'locked';
}

/**
 * Which of the two placeholder stripe patterns to draw.
 *
 * Decoration, not data — nobody has an avatar yet. Keyed off the id rather
 * than a render index so one person looks the same on every screen they
 * appear on, which an index cannot promise.
 */
function toneFor(memberId: string | null): 'light' | 'dark' {
  if (memberId === null) return 'light';

  let sum = 0;
  for (let i = 0; i < memberId.length; i++) sum += memberId.charCodeAt(i);
  return sum % 2 === 0 ? 'light' : 'dark';
}
