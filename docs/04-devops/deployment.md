# Deployment

> Status: not yet decided. Nothing in this repository is deployed anywhere.
> Do not assume a hosting target until this document is filled in.

## To Be Decided

- [ ] Hosting for `apps/web` (Next.js) — e.g. Vercel, self-hosted
- [ ] Hosting for `apps/api` (NestJS) — e.g. Railway, Fly.io, VPS, container platform
- [ ] Hosting for `apps/ai` (FastAPI, once created)
- [ ] PostgreSQL hosting — e.g. managed Postgres (Neon, Supabase, RDS) vs self-managed
- [ ] Media storage (photos/videos/audio) — this is a long-term family archive
      product, so storage durability and cost at scale matter; also listed as
      an open decision in `docs/00-shared/product-overview.md` § 18
- [ ] Domain/DNS
- [ ] Environment strategy (staging vs production)
- [ ] Backup and disaster recovery for user memories/media (high consequence
      if lost, given the product's "long-term" principle)

## Notes

Deployment choices should be made after `docs/00-shared/mvp-scope.md` defines
what actually needs to run in production for v1.
