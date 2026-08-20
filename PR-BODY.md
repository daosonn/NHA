# AI integration for screens 21-33, merged with main

Brings the AI feature area (gift ideas, message & card, memory video, and the
layer that lets the app understand a person) into `main` as it stands after
2026-08-19. Base of the work was `b21ec29`; `origin/main` (41 commits ahead) is
merged in with a real merge commit, no rebase, so both histories stay auditable.

## What is new

**`apps/ai` — a FastAPI service, the only place that talks to an AI provider.**
`/v1/gift-ideas`, `/v1/message-suggestions`, `/v1/video-storyboard`,
`/v1/analyze-post`, `/v1/profile-rollup`, `/health`. Strict `json_schema` built
from pydantic; `AI_MOCK=1` answers everything with schema-correct data for zero
tokens, which is how CI runs it. Stateless, never touches Postgres — the
non-negotiable from `docs/03-ai/architecture.md` holds.

**Understanding a person, in two layers.** Each post is read once
(`analyzePost`, background, retried once) into `InterestSignal` — atomic,
append-only evidence that belongs to the post's AUTHOR, not to the people tagged
in it. The rollup then distils those signals into a versioned `MemberProfile`
(~1k tokens, six merge rules, `gift_history` re-merged in code). Suggestions read
the distilled profile plus relatives' notes verbatim, so no post is ever analysed
twice; provenance still resolves through `sig_…` ids back to the original post and
photo (`GET /families/:id/members/:id/evidence?refs=…`).

**Real products, zero tokens.** `src/ai/shops.service.ts` turns the model's
Japanese keywords into actual Yahoo!ショッピング items: widening ladder when a
query is empty, price ±10%, avoid-list filtering, scoring, top 3, weekly cache.

**Memory video.** `src/video` renders in-process with ffmpeg (beat-cut, Ken
Burns, six opening styles, audio ducking) behind an async `VideoJob`, streams the
result with Range support and shares it to the family timeline.

**13 mobile screens** (11a-11l) wired to the API, EN/JA strings, plus the
"Present" hub reading real special dates.

## Conflicts and how each was resolved

| File | Resolution |
| --- | --- |
| `apps/api/prisma/schema.prisma` | Union. `VideoJob` keeps their `resultMediaId`/`resultMedia` **and** my `familyId`, `aboutMemberId`, `title`, `mode`, `options`, `plan`, `progress`, `stage`, `durationS`. `FamilyMember` keeps their `invitations` next to my `interestSignals`/`profiles`/`counter`. |
| `apps/api/src/ai/ai.module.ts` | One module, both surfaces: their `AiInternalController` + `InsightService` + `AiServiceGuard` and my `AiController` + gift/message/card/profile/shops services. Routes do not overlap. |
| `apps/api/src/app.module.ts` | Their `AlbumModule` kept. `VideoModule` (mine) wired; `VideoJobModule` (theirs) intentionally **not** — both answer `GET /video-jobs`, see below. |
| `apps/api/src/post/post.service.ts` | Their refactor to shared helpers plus my background analyze hook after the transaction. |
| `apps/api/src/storage/storage.service.ts` | Different methods; both kept (`removeAllBestEffort`, `absolutePathOf`). |
| `apps/mobile/src/locales/{en,ja}.json` | Three-way merge (base + mine + theirs). Keys they deleted stay deleted; their newer wording wins outside the AI area; my 229 new AI/video keys are added. A two-way union had resurrected dead keys — worth knowing if this file conflicts again. |
| `apps/mobile/src/lib/query-keys.ts`, `lib/api/index.ts`, `scripts/check-i18n.mjs` | Unions. `memberProfile` existed on both sides identically, kept once. |
| `docs/03-ai/architecture.md` | Their contract draft preserved word for word; the "open items for the AI team" section is now answered with what was built, followed by the five divergences listed below. |

Also adapted to their changes, not conflicts but semantic follow-ups:

- Memos now carry `title` + optional `content` + `category`. The AI context uses
  all three, and `category: health` is treated as the strongest caution the app
  has about a person.
- `evidence_read` counts now come from the database, not from what was sent to the
  model (the model no longer receives captions).
- `apps/api/assets/music/` (45 `.m4a`, ~80 MB) is gitignored, with a note on how
  to obtain it. Nothing binary was added to the repo.

## Please review these five closely

1. **`/video-jobs` owner.** `src/video-job` (WBS 2.2.3) and `src/video`
   (screens 27-33) both define `GET /video-jobs` and `GET /video-jobs/:jobId`,
   and they assume different lifecycles — theirs expects an external renderer to
   call `POST /internal/video-jobs/:jobId/complete`, mine renders in-process.
   Only `VideoModule` is registered; the other module is untouched in the tree.
   One of them should own the namespace.
2. **Analysis direction.** The contract has `apps/ai` polling
   `GET /internal/ai/media/pending` and pushing `MediaInsight` back. What runs is
   the reverse (NestJS → `POST /v1/analyze-post` on post creation → signals +
   profile). Their routes and `MediaInsight` are kept and still guarded, with no
   caller yet.
3. **Memo privacy.** Non-negotiable 5 says the context carries only the
   requesting user's own memos. The implementation currently sends every family
   member's memos about the subject, because design screen 22 shows "From Lan's
   note" as a source chip. This is a privacy boundary — it is called out rather
   than changed quietly, and it is a one-line filter either way.
4. **Provider.** The contract records Claude API as the direction; this runs
   OpenAI `gpt-5.6-luna` (one constant in `apps/ai/app/config.py`), because that
   is what the prototype was validated against.
5. **Service token naming.** `X-AI-Service-Token` / `AI_SERVICE_TOKEN` guards
   AI → NestJS; `x-internal-token` / `AI_INTERNAL_TOKEN` guards NestJS → FastAPI.
   Opposite directions, but the naming deserves unifying.

## Verification on the merged tree

- `pnpm lint` — clean (web + api)
- `tsc --noEmit` — clean for `apps/api` and `apps/mobile`
- `check-i18n` — 560 keys used, en/ja in step
- `pytest` (AI service, mock mode) — 7/7
- Jest e2e (`apps/api`) — 8/8, including a real ffmpeg render, Range streaming
  and sharing to the feed
- `prisma migrate deploy` — all ten migrations applied in order
- Built and booted: both teams' routes answer (`/api/families`,
  `/api/me/life-events`, `/api/me/albums`, `/api/me/gallery`, `/api/video-music`,
  `/api/video-jobs`), and `/api/internal/ai/media/pending` still refuses a user
  token.

Latency, measured 2026-08-19 (worth keeping): a gift round takes ~15s end to end,
a message ~6s. Almost all of it is the model call, and it scales with output
tokens — `gpt-5` needed 78s for the same work, which is why the prompts cap field
lengths and the model is pinned.
