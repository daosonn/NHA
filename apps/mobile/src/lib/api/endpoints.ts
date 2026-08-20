/**
 * One function per endpoint that exists on the server today.
 *
 * These are the seam: a react-query hook calls one of these, and nothing
 * above this file knows about paths, verbs or the shape of an error body.
 * Each one is verified against `apps/api` — the shapes in `types.ts` mirror
 * the service interfaces, not the Prisma models.
 */
import { Platform } from 'react-native';

import { apiBaseUrl, apiRequest } from './client';
import type {
  CreateVideoJobRequest,
  EvidenceRef,
  EvidenceStats,
  GiftIdeasRequest,
  GiftIdeasResponse,
  MessageRequest,
  MessageResponse,
  MusicCatalog,
  SavedGiftIdea,
  StoryboardRequest,
  StoryboardResponse,
  UpcomingSpecialDates,
  VideoJob,
} from './ai-types';
import type {
  AddAlbumItemsRequest,
  AddMemberRequest,
  AlbumDetail,
  AlbumSummary,
  CreateAlbumRequest,
  AuthResult,
  CancelInvitationResult,
  CreateFamilyRequest,
  CreateInvitationRequest,
  CreateMemoRequest,
  CommentBody,
  ConfirmPasswordResetRequest,
  CommentList,
  CommentSummary,
  CreatePostRequest,
  CreateRelationshipRequest,
  FamilyDetail,
  FamilyFeed,
  FamilyMemberSummary,
  FamilySummary,
  FamilyTree,
  FeedQuery,
  GalleryMediaItem,
  InvitationPreview,
  InvitationSummary,
  JoinFamilyRequest,
  JoinFamilyResult,
  LoginRequest,
  CreateLifeEventRequest,
  LifeEventDetail,
  MediaSummary,
  MemoDetail,
  OAuthProvider,
  PostDetail,
  ProfileDetail,
  ReactionState,
  ReactionType,
  RefreshTokenRequest,
  RegisterRequest,
  RequestPasswordResetRequest,
  RelationshipSummary,
  SuccessResult,
  UpdateLifeEventRequest,
  UpdateMemoRequest,
  UpdatePostRequest,
  UpdateAlbumRequest,
  UpdateProfileRequest,
  VerifyResetCodeRequest,
  VerifyResetCodeResult,
} from './types';

/** Builds `?a=1&b=2`, skipping anything not set. */
function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);

  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

export const auth = {
  /** `POST /auth/register` — 409 when the email is already registered. */
  register: (body: RegisterRequest) =>
    apiRequest<AuthResult>('/auth/register', { method: 'POST', body, authenticated: false }),

  login: (body: LoginRequest) =>
    apiRequest<AuthResult>('/auth/login', { method: 'POST', body, authenticated: false }),

  /**
   * `POST /auth/refresh` — single-use rotation: the old refresh token is
   * revoked as the new pair is issued, so the response must be stored before
   * anything else is attempted.
   */
  refresh: (body: RefreshTokenRequest) =>
    apiRequest<AuthResult>('/auth/refresh', { method: 'POST', body, authenticated: false }),

  logout: (body: RefreshTokenRequest) =>
    apiRequest<SuccessResult>('/auth/logout', { method: 'POST', body }),

  /**
   * Step one of three. Unauthenticated — the whole point is that the person
   * cannot get in.
   */
  requestPasswordReset: (body: RequestPasswordResetRequest) =>
    apiRequest<SuccessResult>('/auth/password-reset/request', {
      method: 'POST',
      body,
      authenticated: false,
    }),

  /**
   * Step two. Checks the code **without consuming it**, so the person can be
   * told they mistyped before they have chosen a new password — and the code
   * still works on the screen after.
   */
  verifyResetCode: (body: VerifyResetCodeRequest) =>
    apiRequest<VerifyResetCodeResult>('/auth/password-reset/verify', {
      method: 'POST',
      body,
      authenticated: false,
    }),

  /**
   * Step three, which spends the code. Every existing session is revoked
   * server-side, so whoever did this has to sign in again — including on the
   * device they are holding.
   */
  confirmPasswordReset: (body: ConfirmPasswordResetRequest) =>
    apiRequest<SuccessResult>('/auth/password-reset/confirm', {
      method: 'POST',
      body,
      authenticated: false,
    }),

  /**
   * Social login is a browser redirect, not a fetch: the app opens this URL,
   * the provider redirects back to the server's callback, and the token pair
   * comes out of that. Returns the URL to open rather than doing it, because
   * how it is opened is a screen's decision.
   */
  oauthStartUrl: (provider: OAuthProvider, baseUrl: string) => `${baseUrl}/auth/oauth/${provider}`,
};

export const families = {
  list: () => apiRequest<FamilySummary[]>('/families'),

  detail: (familyId: string) => apiRequest<FamilyDetail>(`/families/${familyId}`),

  /** Nodes plus edges for the family-tree screen; the client owns the layout. */
  tree: (familyId: string) => apiRequest<FamilyTree>(`/families/${familyId}/tree`),

  /**
   * The family's shared posts, newest first. The viewer's own private posts
   * are **not** here — this is what was shared to this family, nothing more.
   */
  feed: (familyId: string, params: FeedQuery = {}) =>
    apiRequest<FamilyFeed>(`/families/${familyId}/posts${query(params)}`),

  create: (body: CreateFamilyRequest) =>
    apiRequest<FamilyDetail>('/families', { method: 'POST', body }),

  join: (body: JoinFamilyRequest) =>
    apiRequest<JoinFamilyResult>('/families/join', { method: 'POST', body }),

  addMember: (familyId: string, body: AddMemberRequest) =>
    apiRequest<FamilyMemberSummary>(`/families/${familyId}/members`, { method: 'POST', body }),

  updateMember: (familyId: string, memberId: string, body: Partial<AddMemberRequest>) =>
    apiRequest<FamilyMemberSummary>(`/families/${familyId}/members/${memberId}`, {
      method: 'PATCH',
      body,
    }),

  removeMember: (familyId: string, memberId: string) =>
    apiRequest<SuccessResult>(`/families/${familyId}/members/${memberId}`, { method: 'DELETE' }),

  addRelationship: (familyId: string, body: CreateRelationshipRequest) =>
    apiRequest<RelationshipSummary>(`/families/${familyId}/relationships`, {
      method: 'POST',
      body,
    }),

  removeRelationship: (familyId: string, relationshipId: string) =>
    apiRequest<SuccessResult>(`/families/${familyId}/relationships/${relationshipId}`, {
      method: 'DELETE',
    }),
};

/**
 * Inviting one person to one reserved spot.
 *
 * Distinct from `Family.inviteCode`, which is a standing door key for the
 * whole family: an invitation names who is coming and where they land, and
 * the server creates the placeholder plus its relationship edge as part of
 * `create` — so the tree shows the reserved spot the moment it is sent.
 */
export const invitations = {
  create: (familyId: string, body: CreateInvitationRequest) =>
    apiRequest<InvitationSummary>(`/families/${familyId}/invitations`, { method: 'POST', body }),

  /** Newest first. Includes accepted and cancelled ones, so filter by status. */
  list: (familyId: string) => apiRequest<InvitationSummary[]>(`/families/${familyId}/invitations`),

  /** Extends the expiry by a week. There is no email to re-send today. */
  resend: (familyId: string, invitationId: string) =>
    apiRequest<InvitationSummary>(`/families/${familyId}/invitations/${invitationId}/resend`, {
      method: 'POST',
    }),

  /** An untouched reserved spot is removed with it; a written-to one stays. */
  cancel: (familyId: string, invitationId: string) =>
    apiRequest<CancelInvitationResult>(`/families/${familyId}/invitations/${invitationId}`, {
      method: 'DELETE',
    }),

  /**
   * The one public route in the API — `@Public()` on the controller.
   *
   * Sent unauthenticated on purpose. With `authenticated: true` a signed-out
   * reader's missing token would turn a wrong code's 404 into a refresh
   * attempt first, and the invitation page exists precisely for people who
   * do not have an account yet.
   */
  preview: (code: string) =>
    apiRequest<InvitationPreview>(`/invitations/${encodeURIComponent(code)}`, {
      authenticated: false,
    }),

  /** Signed in only: joins the family on the spot the code reserved. */
  accept: (code: string) =>
    apiRequest<JoinFamilyResult>(`/invitations/${encodeURIComponent(code)}/accept`, {
      method: 'POST',
    }),
};

export const posts = {
  /**
   * Attachments are fixed here and cannot be changed later: upload to
   * `media.upload` first, then pass the ids as `mediaIds`.
   */
  create: (body: CreatePostRequest) => apiRequest<PostDetail>('/posts', { method: 'POST', body }),

  /** 404 also means "not yours to see" — the server never returns 403. */
  detail: (postId: string) => apiRequest<PostDetail>(`/posts/${postId}`),

  update: (postId: string, body: UpdatePostRequest) =>
    apiRequest<PostDetail>(`/posts/${postId}`, { method: 'PATCH', body }),

  remove: (postId: string) => apiRequest<SuccessResult>(`/posts/${postId}`, { method: 'DELETE' }),
};

export const media = {
  /**
   * One file per call, 100 MB ceiling for every type.
   *
   * The two platforms need different things in the `FormData`, and getting
   * it wrong fails quietly rather than loudly:
   *
   * - **Native** takes a `{ uri, name, type }` descriptor. React Native's
   *   `FormData` understands it and streams the file off disk itself.
   * - **Web** has no such thing. Appending that object stringifies it to
   *   `"[object Object]"`, so the server receives a text field called
   *   `file` and answers *"A file field is required"* — a 400 that looks
   *   like a validation bug rather than a platform mistake. The blob has to
   *   be fetched out of the `blob:`/`data:` URL the picker returned.
   *
   * The type is re-applied on web because a blob read back from an object
   * URL can arrive with an empty `type`, and the server rejects
   * `application/octet-stream` with a 415.
   */
  upload: async (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();

    if (Platform.OS === 'web') {
      const raw = await fetch(file.uri).then((response) => response.blob());
      const blob = raw.type === '' ? new Blob([raw], { type: file.type }) : raw;
      form.append('file', blob, file.name);
    } else {
      // The cast is unavoidable: RN's FormData accepts a file descriptor the
      // DOM lib has no type for.
      form.append('file', file as unknown as Blob);
    }

    return apiRequest<MediaSummary>('/media', { method: 'POST', body: form });
  },

  /**
   * Where the bytes are. Not a fetch: hand this to `expo-image` or the
   * video player together with the bearer header, since the download is
   * authenticated and supports Range requests.
   */
  streamUrl: (mediaId: string) => `${apiBaseUrl()}/media/${mediaId}`,
};

export const comments = {
  /** Oldest first — see `CommentList`. Same `limit`/`cursor` as the feed. */
  list: (postId: string, params: FeedQuery = {}) =>
    apiRequest<CommentList>(`/posts/${postId}/comments${query(params)}`),

  /** Anyone who can read the post can comment on it. */
  create: (postId: string, body: CommentBody) =>
    apiRequest<CommentSummary>(`/posts/${postId}/comments`, { method: 'POST', body }),

  /** Author only — the post's author has no moderation power yet. */
  update: (postId: string, commentId: string, body: CommentBody) =>
    apiRequest<CommentSummary>(`/posts/${postId}/comments/${commentId}`, {
      method: 'PATCH',
      body,
    }),

  remove: (postId: string, commentId: string) =>
    apiRequest<SuccessResult>(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
};

export const reactions = {
  /**
   * One reaction per person per post, so this is a `PUT` on `/me` rather
   * than a `POST` to a collection: setting LOVE after LIKE replaces it, it
   * does not add a second.
   */
  set: (postId: string, type: ReactionType) =>
    apiRequest<ReactionState>(`/posts/${postId}/reactions/me`, { method: 'PUT', body: { type } }),

  /** Idempotent — removing a reaction you never left is not an error. */
  clear: (postId: string) =>
    apiRequest<ReactionState>(`/posts/${postId}/reactions/me`, { method: 'DELETE' }),
};

export const specialDates = {
  /** Hub "Coming up" + occasion pickers — soonest first, derived from profiles + custom rows. */
  upcoming: (familyId: string, limit?: number) =>
    apiRequest<UpcomingSpecialDates>(`/families/${familyId}/special-dates${query({ limit })}`),
};

export const ai = {
  /** Screen 21 — "12 photos and 4 notes about her" before asking (0 tokens). */
  evidenceStats: (familyId: string, memberId: string) =>
    apiRequest<EvidenceStats>(`/families/${familyId}/members/${memberId}/evidence-stats`),

  /** Screen 23 — follow the sources an idea cited back to the real note or post. */
  evidence: (familyId: string, memberId: string, refs: string[]) =>
    apiRequest<EvidenceRef[]>(
      `/families/${familyId}/members/${memberId}/evidence${query({ refs: refs.join(',') })}`,
    ),

  /** Screen 21→22 — grounded gift ideas with provenance; response includes saved ideas. */
  giftIdeas: (familyId: string, memberId: string, body: GiftIdeasRequest) =>
    apiRequest<GiftIdeasResponse>(`/families/${familyId}/members/${memberId}/gift-ideas`, {
      method: 'POST',
      body,
    }),

  /** Screen 22 — Save one idea. Also recorded as direct human feedback for the profile. */
  saveGiftIdea: (
    familyId: string,
    memberId: string,
    body: { title: string; why?: string; priceRange?: string; occasionLabel?: string },
  ) =>
    apiRequest<SavedGiftIdea>(`/families/${familyId}/members/${memberId}/gift-ideas/save`, {
      method: 'POST',
      body,
    }),

  /** Screen 21 — "Two ideas you saved last year". */
  savedGiftIdeas: (familyId: string, memberId: string) =>
    apiRequest<SavedGiftIdea[]>(`/families/${familyId}/members/${memberId}/gift-ideas/saved`),

  /** Screens 24-25 — three variants; call again with a different tone to "say it differently". */
  messageSuggestions: (familyId: string, memberId: string, body: MessageRequest) =>
    apiRequest<MessageResponse>(`/families/${familyId}/members/${memberId}/message-suggestions`, {
      method: 'POST',
      body,
    }),

  /** Screen 26 — render the card PNG server-side; view it via `media.streamUrl(media_id)`. */
  renderCard: (
    familyId: string,
    body: { template: string; message: string; toName: string; fromName: string; heading?: string },
  ) => apiRequest<{ media_id: string }>(`/families/${familyId}/cards`, { method: 'POST', body }),
};

export const video = {
  /** Screen 29 — built-in music grouped by mood. */
  music: () => apiRequest<MusicCatalog>('/video-music'),

  /** Screen 29 — preview URL of a LIBRARY track (public, so a plain <audio> can play it). */
  musicFileUrl: (trackId: string) => `${apiBaseUrl()}/video-music/${trackId}/file`,

  /** Screen 27→31 — storyboard to review before the job exists (1 AI call, mockable). */
  storyboard: (familyId: string, body: StoryboardRequest) =>
    apiRequest<StoryboardResponse>(`/families/${familyId}/video-jobs/storyboard`, {
      method: 'POST',
      body,
    }),

  create: (familyId: string, body: CreateVideoJobRequest) =>
    apiRequest<VideoJob>(`/families/${familyId}/video-jobs`, { method: 'POST', body }),

  render: (jobId: string) =>
    apiRequest<{ ok: boolean }>(`/video-jobs/${jobId}/render`, { method: 'POST' }),

  /** Poll from screen 32 — progress + stage. */
  job: (jobId: string) => apiRequest<VideoJob>(`/video-jobs/${jobId}`),

  /** Screen 33 — "Your videos". */
  list: () => apiRequest<VideoJob[]>('/video-jobs'),

  share: (jobId: string, body: { caption?: string } = {}) =>
    apiRequest<{ post_id: string }>(`/video-jobs/${jobId}/share`, { method: 'POST', body }),

  /** Authenticated + Range-capable — hand to the video player with the bearer header. */
  fileUrl: (jobId: string) => `${apiBaseUrl()}/video-jobs/${jobId}/file`,
};

export const profiles = {
  mine: () => apiRequest<ProfileDetail>('/me/profile'),

  updateMine: (body: UpdateProfileRequest) =>
    apiRequest<ProfileDetail>('/me/profile', { method: 'PATCH', body }),

  /**
   * A **linked** member's route serves their global profile — the very
   * object `mine()` edits — while a placeholder serves that family's wiki
   * profile. The route is the same; what comes back is not.
   */
  member: (familyId: string, memberId: string) =>
    apiRequest<ProfileDetail>(`/families/${familyId}/members/${memberId}/profile`),

  /**
   * Placeholders are editable by any member of the family; a linked
   * member's profile only by that member, 403 otherwise.
   */
  updateMember: (familyId: string, memberId: string, body: UpdateProfileRequest) =>
    apiRequest<ProfileDetail>(`/families/${familyId}/members/${memberId}/profile`, {
      method: 'PATCH',
      body,
    }),
};

/**
 * Private notes about a family member.
 *
 * Two shapes of route, because a memo belongs to its author but is *about*
 * somebody: the member-scoped pair lists and creates within a family, and the
 * flat `/memos/:id` routes work on one note wherever it came from — including
 * one whose member has since left, which the member route can no longer reach.
 */
export const memos = {
  /** Every note the caller wrote about this member. Newest touched first. */
  forMember: (familyId: string, memberId: string) =>
    apiRequest<MemoDetail[]>(`/families/${familyId}/members/${memberId}/memos`),

  create: (familyId: string, memberId: string, body: CreateMemoRequest) =>
    apiRequest<MemoDetail>(`/families/${familyId}/members/${memberId}/memos`, {
      method: 'POST',
      body,
    }),

  /** Everything the caller ever wrote, orphaned notes included. */
  mine: () => apiRequest<MemoDetail[]>('/me/memos'),

  detail: (memoId: string) => apiRequest<MemoDetail>(`/memos/${memoId}`),

  update: (memoId: string, body: UpdateMemoRequest) =>
    apiRequest<MemoDetail>(`/memos/${memoId}`, { method: 'PATCH', body }),

  remove: (memoId: string) => apiRequest<SuccessResult>(`/memos/${memoId}`, { method: 'DELETE' }),
};

/**
 * Personal albums — a shelf only their owner ever sees (WBS 1.6.7).
 *
 * Deleting an album removes the *organisation* and nothing else: the
 * photographs stay where they were, in the posts and moments they came from.
 * That is the server's rule, and it is the reason the delete dialog here can
 * be gentler than the one on a memo.
 */
export const albums = {
  /** Most recently touched first. */
  list: () => apiRequest<AlbumSummary[]>('/me/albums'),

  create: (body: CreateAlbumRequest) =>
    apiRequest<AlbumDetail>('/me/albums', { method: 'POST', body }),

  detail: (albumId: string) => apiRequest<AlbumDetail>(`/me/albums/${albumId}`),

  /** Rename, redescribe, or set the cover. The cover must already be inside. */
  update: (albumId: string, body: UpdateAlbumRequest) =>
    apiRequest<AlbumDetail>(`/me/albums/${albumId}`, { method: 'PATCH', body }),

  remove: (albumId: string) =>
    apiRequest<SuccessResult>(`/me/albums/${albumId}`, { method: 'DELETE' }),

  /** Your own uploads only — 400 otherwise. Returns the album, freshly counted. */
  addItems: (albumId: string, body: AddAlbumItemsRequest) =>
    apiRequest<AlbumDetail>(`/me/albums/${albumId}/items`, { method: 'POST', body }),

  /** Takes the photograph out of the album. The file itself is untouched. */
  removeItem: (albumId: string, mediaId: string) =>
    apiRequest<SuccessResult>(`/me/albums/${albumId}/items/${mediaId}`, { method: 'DELETE' }),
};

/**
 * The Album tab: every photograph that belongs to one person.
 *
 * Replaced a client-side scan of the family feed (2026-08-19). That scan
 * could only read a bounded slice, could not see life-event media at all,
 * and re-derived a visibility rule that is the server's to decide. This
 * route does all three properly and answers in one request.
 */
export const gallery = {
  /** Works with no family at all — a person's gallery is global. */
  mine: () => apiRequest<GalleryMediaItem[]>('/me/gallery'),

  forMember: (familyId: string, memberId: string) =>
    apiRequest<GalleryMediaItem[]>(`/families/${familyId}/members/${memberId}/gallery`),
};

/**
 * Milestones on a Life Profile — the Timeline tab.
 *
 * Two route families for the same rows, mirroring the profile they hang off:
 * `/me` works with no family at all, and the member-scoped pair reads
 * somebody through the family you are viewing them from. Lists come back
 * oldest first, because a life reads forward.
 */
export const lifeEvents = {
  mine: () => apiRequest<LifeEventDetail[]>('/me/life-events'),

  createMine: (body: CreateLifeEventRequest) =>
    apiRequest<LifeEventDetail>('/me/life-events', { method: 'POST', body }),

  updateMine: (eventId: string, body: UpdateLifeEventRequest) =>
    apiRequest<LifeEventDetail>(`/me/life-events/${eventId}`, { method: 'PATCH', body }),

  removeMine: (eventId: string) =>
    apiRequest<SuccessResult>(`/me/life-events/${eventId}`, { method: 'DELETE' }),

  forMember: (familyId: string, memberId: string) =>
    apiRequest<LifeEventDetail[]>(`/families/${familyId}/members/${memberId}/life-events`),

  createForMember: (familyId: string, memberId: string, body: CreateLifeEventRequest) =>
    apiRequest<LifeEventDetail>(`/families/${familyId}/members/${memberId}/life-events`, {
      method: 'POST',
      body,
    }),

  updateForMember: (
    familyId: string,
    memberId: string,
    eventId: string,
    body: UpdateLifeEventRequest,
  ) =>
    apiRequest<LifeEventDetail>(
      `/families/${familyId}/members/${memberId}/life-events/${eventId}`,
      { method: 'PATCH', body },
    ),

  removeForMember: (familyId: string, memberId: string, eventId: string) =>
    apiRequest<SuccessResult>(`/families/${familyId}/members/${memberId}/life-events/${eventId}`, {
      method: 'DELETE',
    }),
};
