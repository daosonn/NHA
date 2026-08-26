# Seed images

Drop a few photos here, then run `pnpm seed` from the repo root.

```
apps/api/prisma/seed-images/
  01-family.jpg
  02-garden.jpg
  ...
```

- Accepted: `.jpg` `.jpeg` `.png` `.webp` `.heic`
- Read in **filename order**, up to **8** of them — number the files if you
  care which photo lands on which post
- Resized to 1600px on the long edge and converted to JPEG on the way in, so
  straight-off-the-phone photos are fine

The images themselves are **gitignored on purpose** — only this README is
committed. Everyone supplies their own.

## Why they are not in the repository

`Media` rows live in the shared Neon database; the files they point at live in
`apps/api/uploads/`, which is local to each machine. The seed writes your
photos to fixed storage keys (`seed/01.jpg`, `seed/02.jpg`, …), so the rows
everyone shares stay valid on every machine — each person just sees their own
pictures in those slots.

A machine with no images here still seeds fine; it skips media and says so.
A machine with **fewer** images than the person who seeded first will have
rows whose files are missing, and those particular photos 404 until you add
more. Full explanation: `docs/04-devops/local-environment.md` § Seeding demo data.
