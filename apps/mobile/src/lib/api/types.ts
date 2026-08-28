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

/**
 * `POST /api/auth/password-reset/request`.
 *
 * Always answers `{ success: true }`, whether or not the address is
 * registered. That is deliberate on the server's part — a different answer
 * for a real address turns the endpoint into a way to test whether somebody
 * has an account — so the screen must not read anything into it either.
 */
export type RequestPasswordResetRequest = {
  email: string;
};

/** `POST /api/auth/password-reset/verify` — checks without consuming. */
export type VerifyResetCodeRequest = {
  email: string;
  /** Exactly six digits. */
  code: string;
};

/** `POST /api/auth/password-reset/verify` — `valid`, not `success`. */
export type VerifyResetCodeResult = {
  valid: boolean;
};

/** `POST /api/auth/password-reset/confirm` — password 8–72. Revokes every session. */
export type ConfirmPasswordResetRequest = {
  email: string;
  code: string;
  newPassword: string;
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
  /**
   * A `Media` id despite the column name — stream it with `GET /media/:id`.
   *
   * A linked member falls back to their account's avatar, so one person looks
   * the same in every family (`family.service.ts`); the member's own value
   * only matters for a placeholder, whose picture the family sets.
   */
  avatarKey: string | null;
  joinedAt: IsoDateTime;
};

/** `GET /api/families` — one entry per family the caller belongs to. */
export type FamilySummary = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: IsoDateTime;
  /** Ai lập ra nhà — chỉ người đó thấy nút xóa gia đình. */
  createdById: string;
  memberCount: number;
  /** Ảnh đại diện gia đình (id Media) — hiện trong dải chuyển gia đình */
  coverMediaId: string | null;
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
/** A tree node: member plus tree-only fields the layout needs. */
export type TreeMemberSummary = FamilyMemberSummary & {
  /**
   * ISO date (YYYY-MM-DD) from their Life Profile, null when unknown —
   * siblings draw oldest-to-youngest, left to right (2026-08-27).
   */
  birthDate: string | null;
};

export type FamilyTree = {
  id: string;
  name: string;
  /** Ảnh cả nhà — id Media, xem qua `mediaSource()` như mọi ảnh khác */
  coverMediaId: string | null;
  members: TreeMemberSummary[];
  relationships: RelationshipSummary[];
};

// --------------------------------------------------------- invitations

/**
 * `EXPIRED` is not a stored value: the server derives it from `expiresAt`
 * when it reads the row (`invitation.service.ts`). So a client must never
 * write it back, and must not assume a `PENDING` it cached an hour ago is
 * still pending.
 */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';

/**
 * `POST /api/families/:familyId/invitations` and the list under it.
 *
 * Note `code` — this is the invitation's **own** code, not
 * `Family.inviteCode`. That difference is the whole point of the endpoint: a
 * family code lets somebody in the door, while this one carries the spot
 * that was reserved for them, so they land in the tree where the inviter put
 * them instead of arriving unattached.
 */
export type InvitationSummary = {
  id: string;
  familyId: string;
  /** The reserved spot — a placeholder `FamilyMember` created with the invite. */
  memberId: string;
  code: string;
  name: string;
  relationshipType: RelationshipType;
  /** Display-only picker key ("sister"); never a `RelationshipType`. */
  kinshipKey: string | null;
  status: InvitationStatus;
  inviterName: string;
  /** Null when the code is meant to be handed over rather than delivered. */
  inviteeUserId: string | null;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
};

/**
 * `GET /api/invitations/:code` — the only route in the API that answers
 * without a token, so the person being invited can read the page before they
 * have an account.
 */
export type InvitationPreview = {
  code: string;
  familyName: string;
  inviterName: string;
  /** What the inviter calls the invitee. */
  name: string;
  relationshipType: RelationshipType;
  kinshipKey: string | null;
  memberCount: number;
  /** Posts shared to this family. */
  momentCount: number;
  /** First names around the reserved spot, so the page can be specific. */
  parents: { name: string }[];
  siblings: { name: string }[];
  expiresAt: IsoDateTime;
};

/**
 * `POST /api/families/:familyId/invitations`.
 *
 * Omit `memberId` and the server creates the placeholder and its edge in the
 * same transaction — which is why the app no longer adds a member first and
 * invites second. `newMemberIsFrom` is ignored when `memberId` is given,
 * because that spot already sits somewhere in the tree.
 */
export type CreateInvitationRequest = {
  name: string;
  /**
   * Address the invitation to an existing account instead of handing over a
   * code. The server 404s an address nobody has registered — delivery is an
   * in-app notification, so there is nowhere else for it to arrive — and 409s
   * someone already in the family.
   */
  email?: string;
  memberId?: string;
  relationshipType: RelationshipType;
  kinshipKey?: string;
  /** `PARENT` points parent→child, so "Mother" is `true`, "Daughter" `false`. */
  newMemberIsFrom?: boolean;
  /** Free label for the edge, only when `relationshipType` is `OTHER`. */
  relationshipLabel?: string;
};

/** `DELETE /api/families/:familyId/invitations/:invitationId`. */
export type CancelInvitationResult = {
  success: boolean;
  /** False when the spot had already been written to and was kept. */
  memberRemoved: boolean;
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
  /**
   * `false` = row có nhưng FILE không nằm trên máy chủ đang phục vụ (DB Neon
   * dùng chung, file ở máy người khác) — không chọn vào video, không vẽ ảnh
   * vỡ. Tuỳ chọn vì chỉ route bài đăng tính cờ này; nơi khác coi như có.
   */
  available?: boolean;
};

/** `PostService.PostDetail`. `authorAvatarKey` = ảnh của người đăng (id Media). */
export type PostDetail = {
  id: string;
  authorUserId: string;
  authorName: string;
  authorAvatarKey: string | null;
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
  /** Server đã trả sẵn từ đầu (= isAuthor) — client chỉ việc tin, đừng tự suy từ userId. */
  canEdit: boolean;
  canDelete: boolean;
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
 * Mọi khóa đều tùy chọn (server là `PartialType`): thiếu khóa = giữ nguyên.
 * `type` và `mediaIds` không đổi được sau khi đăng — server omit cả hai
 * (`UpdatePostDto`), nên type này cũng vậy. Lưu ý hai MẢNG là thay cả tập.
 */
export type UpdatePostRequest = Partial<Omit<CreatePostRequest, 'mediaIds' | 'type'>>;

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
  authorAvatarKey: string | null;
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
  /** Free text — mockup 7 prints it after the birth date. */
  birthPlace: string | null;
  /** Free text ("Carpenter, retired since 2021"), not a job title. */
  occupation: string | null;
  deathDate: IsoDateTime | null;
  /**
   * A `Media` id, streamed through `GET /media/:id` — not a URL and not the
   * opaque storage key the column name suggests (WBS 3.4.2).
   *
   * Stored on `User`/`FamilyMember` rather than on the profile, and surfaced
   * here because the profile is where it is edited. `null` means no
   * photograph, and the app draws initials.
   */
  avatarMediaId: string | null;
  /**
   * Whether this account can sign in with a password. `false` means a
   * social-only account (signed up with Google/Facebook): Settings offers
   * "set a password" — the emailed-code reset flow — instead of the
   * change-password form, which requires a current password that does not
   * exist. Only your own route (`GET /me/profile`) carries a value; read
   * through a family it is always `null` — how somebody else signs in is
   * not the family's business.
   */
  hasPassword: boolean | null;
  updatedAt: IsoDateTime;
};

/**
 * PATCH semantics, which are not the usual ones: omit a key to leave it
 * alone, send `null` to clear a date, send `''` to clear the bio, and send
 * the whole `interests` array because it replaces rather than merges.
 */
export type UpdateProfileRequest = {
  /**
   * Đổi tên hiển thị: hồ sơ của mình → `User.name`; placeholder →
   * `FamilyMember.displayName`. Không xóa trắng được — server 400.
   */
  name?: string;
  /**
   * A `Media` id **this account uploaded** via `POST /media`; `null` clears
   * it. The server refuses somebody else's upload.
   */
  avatarMediaId?: string | null;
  /** Free text; `''` clears it. */
  birthPlace?: string;
  /** Free text; `''` clears it. */
  occupation?: string;
  bio?: string;
  interests?: string[];
  birthDate?: string | null;
  deathDate?: string | null;
};

// ---------------------------------------------------------- life events

/**
 * `LifeEventService.LifeEventDetail` — a milestone on the Timeline tab.
 *
 * Hangs off the LifeProfile, so it follows the person: a linked member's
 * timeline is the same in every family, a placeholder's is family-local.
 */
export type LifeEventDetail = {
  id: string;
  profileId: string;
  title: string;
  description: string | null;
  /**
   * A DATE column — but it arrives as a full ISO timestamp all the same
   * (`1968-04-12T00:00:00.000Z`), like every other date on this wire.
   * `src/lib/date.ts` cuts it down; do not parse it by hand.
   */
  eventDate: IsoDateTime;
  place: string | null;
  /** Free text; the taxonomy is still TBD (screen 9 filters). */
  type: string | null;
  taggedMemberIds: string[];
  media: PostMediaSummary[];
  createdById: string;
  updatedById: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** Title and `eventDate` are required; media is fixed at creation. */
export type CreateLifeEventRequest = {
  title: string;
  description?: string;
  eventDate: string;
  place?: string;
  type?: string;
  taggedMemberIds?: string[];
  mediaIds?: string[];
  /**
   * Also announce the milestone in the feed as an EVENT post. Defaults to
   * true server-side. The post carries the title, date, place and
   * description but **not** the photos — a Media row may have only one
   * parent, and the timeline is where they were put.
   */
  shareToFeed?: boolean;
};

/**
 * Omit a key to leave it alone. Title and `eventDate` cannot be cleared —
 * sending `null` for either is a 400. Media cannot change.
 */
export type UpdateLifeEventRequest = {
  title?: string;
  description?: string | null;
  eventDate?: string;
  place?: string | null;
  type?: string | null;
  taggedMemberIds?: string[];
};

// -------------------------------------------------------- notifications

/** `apps/api/src/generated/prisma/enums.ts` → `NotificationType`. */
export type NotificationType =
  | 'NEW_POST'
  | 'COMMENT'
  | 'REACTION'
  | 'MEMBER_TAG'
  | 'FAMILY_INVITE'
  | 'BIRTHDAY_REMINDER'
  | 'EVENT_REMINDER'
  | 'CARE_REMINDER'
  | 'AI_SUGGESTION';

/**
 * What a notification carries, by type. `payload` is `unknown` on the wire —
 * the server stores it as JSON — so the client narrows it rather than
 * trusting a cast.
 *
 * Two shapes exist today: the ones about a post (`postId` + who did it) and
 * the reminders (`kind`, the family, and either a member or a stored
 * occasion). Anything else is drawn without a destination rather than
 * guessing one.
 */
export type NotificationPayload = {
  postId?: string;
  actorUserId?: string;
  kind?: string;
  familyId?: string;
  memberId?: string;
  specialDateId?: string;
  displayName?: string;
  title?: string;
  occursOn?: string;
  daysUntil?: number;
  /** kind 'video_done' — server ghi snake_case `video_job_id` */
  videoJobId?: string;
  /** kind 'family_invite' — mã lời mời, mở thẳng /invite/[code] */
  code?: string;
};

/** `GET /api/me/notifications` (WBS 3.1.2). */
export type NotificationDetail = {
  id: string;
  type: NotificationType;
  payload: unknown;
  /** `null` is unread — that is what drives the badge. */
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
};

export type NotificationPage = {
  items: NotificationDetail[];
  nextCursor: string | null;
  /** Unread across everything, not just this page. */
  unreadCount: number;
};

/** `GET /api/me/notifications/unread-count` — the badge on its own. */
export type UnreadCount = {
  count: number;
};

/** `POST /api/me/notifications/read-all`. */
export type MarkAllReadResult = {
  updated: number;
};

export type NotificationQuery = {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
};

// --------------------------------------------------------------- albums

/**
 * A personal album — `GET /api/me/albums` (WBS 1.6.7).
 *
 * **Always private.** Never shown on a Life Profile and never shared with a
 * family; this is one person's own shelf. Not to be confused with the Album
 * *tab* on a profile, which is derived from posts and life events and which
 * nobody curates.
 */
export type AlbumSummary = {
  id: string;
  name: string;
  description: string | null;
  /** Must be one of the album's own items. Null until one is chosen. */
  coverMediaId: string | null;
  itemCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AlbumItemDetail = {
  mediaId: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: IsoDateTime;
};

export type AlbumDetail = AlbumSummary & {
  items: AlbumItemDetail[];
};

/** `POST /api/me/albums` — name ≤ 100, description ≤ 2000. */
export type CreateAlbumRequest = {
  name: string;
  description?: string;
};

/** `PATCH /api/me/albums/:albumId`. `null` on the cover clears it. */
export type UpdateAlbumRequest = {
  name?: string;
  description?: string;
  coverMediaId?: string | null;
};

/**
 * `POST /api/me/albums/:albumId/items` — 1 to 50 ids, no duplicates.
 *
 * Every id must be something **this account uploaded**; the server answers
 * 400 for anything else. That is why the app adds photos by picking and
 * uploading them rather than by offering the family's shared pictures.
 */
export type AddAlbumItemsRequest = {
  mediaIds: string[];
};

// -------------------------------------------------------------- gallery

/**
 * One file on a Life Profile's Album tab — `GET /api/me/gallery` and
 * `GET /api/families/:familyId/members/:memberId/gallery` (WBS 1.6.4).
 *
 * **Derived, not stored**: the media of posts this person authored or was
 * tagged in, plus their life-event media, filtered server-side to what the
 * viewer may actually see. Not the `Album` model, which is a private
 * user-curated collection with its own table.
 *
 * Exactly one of `postId` / `lifeEventId` is set, which is what lets the
 * client group loose files back into the moment they came from.
 *
 * Not paginated — one person's history, returned whole.
 */
export type GalleryMediaItem = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: IsoDateTime;
  postId: string | null;
  lifeEventId: string | null;
};

// ---------------------------------------------------------------- memos

/**
 * `MemoService.MemoDetail` — a private note *about* a family member.
 *
 * Always author-only (`docs/00-shared/domain-model.md`): nobody else ever
 * sees one, and anything that is not yours 404s rather than 403s, because a
 * memo's existence is itself private.
 */
export type MemoDetail = {
  id: string;
  /**
   * Who the note is about — `null` once that member left or was removed. A
   * memo outlives the node it hangs off (decided 2026-08-19), so other
   * people's notes are not destroyed by someone else leaving.
   */
  aboutMemberId: string | null;
  /** Name snapshot from write time, so an orphaned note stays readable. */
  aboutName: string;
  title: string;
  content: string | null;
  /** The client's own vocabulary, stored as free text — the server never validates it. */
  category: string | null;
  media: PostMediaSummary[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** `POST /api/families/:familyId/members/:memberId/memos`. */
export type CreateMemoRequest = {
  title: string;
  content?: string;
  category?: string;
  /** Your own uploads, not attached elsewhere. Fixed after creation. */
  mediaIds?: string[];
};

/**
 * `PATCH /api/memos/:memoId`. Omit a key to leave it alone; `null` clears
 * content or category. Media cannot change — same rule as posts.
 */
export type UpdateMemoRequest = {
  title?: string;
  content?: string | null;
  category?: string | null;
};

/** What the delete endpoints return. */
export type SuccessResult = {
  success: boolean;
};

/**
 * `POST /auth/change-password` (WBS 3.4.3).
 *
 * The current password is required even though the request is authenticated:
 * an unlocked phone should not be enough to lock its owner out.
 */
export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

/**
 * `GET/PATCH /me/settings/notifications` (WBS 3.4.5).
 *
 * Grouped by *why* a notification arrived rather than one switch per type,
 * because that is the question somebody muting them is actually answering.
 * All default `true`, and the server applies the defaults on read, so a
 * missing key never reaches here.
 *
 * Muting means the row is **never created** — it does not appear in the
 * list, the badge never counts it, and turning the group back on does not
 * resurrect what was missed.
 */
export type NotificationSettings = {
  /** `NEW_POST` — a moment shared to one of my families. */
  newPosts: boolean;
  /** `COMMENT` / `REACTION` / `MEMBER_TAG` — things aimed at me. */
  aboutMe: boolean;
  /** `BIRTHDAY_REMINDER` / `EVENT_REMINDER` — the "bật/tắt nhắc" of 3.4.5. */
  reminders: boolean;
};

/** Partial merge: omitted flags keep their stored value. */
export type UpdateNotificationSettingsRequest = Partial<NotificationSettings>;
