/**
 * One function per endpoint that exists on the server today.
 *
 * These are the seam: a react-query hook calls one of these, and nothing
 * above this file knows about paths, verbs or the shape of an error body.
 * Nothing is called yet — the screens still read fixtures — so this file is
 * the contract, verified against `apps/api`, waiting to be wired.
 */
import { apiRequest } from './client';
import type {
  AddMemberRequest,
  AuthResult,
  CreateFamilyRequest,
  CreateRelationshipRequest,
  FamilyDetail,
  FamilyMemberSummary,
  FamilySummary,
  JoinFamilyRequest,
  JoinFamilyResult,
  LoginRequest,
  OAuthProvider,
  RefreshTokenRequest,
  RegisterRequest,
  RelationshipSummary,
  SuccessResult,
} from './types';

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
