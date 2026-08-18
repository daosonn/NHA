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

/**
 * `GET /api/families/:familyId/tree` — nodes and edges in one payload.
 *
 * The server does not lay the tree out and does not name the relationships:
 * "Grandmother" is derived from these edges plus the direction of travel and
 * who is looking (`docs/00-shared/api-contract.md`).
 */
export type FamilyTree = {
  id: string;
  name: string;
  members: FamilyMemberSummary[];
  relationships: RelationshipSummary[];
};

// --------------------------------------------------------------- posts

/** `apps/api/src/generated/prisma/enums.ts` → `PostType`. */
export type PostType = 'POST' | 'EVENT';

/** `apps/api/src/generated/prisma/enums.ts` → `ReactionType`. */
export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD';

/** An attachment as it appears on a post — no URL, fetch it by id. */
export type PostMediaSummary = {
  id: string;
  mimeType: string;
  sizeBytes: number;
};

/** `PostService.PostDetail`. */
export type PostDetail = {
  id: string;
  authorUserId: string;
  authorName: string;
  type: PostType;
  content: string | null;
  /** Only set for `EVENT`. */
  eventDate: IsoDateTime | null;
  eventTitle: string | null;
  place: string | null;
  /** Empty means private to the author — not "shared with everyone". */
  familyIds: string[];
  taggedMemberIds: string[];
  media: PostMediaSummary[];
  commentCount: number;
  reactionCount: number;
  /**
   * **Per viewer**, not per post: this is *your* reaction, `null` when you
   * have not reacted. Two people reading the same post get different values
   * here, so it must never be cached under a key shared between accounts.
   */
  myReaction: ReactionType | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** `GET /api/families/:familyId/posts` — newest first, cursor-paginated. */
export type FamilyFeed = {
  items: PostDetail[];
  /** Echo back as `cursor` for the next page; `null` is the end. */
  nextCursor: string | null;
};

export type FeedQuery = {
  /** 1–50, default 20. */
  limit?: number;
  cursor?: string;
};

/**
 * `POST /api/posts`.
 *
 * `EVENT` requires `eventTitle` + `eventDate`; a plain `POST` forbids both
 * and requires `content` or media. Omitting `familyIds` makes the post
 * private to its author.
 */
export type CreatePostRequest = {
  type: PostType;
  content?: string;
  /** Strict ISO 8601. */
  eventDate?: string;
  eventTitle?: string;
  place?: string;
  familyIds?: string[];
  taggedMemberIds?: string[];
  /** Your own uploads, not already attached elsewhere. Creation only. */
  mediaIds?: string[];
};

/**
 * `PATCH /api/posts/:postId`.
 *
 * Attachments are fixed at creation: a `mediaIds` key here is silently
 * stripped by the server's whitelist pipe rather than rejected, so it is
 * left out of the type entirely.
 */
export type UpdatePostRequest = Omit<CreatePostRequest, 'mediaIds'>;

// --------------------------------------------------------------- media

/** `POST /api/media` — upload first, then attach the ids to a post. */
export type MediaSummary = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: IsoDateTime;
};

// ------------------------------------------------------ comments

/** `CommentService.CommentSummary`. */
export type CommentSummary = {
  id: string;
  postId: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/**
 * `GET /api/posts/:postId/comments` — **oldest first**, unlike the feed.
 * A thread reads top-down, so paging forward means reading further into the
 * conversation rather than further into the past.
 */
export type CommentList = {
  items: CommentSummary[];
  nextCursor: string | null;
};

/** Body of both create and edit — `content` 1–2000 characters. */
export type CommentBody = {
  content: string;
};

// ----------------------------------------------------- reactions

/**
 * What both reaction routes return, so the UI can reconcile an optimistic
 * update against the truth without a second request.
 */
export type ReactionState = {
  myReaction: ReactionType | null;
  reactionCount: number;
};

// ------------------------------------------------------ profiles

/**
 * `ProfileService.ProfileDetail` — one Life Profile.
 *
 * Which of `userId` / `memberId` is set says what kind it is: a **global**
 * profile belongs to an account and is the same object in every family that
 * person joined; a **placeholder** profile belongs to one family's member
 * row and is wiki-editable by that family (`domain-model.md`).
 */
export type ProfileDetail = {
  id: string;
  /** Set for a global profile, `null` for a placeholder. */
  userId: string | null;
  /** Set for a placeholder, `null` for a global profile. */
  memberId: string | null;
  displayName: string;
  bio: string | null;
  interests: string[];
  birthDate: IsoDateTime | null;
  deathDate: IsoDateTime | null;
  updatedAt: IsoDateTime;
};

/**
 * PATCH semantics, which are not the usual ones: omit a key to leave it
 * alone, send `null` to clear a date, send `''` to clear the bio, and send
 * the whole `interests` array because it replaces rather than merges.
 */
export type UpdateProfileRequest = {
  bio?: string;
  interests?: string[];
  birthDate?: string | null;
  deathDate?: string | null;
};

/** What the delete endpoints return. */
export type SuccessResult = {
  success: boolean;
};
