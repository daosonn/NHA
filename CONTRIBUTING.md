# CONTRIBUTING.md

## 1. Workflow

All changes must follow:

Task → Branch → Code → Verify → Commit → Push → Pull Request → Review → Merge

Never develop directly on `main`.

Before starting:

```bash
git checkout main
git pull origin main
```

Then create a branch from the latest main.

2. Branch Naming

Format:

feature/<name>
fix/<name>
refactor/<name>
docs/<name>
test/<name>
chore/<name>

Examples:

feature/member-profile
fix/login-redirect
docs/product-overview
chore/setup-eslint

Rules:

Use lowercase English.
Use kebab-case.
Keep one logical task per branch. 3. Commit Convention

Use Conventional Commits:

<type>(<scope>): <description>

Allowed types:

feat
fix
refactor
docs
test
chore
ci
build

Examples:

feat(member): add life profile
fix(auth): handle expired token
docs(product): define MVP scope
chore: configure eslint

Rules:

Commit messages must be in English.
Keep commits focused on one logical change.
Do not mix unrelated refactoring and feature work.

Before committing:

git status
git diff
git diff --staged

Never commit secrets or .env files.

4. Push Rules

Push only your working branch.

Example:

git push -u origin feature/member-profile

Never:

push directly to main;
force-push shared branches;
rewrite shared history;
push secrets or private credentials. 5. Pull Requests

All changes to main must go through a Pull Request.

A Pull Request must:

contain one logical task;
have a clear title;
contain no unrelated changes;
pass required CI checks;
be reviewed before merge.

PR titles should follow Conventional Commits when practical.

Example:

feat(member): add life profile

For UI changes, include screenshots when useful.

For API or database changes, clearly describe the impact.

6. Review & Merge

At least one team member should review meaningful changes when practical.

Default merge strategy:

Squash and Merge

Do not merge when required CI checks are failing.

After merge:

git checkout main
git pull origin main
git branch -d <branch-name>

Create a new branch for the next task.

7. Parallel Development

Avoid unnecessary changes to shared or high-conflict files such as:

schema.prisma
package.json
pnpm-lock.yaml
docker-compose.yml
shared types
global configuration

If multiple developers need to change the same shared contract or database model, coordinate before implementation.

Do not reformat or refactor unrelated files.

Status docs (docs/project-status.md and docs/sprints/\*.md) are edited by
every branch, so conflicts there are normal. Rules:

- Keep sprint checklist notes to ONE line, e.g. `— done 2026-08-18 (PR #12)`.
  Put details in the PR description and the relevant docs file instead.
- When these files conflict on merge, ALWAYS keep both sides — every
  branch's ticks and entries must survive. Never resolve by picking one
  side wholesale; that loses teammates' updates.
- After resolving, re-read the file and check nothing was dropped or
  duplicated before committing.

Note for Claude Code users: `.claude/settings.json` ships a session-start
hook that fetches origin and lists new commits and changed docs, and the
same merge rules are written in CLAUDE.md, so the agent follows them
automatically. If you do not use Claude Code, the hook simply never runs —
nothing to install or configure.

8. Database Changes

All shared database schema changes must use Prisma migrations.

Before creating a migration:

Update from main.
Inspect the latest Prisma schema and migrations.
Make the schema change.
Generate the migration.
Commit both schema and migration.

Never make shared schema changes only through a database GUI.

The development database is **shared Neon Cloud PostgreSQL**, so a migration is
not only a code change: running it changes the database your teammates are
working in right now.

Author the migration against a database of your own — the opt-in local Docker
Postgres, or your own Neon branch. Once schema and migration are committed and
the PR is reviewed, apply it to the shared database:

pnpm --filter api exec prisma migrate deploy

Never point these at a shared database:

prisma migrate reset — drops and recreates it;
prisma migrate dev — the authoring command; on drift it offers to reset;
pnpm seed and pnpm test:e2e — both write real rows through DATABASE_URL.

Never put a real connection string or password in a commit, a PR description,
an issue or a log. apps/api/.env is gitignored and stays that way.

Full rules: docs/04-devops/local-environment.md § Neon rules.

9. Before Opening a PR

Verify:

Task is complete
No unrelated changes
No debug code
No secrets
Relevant lint passes
Relevant typecheck passes
Relevant tests pass
Build passes when applicable
Migration included when required
Documentation updated when required 10. Golden Rules
Keep main stable.
Use short-lived branches.
Integrate frequently.
Keep commits and PRs focused.
Never bypass failed CI without team agreement.
AI-generated code follows the same review process as human-written code.
