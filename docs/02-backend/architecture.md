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
- **MVP is email/password only.** Google OAuth is in the product scope but
  not scheduled in Sprints 1–3; the schema accommodates it later via a
  separate `OAuthAccount` table without touching `User`.

## Authorization

- Enforced in NestJS only — never trust frontend state (`CLAUDE.md` § 3).
- MVP model: membership-based — a user can access a family's data iff they
  have a `FamilyMember` row in it. No roles beyond that (single "User" role,
  wiki-style placeholder editing — `domain-model.md`).

## API Conventions

- REST, JSON. Global prefix `/api` (set in `main.ts` when Sprint 1 starts).
- Validation: DTO classes + `class-validator` at every boundary; whitelist
  unknown properties away (`ValidationPipe({ whitelist: true })`).
- Never return Prisma models directly — map to response DTOs.
- Error shape: use NestJS built-in `HttpException` JSON format for MVP
  (`statusCode`, `message`, `error`). Revisit if clients need error codes.
- Media: uploads go through a **storage service module** (local disk for the
  MVP demo, S3-compatible later — see `database.md` → Media).

## Open

- Rate limiting / brute-force protection on login (nice-to-have for MVP).
- Error-code catalog (only if FE needs machine-readable codes).
- `apps/ai` (FastAPI) integration contract — designed in Sprint 2 (see
  `docs/03-ai/`).
