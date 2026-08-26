# Seed media

Drop a few photos and video clips here, then run `pnpm seed` from the repo
root. Subfolders are fine — dragging a whole folder in works.

```
apps/api/prisma/seed-images/
  01-family.jpg
  02-garden.jpg
  ...
```

- Photos: `.jpg` `.jpeg` `.png` `.webp` `.heic` — up to **8**
- Videos: `.mp4` `.mov` `.m4v` — up to **2**
- Read in **path order** — number the files if you care which one lands where
- Photos are resized to 1600px and converted to JPEG; videos are converted to
  MP4. Straight-off-the-phone or straight-off-the-camera files are fine

The images themselves are **gitignored on purpose** — only this README is
committed. Everyone supplies their own.

## Why they are not in the repository

`Media` rows live in the shared Neon database; the files they point at live in
`apps/api/uploads/`, which is local to each machine. The seed writes your
media to fixed storage keys (`seed/01.jpg`, `seed/v01.mp4`, …), so the rows
everyone shares stay valid on every machine — each person just sees their own
pictures in those slots.

A machine with no images here still seeds fine; it skips media and says so.
A machine with **fewer** images than the person who seeded first will have
rows whose files are missing, and those particular photos 404 until you add
more. Full explanation: `docs/04-devops/local-environment.md` § Seeding demo data.
