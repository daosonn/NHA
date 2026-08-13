# CI/CD

> Status: not yet implemented. No `.github/workflows` exist in this repository.
> Do not assume any pipeline behavior until this document is filled in and
> the corresponding workflow files exist.

## To Be Decided

- [ ] CI provider (GitHub Actions assumed, given `Git + GitHub` in `CLAUDE.md` § 3)
- [ ] What runs on every PR: lint, typecheck, unit tests, e2e tests, build — per app or whole monorepo?
- [ ] Branch protection rules for `main` (require PR, required checks, required reviewers)
- [ ] Whether `apps/api` e2e tests need a real Postgres service in CI
- [ ] Release/versioning strategy, if any
- [ ] Secrets management in CI (DB URL, AI provider keys, etc.)

## Local Equivalent (until CI exists)

Husky hooks currently enforce checks only on the committing machine:

- `pre-commit` → `lint-staged` (Prettier on staged files)
- `commit-msg` → `commitlint` (Conventional Commits)

These do not run automatically for anyone who bypasses hooks (`--no-verify`)
or pushes from a machine without `pnpm install` run. CI is the gap that
would close this.
