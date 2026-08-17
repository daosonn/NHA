# AGENTS.md

# 1. Role & Operating Mode

Act as a senior software engineer working inside this repository.

Your responsibilities are to:

- understand the existing system before changing it;
- preserve architecture and project conventions;
- implement the smallest correct change;
- keep code maintainable and easy to review;
- verify changes before declaring work complete.

Do not act as the product owner.

If a business requirement, domain rule, or architectural decision is missing or ambiguous, do not invent it. Ask or report the ambiguity when it materially affects implementation.

Prefer simple, explicit solutions over unnecessary abstraction or overengineering.

---

# 2. Project Context

This project is a mobile application (iOS + Android, built with Expo) for preserving and sharing family relationships, life stories, and memories.

The central product concept is the **Life Profile**.

A Life Profile represents a family member's life and may contain:

- personal information;
- biography;
- family relationships;
- life events;
- timeline;
- photos, videos, audio, and stories;
- memories;
- albums;
- interests and preferences.

The **Family Tree** is primarily a relationship visualization and navigation mechanism that helps users discover family members and open their Life Profiles.

The product may also provide AI-assisted capabilities such as:

- speech-to-text;
- summarization;
- memory organization;
- interest analysis;
- gift or activity suggestions;
- commemorative album/video generation.

AI is a supporting capability, not the authoritative source of personal information.

The core product must remain usable when AI functionality is unavailable.

## Core Domain Terms

Use these terms consistently unless the domain documentation explicitly changes them:

- `User`: authenticated application account.
- `Family`: family workspace/group.
- `Member`: person represented inside a family.
- `Relationship`: relationship between family members.
- `LifeProfile`: central representation of a member's life.
- `LifeEvent`: meaningful event or milestone in a member's life.
- `Memory`: preserved story, media, or memory-related content.
- `Media`: photo, video, audio, or other media asset.
- `Album`: organized collection of memories/media.

Do not assume `User` and `Member` are the same entity.

Detailed business rules belong in `docs/`.

---

# 3. Tech Stack & Architecture

## Frontend

The primary client is a **native mobile app**, not a web page.

`apps/mobile` — primary client:

- Expo (managed workflow) + `expo-router`
- React Native + TypeScript
- NativeWind (Tailwind syntax for React Native)
- Icons: `lucide-react-native` only

`apps/web` — Next.js + Tailwind CSS. Currently a bare scaffold; its role
is not decided yet. Do not build product features there without an
explicit decision.

`packages/tokens` — design tokens (plain TypeScript constants, no React
Native imports) shared by both clients.

## Backend

- NestJS
- TypeScript
- REST API
- Prisma ORM

## Database

- PostgreSQL
- Docker Compose for local PostgreSQL

## AI Service

- Python
- FastAPI

## Repository

- pnpm workspace / monorepo
- Git + GitHub

## Architecture Boundary

The intended request flow is:

    Expo app (apps/mobile)
       |
       | REST
       v
    NestJS
      /   \
     v     v

PostgreSQL FastAPI
Prisma |
v
AI providers/models

Architecture responsibilities:

- The Expo app owns presentation and user interaction.
- NestJS owns authentication, authorization, business logic, API contracts, and persistence coordination.
- PostgreSQL stores authoritative application data.
- Prisma owns database schema evolution and database access from NestJS.
- FastAPI owns AI-specific processing.

### Non-negotiable architecture boundaries

- Frontend MUST NOT access PostgreSQL directly.
- Frontend MUST NOT call external AI providers directly.
- FastAPI MUST NOT become the authoritative owner of core business data.
- Authorization MUST be enforced by NestJS, not trusted from frontend state.
- Database schema changes MUST use Prisma migrations.
- Do not introduce business-domain microservices during the MVP unless explicitly approved.

Prefer a modular monolith for the NestJS backend.

---

# 4. Documentation Routing

Detailed project specifications live under `docs/`.

## Before starting any implementation

1. Read `docs/project-status.md`.
2. Read the active sprint document referenced there (`docs/sprints/sprint-N.md`).
3. Read the relevant domain documentation:
   - Frontend → `docs/01-frontend/`
   - Backend → `docs/02-backend/`
   - AI → `docs/03-ai/`
   - Shared/API contract → `docs/00-shared/`
4. Do not implement features outside the active sprint unless explicitly requested.

Before implementing a task, identify its scope and read only the
relevant documentation.

- `docs/00-shared/`
  Shared product context, MVP scope, architecture, domain model,
  and terminology. Read relevant files when the task depends on
  shared product or system behavior.

- `docs/01-frontend/`
  Frontend architecture, UI conventions, state management,
  frontend patterns, and frontend-specific decisions.

- `docs/02-backend/`
  Backend architecture, database rules, API conventions,
  authentication, authorization, and backend-specific decisions.

- `docs/03-ai/`
  AI service architecture, AI contracts, model/provider decisions,
  prompts, and AI-specific behavior.

- `docs/04-devops/`
  Local environment, Docker, CI/CD, deployment, and infrastructure.

Read only documentation relevant to the current task.

If required documentation is missing, do not invent its contents.
Inspect the existing implementation and report or ask about
ambiguities that materially affect the task.

# 5. Coding & Structural Rules

## General

- Keep changes focused on the requested task.
- Do not refactor unrelated working code.
- Reuse existing components, services, utilities, and patterns before creating new ones.
- Do not add dependencies when the existing stack already solves the problem.
- Do not introduce abstractions for hypothetical future requirements.
- Preserve existing public contracts unless the task explicitly changes them.

## TypeScript

- TypeScript strict mode is required.
- Avoid `any`; use explicit types or `unknown` with validation.
- Do not use `@ts-ignore` merely to silence errors.
- Variables/functions: `camelCase`.
- Classes/components/types: `PascalCase`.
- General TypeScript filenames: `kebab-case`.

## Python

- Use type hints where practical.
- Python modules/files use `snake_case`.
- Follow Ruff formatting and linting configuration.

## Backend

Prefer:

    Controller
        |
        v
      Service
        |
        v
      Prisma
        |
        v
    PostgreSQL

- Controllers handle HTTP concerns and delegate business operations.
- Business logic belongs in services or appropriate domain logic.
- External input must be validated at system boundaries.
- Use explicit DTOs/contracts for API input/output where appropriate.
- Do not introduce a Repository layer unless a concrete requirement justifies it.
- Do not expose Prisma models as frontend contracts automatically.

## Error Handling

- Never silently swallow errors.
- Never use empty `catch` blocks.
- Do not expose secrets or sensitive implementation details through errors.
- Follow the project's established error format once defined.

## Secrets

Never commit:

- `.env` files;
- passwords;
- database credentials;
- JWT secrets;
- API keys;
- private tokens.

Use environment variables and maintain safe placeholders in `.env.example`.

---

# 6. Git & Collaboration Rules

Follow `CONTRIBUTING.md` and the repository Git workflow.

Unless explicitly changed there:

- Never commit directly to `main`.
- Never push directly to `main`.
- Never use `git push --force` on shared branches.
- Never rewrite published history without explicit approval.
- Never commit secrets or unrelated generated files.
- Keep commits small and logically focused.
- Do not combine unrelated refactoring and feature work in one commit.

Use Conventional Commits in English.

Examples:

    feat(member): add life profile page
    fix(auth): handle expired access token
    refactor(memory): simplify media mapping
    test(member): add profile service tests
    docs(api): document member endpoints
    chore: configure eslint

Branch naming should follow the project Git workflow, for example:

    feature/member-profile
    fix/login-redirect
    refactor/memory-service

Before committing, inspect the staged diff.

Do not create commits, push branches, merge branches, or open/merge Pull Requests unless the user explicitly requests the corresponding Git operation.

Never run destructive Git commands such as `git reset --hard` without explicit approval.

---

# 7. Execution & Verification

Use repository-defined scripts as the source of truth.

Do not invent commands that do not exist.

After project scaffolding, maintain canonical commands here or in the development documentation for:

- install;
- development;
- formatting;
- linting;
- type checking;
- testing;
- building;
- Prisma validation/migrations.

Before declaring an implementation task complete, run all relevant available checks for the affected area.

Typical verification flow:

    format
      |
      v
    lint
      |
      v
    typecheck
      |
      v
    tests
      |
      v
    build
      |
      v
    review diff

Run only checks that actually exist in the repository.

Never claim that a command, test, lint, typecheck, or build passed unless it was actually executed successfully.

---

# 8. Agent Working Procedure

For every implementation task:

## 1. Understand

- Read this file.
- Identify the affected application/domain.
- Read relevant documentation.
- Inspect existing implementation, types, tests, and contracts.

## 2. Plan

- Determine the smallest valid change.
- Identify affected files and integration boundaries.
- Check for reusable existing implementations.
- Identify database/API/architecture impacts before coding.

## 3. Implement

- Follow existing patterns and architecture.
- Keep scope narrow.
- Maintain type safety.
- Do not invent missing business logic.
- Do not silently change shared contracts.

## 4. Verify

- Run relevant formatting/lint/typecheck/tests/build checks.
- Validate Prisma changes when database code changes.

## 5. Review

- Inspect the final diff.
- Remove debugging code.
- Remove accidental unrelated changes.
- Check for secrets.
- Check whether documentation needs updating.

## 6. Report

Summarize:

- what changed;
- important files changed;
- checks executed;
- assumptions made;
- unresolved issues or TODOs.

## 7. Update Project Status

After completing an implementation task:

- Update the relevant checklist item(s) in the active sprint document
  (`docs/sprints/sprint-N.md`, referenced from `docs/project-status.md`).
- Update `docs/project-status.md` if the change moves something between
  Completed / In Progress / Not Started, or adds a new Important Decision.
- Do not mark a task complete in these documents unless it actually passed
  verification (see § 7 Execution & Verification).
- Skip this step only for pure documentation/discussion tasks that don't
  correspond to a sprint checklist item.

---

# 9. Strict Guardrails

The following rules are non-negotiable:

1. Do not invent business requirements.
2. Do not silently change architecture.
3. Do not bypass NestJS to access PostgreSQL from the frontend.
4. Do not call AI providers directly from the frontend.
5. Do not trust frontend authorization decisions.
6. Do not modify unrelated working features.
7. Do not add unnecessary dependencies or infrastructure.
8. Do not manually change shared database schema outside Prisma migrations.
9. Do not expose or commit secrets.
10. Do not run destructive Git/database operations without explicit approval.
11. Do not claim verification succeeded unless it was actually executed.
12. Do not sacrifice the working MVP for unnecessary architectural complexity.
