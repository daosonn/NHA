/**
 * One function per endpoint that exists on the server today.
 *
 * These are the seam: a react-query hook calls one of these, and nothing
 * above this file knows about paths, verbs or the shape of an error body.
 * Nothing is called yet — the screens still read fixtures — so this file is
 * the contract, verified against `apps/api`, waiting to be wired.
 */
import { apiBaseUrl, apiRequest } from './client';
import type {
  AddMemberRequest,
  AuthResult,
  CreateFamilyRequest,
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
  RefreshTokenRequest,
  RegisterRequest,
  RelationshipSummary,
  SuccessResult,
  UpdatePostRequest,
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
   * `uri` is what the image picker hands back. React Native's `FormData`
   * takes this `{ uri, name, type }` shape rather than a `Blob`, and reads
   * the file itself while the request streams.
   */
  upload: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    // The cast is unavoidable: RN's FormData accepts a file descriptor the
    // DOM lib has no type for.
    form.append('file', file as unknown as Blob);

    return apiRequest<MediaSummary>('/media', { method: 'POST', body: form });
  },

  /**
   * Where the bytes are. Not a fetch: hand this to `expo-image` or the
   * video player together with the bearer header, since the download is
   * authenticated and supports Range requests.
   */
  streamUrl: (mediaId: string) => `${apiBaseUrl()}/media/${mediaId}`,
};
