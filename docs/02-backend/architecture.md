# Backend Architecture

> Scope: decisions needed before Sprint 1. Grows as the backend grows —
> keep this the place where backend-wide decisions are recorded.

## Stack

NestJS (modular monolith — `CLAUDE.md` § 3) + Prisma + PostgreSQL.
Flow per feature: Controller → Service → Prisma (no repository layer unless
a concrete need appears — `CLAUDE.md` § 5).

## Authentication (decided 2026-08-13)

**JWT access + refresh tokens.**

- **Access token**: short-lived (~15 min), signed JWT, sent as
  `Authorization: Bearer` header. Contains `sub` (userId) and minimal claims.
- **Refresh token**: long-lived (~30 days), random opaque string; only its
  **hash** is stored in the `RefreshToken` table (see `database.md`).
  Rotation on every refresh; revoked on logout. This keeps logout/compromise
  handling possible despite stateless access tokens.
- **Password hashing**: argon2 (or bcrypt if argon2 causes install friction
  on Windows machines — decide at implementation, either is acceptable).
- NestJS implementation: `AuthModule` with guards (`JwtAuthGuard` global by
  default, `@Public()` decorator for open routes like login/register).
- **Social login (customer requirement 2026-08-17; scheduled into Sprint 1
  as tasks 1.1.8–1.1.9)**: phase 1 is **Google + Facebook** — authorization
  code flow handled entirely by NestJS (provider secrets stay server-side;
  CSRF `state` bound to an httpOnly cookie). **LINE is deferred**, not
  dropped: it needs an email-permission application in LINE Developers
  Console, and it is the highest-value login in Japan — re-confirm with the
  customer. X is a phase-2 candidate; Instagram is not viable (Basic
  Display API shut down). Policies (decided 2026-08-17):
  - **No auto-linking**: if the provider email already belongs to a `User`,
    reject with 409 — the user must log in with email/password (a manual
    "link account" flow in Settings can come later).
  - **Email required**: if the provider returns no email (e.g. phone-only
    Facebook accounts) or an unverified one, reject the login.
  - Social-only accounts store an empty `passwordHash` (password login
    already treats a malformed hash as a wrong password).
  - Schema: `OAuthAccount` table (`provider` + `providerAccountId` unique);
    `User` untouched.
  - The OAuth callback returns the standard `AuthResult` JSON for now;
    switch to a frontend redirect handoff when the auth UI (1.1.1/1.1.4)
    lands.

## Authorization

- Enforced in NestJS only — never trust frontend state (`CLAUDE.md` § 3).
- MVP model: membership-based — a user can access a family's data iff they
  have a `FamilyMember` row in it. No roles beyond that (single "User" role,
  wiki-style placeholder editing — `domain-model.md`).

## API Conventions

- REST, JSON. Global prefix `/api`, set in `main.ts`.
- Validation: DTO classes + `class-validator` at every boundary; whitelist
  unknown properties away (`ValidationPipe({ whitelist: true })`).
- Never return Prisma models directly — map to response DTOs.
- Error shape: use NestJS built-in `HttpException` JSON format for MVP
  (`statusCode`, `message`, `error`). Revisit if clients need error codes.
- Media: uploads go through a **storage service module** (local disk for the
  MVP demo, S3-compatible later — see `database.md` → Media).

## CORS

Off unless something asks for it. The product client is the native Expo
app, which sends no `Origin`, so CORS exists only for the browser dev tier
(`pnpm dev:mobile:web`).

`main.ts` reads `CORS_ORIGINS` (comma-separated). With it unset the
allowlist is `http://localhost:8081` and `:19006` in development and
**empty in production** — a deployed API nothing in a browser is meant to
call should not hand out `Access-Control-Allow-Origin` on the strength of a
default. Credentials stay off: bearer tokens travel in a header, never a
cookie.

## Open

- Rate limiting / brute-force protection on login (nice-to-have for MVP).
- Error-code catalog (only if FE needs machine-readable codes).
- `apps/ai` (FastAPI) integration contract — designed in Sprint 2 (see
  `docs/03-ai/`).
