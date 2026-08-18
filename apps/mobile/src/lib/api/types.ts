/**
 * The wire contract with `apps/api`.
 *
 * Hand-written on purpose, and derived from the NestJS controllers and DTOs
 * rather than invented: `apps/api/src/auth/` and `apps/api/src/family/`.
 * Nothing here describes an endpoint that does not exist yet — see
 * `docs/00-shared/api-contract.md` for what is still missing and which
 * screens are blocked on it.
 *
 * Two things differ from the server's own types, and both bite silently:
 *
 * 1. **Dates arrive as strings.** `FamilyDetail.createdAt` is a `Date` in
 *    the service and an ISO-8601 string by the time it reaches the app.
 *    `src/lib/date.ts` expects `YYYY-MM-DD`, so a timestamp has to be cut
 *    down before it is formatted.
 * 2. **Prisma enums are string unions here.** The app must not import from
 *    `apps/api/src/generated/`; that is the server's build output, and
 *    depending on it would tie the client to Prisma.
 */

/** `apps/api/src/generated/prisma/enums.ts` → `Gender`. */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/**
 * `apps/api/src/generated/prisma/enums.ts` → `RelationshipType`.
 *
 * These are the edges the family tree is actually built from. The kinship
 * words the UI shows ("Grandmother", "Sister") are derived from these plus
 * the direction of travel — they are not stored, and they are not what the
 * API returns.
 */
export type RelationshipType =
  'PARENT' | 'SPOUSE' | 'SIBLING' | 'ADOPTED_PARENT' | 'STEP_PARENT' | 'OTHER';

/** An ISO-8601 timestamp, e.g. `2026-08-18T04:21:00.000Z`. */
export type IsoDateTime = string;

// ---------------------------------------------------------------- auth

/** `AuthService.AuthResult` — returned by register, login, refresh, OAuth. */
export type AuthResult = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

/** `POST /api/auth/register` — password 8–72 chars, name ≤ 100. */
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
};

/** `POST /api/auth/login`. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** `POST /api/auth/refresh` and `POST /api/auth/logout`. */
export type RefreshTokenRequest = {
  refreshToken: string;
};

/** Providers wired in `apps/api/src/auth/oauth/`. */
export type OAuthProvider = 'google' | 'facebook';

// -------------------------------------------------------------- family

/** `FamilyService.FamilyMemberSummary`. */
export type FamilyMemberSummary = {
  id: string;
  /** `null` for a placeholder: a person in the tree with no account yet. */
  userId: string | null;
  displayName: string;
  gender: Gender | null;
  /** Object-storage key, not a URL. */
  avatarKey: string | null;
  joinedAt: IsoDateTime;
};

/** `GET /api/families` — one entry per family the caller belongs to. */
export type FamilySummary = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: IsoDateTime;
  memberCount: number;
};

/** `GET /api/families/:familyId` and `POST /api/families`. */
export type FamilyDetail = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: IsoDateTime;
  members: FamilyMemberSummary[];
};

/** `POST /api/families/join`. */
export type JoinFamilyResult = {
  familyId: string;
  familyName: string;
  member: FamilyMemberSummary;
};

export type RelationshipSummary = {
  id: string;
  /** For `PARENT`, this member is the parent. */
  fromMemberId: string;
  /** For `PARENT`, this member is the child. */
  toMemberId: string;
  type: RelationshipType;
  /** Free text, only meaningful when `type` is `OTHER`. */
  label: string | null;
};

/** `POST /api/families` — name ≤ 100. The invite code is generated server-side. */
export type CreateFamilyRequest = {
  name: string;
};

/**
 * `POST /api/families/join`.
 *
 * `linkMemberId` attaches the account to a placeholder that is already in
 * the tree, so everything written about that person stays attached — see
 * `docs/00-shared/domain-model.md`.
 */
export type JoinFamilyRequest = {
  inviteCode: string;
  linkMemberId?: string;
};

/** `POST /api/families/:familyId/members` — adds a placeholder. */
export type AddMemberRequest = {
  displayName: string;
  gender?: Gender;
};

/** `PATCH /api/families/:familyId/members/:memberId`. */
export type UpdateMemberRequest = Partial<AddMemberRequest>;

/** `POST /api/families/:familyId/relationships`. */
export type CreateRelationshipRequest = {
  fromMemberId: string;
  toMemberId: string;
  type: RelationshipType;
  label?: string;
};

/** What the delete endpoints return. */
export type SuccessResult = {
  success: boolean;
};
