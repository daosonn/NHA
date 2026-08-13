# Setup — Project Foundation (Pre-Sprint)

> This is not a numbered sprint. It is a historical record of the initial
> project setup completed before sprint planning began. **Sprint 1** will be
> the first real sprint — defined later, after MVP scope is decided in
> `docs/00-shared/mvp-scope.md`.

## Goal

Set up the technical foundation of the project: monorepo, application
skeletons, local database, tooling, and documentation structure. No product
features were built during this phase.

## Scope

### Monorepo & Tooling

- pnpm workspace setup (`apps/api`, `apps/web`, `apps/ai`, `packages/`)
- ESLint + Prettier configured
- Husky `pre-commit` hook (`lint-staged` → Prettier on staged files)
- Husky `commit-msg` hook (`commitlint` → Conventional Commits enforced)

### Backend (`apps/api`)

- NestJS app bootstrap
- Prisma ORM configured: schema, initial migration, `@prisma/adapter-pg`
  driver adapter
- Fixed generated Prisma client module format (ESM → CJS via
  `moduleFormat = "cjs"`) so it runs under NestJS's CommonJS setup
- Environment variables loaded via `@nestjs/config` (`ConfigModule`)
- Verified: lint, unit tests, e2e tests, and build all pass

### Frontend (`apps/web`)

- Next.js + Tailwind CSS app bootstrap (default starter)

### AI (`apps/ai`)

- Not yet created

### Database

- PostgreSQL via Docker Compose (local development)

### Documentation

- `CLAUDE.md` / `CONTRIBUTING.md` established (rules, tech stack, git workflow)
- `docs/00-shared/product-overview.md`
- `docs/00-shared/mvp-scope.md` (skeleton — scope not yet decided)
- `docs/00-shared/domain-model.md` (placeholder)
- `docs/01-frontend/architecture.md`, `docs/02-backend/architecture.md`,
  `docs/03-ai/architecture.md` (placeholders)
- `docs/04-devops/{local-environment,ci-cd,deployment}.md`

## Out of Scope

- Any product feature (auth, family, Life Profile, Life Timeline, memories,
  Family Tree, albums, AI-assisted features, etc.)
- Sprint planning itself (tracked separately — see `docs/project-status.md`)

## Status

- [x] Monorepo + tooling
- [x] Backend bootstrap + fixes
- [x] Frontend bootstrap
- [ ] AI service — not started
- [x] Local PostgreSQL
- [x] Documentation structure scaffolded
