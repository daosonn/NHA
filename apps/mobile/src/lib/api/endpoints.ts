/**
 * One function per endpoint that exists on the server today.
 *
 * These are the seam: a react-query hook calls one of these, and nothing
 * above this file knows about paths, verbs or the shape of an error body.
 * Nothing is called yet — the screens still read fixtures — so this file is
 * the contract, verified against `apps/api`, waiting to be wired.
 */
import { Platform } from 'react-native';

import { apiBaseUrl, apiRequest } from './client';
import type {
  AddMemberRequest,
  AuthResult,
  CreateFamilyRequest,
  CommentBody,
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
  JoinFamilyRequest,
  JoinFamilyResult,
  LoginRequest,
  MediaSummary,
  OAuthProvider,
  PostDetail,
  ProfileDetail,
  ReactionState,
  ReactionType,
  RefreshTokenRequest,
  RegisterRequest,
  RelationshipSummary,
  SuccessResult,
  UpdatePostRequest,
  UpdateProfileRequest,
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
