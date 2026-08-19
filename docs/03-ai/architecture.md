# AI Architecture

> Status: **contract draft** (2026-08-19, backend-authored at sprint-2
> start per `sprint-02.md` Notes). The AI team owns `apps/ai` and
> everything model-side; this document is the seam both teams build
> against. Change it by agreement, not silently — the NestJS proxy and
> the FastAPI service move together.

## Ownership

| Piece                                                         | Owner       |
| ------------------------------------------------------------- | ----------- |
| `apps/api` — mobile-facing endpoints, auth, context gathering | Backend     |
| `apps/ai` — FastAPI service, providers, prompts, video render | **AI team** |
| This contract                                                 | Both, by PR |

Provider direction: **Claude API** (chosen 2026-08-19; the AI team makes
the final model-level calls — e.g. a small model for suggestions, a
larger one where quality demands it — and records them here).

## Non-negotiables (from `CLAUDE.md` § 3 and product decisions)

1. The Expo app **never** calls `apps/ai` or an AI provider directly —
   everything goes through NestJS, which owns auth.
2. FastAPI is **stateless and never touches PostgreSQL**. NestJS gathers
   every piece of context and sends it in the request; FastAPI must not
   become an authoritative owner of core data. (`VideoJob` rows live in
   Postgres and are written by NestJS only.)
3. **The core product works when AI is down** (`product-overview.md`
   § 14): if FastAPI is unreachable or times out, NestJS answers
   `503 { code: "AI_UNAVAILABLE" }` and the app hides/degrades the AI
   surfaces. No cached fakes, no retry storms.
4. **Every suggestion shows its working** (decision 2026-08-18): the
   response carries `why` and `source` per suggestion, and the evidence
   counts are stated in the response envelope — a recommendation nobody
   can trace to a memo, a photo or the timeline is a guess wearing the
   family's clothes.
5. **Privacy boundary in the context**: memos are private to their
   author. The context NestJS sends contains only the _requesting
   user's own_ memos about the subject, plus shared content (profile
   interests, life events, shared posts). FastAPI never sees another
   member's private notes.

## Request flow

    Expo app ── REST (bearer) ──► NestJS  ── HTTP + X-AI-Service-Token ──► FastAPI ──► Claude API
                                   │  gathers context from Postgres          │ stateless
                                   ◄──────────── suggestions + provenance ───┘

Service-to-service auth: shared secret in `X-AI-Service-Token`
(env `AI_SERVICE_TOKEN` on both sides; requests without it are 401).
NestJS reads `AI_SERVICE_URL` (unset in local dev = AI features answer
503 cleanly). Suggestion calls time out at 30s NestJS-side.

## Two-phase pipeline (decided 2026-08-19)

Suggestions are not computed from raw photos at request time. The design
the team chose is two phases:

**Phase 1 — background analysis.** The AI team's service polls
`GET /api/internal/ai/media/pending` (photos not yet analysed, oldest
first, `storageKey` resolving under the shared `UPLOAD_DIR` volume), runs
vision on them, and pushes the extracted facts back through
`PUT /api/internal/ai/media/:mediaId/insight` — e.g. `{ scene: "outing",
labels: ["beach", "family"] }`; the JSON shape is the AI team's to define.
NestJS stores them in **`MediaInsight`, the hidden store** (migration
`20260819071710`): written only through that internal route, exposed by
**no user-facing API**, and cascade-deleted with its photo — deleting a
picture withdraws its traces. Images only for the MVP; video analysis is
a later conversation.

**Phase 2 — suggestion requests.** The context bundle combines the
hidden insights with the requester's own memos, the subject's profile,
timeline and visible posts. **Comments are excluded** (decided
2026-08-19).

**The anti-laundering rule.** An insight inherits the visibility of the
photo it came from. When NestJS assembles a bundle it filters insights
through the requester's own view of the source media (the same
`canViewPost` rule as everywhere else) — an insight derived from a photo
the requester cannot see never enters their bundle, so the hidden store
can never leak content across family or privacy boundaries.

Two consequences stated plainly:

- This _is_ automatic analysis — `mvp-scope.md`'s "manual context only"
  note is superseded for photos by this team decision (2026-08-19).
- In phase 1 **family photos leave the server for the Claude API**. That
  is inherent to vision analysis and should be confirmed with the
  customer (Japanese market, privacy-sensitive).

## FastAPI contract (what the AI team implements)

Base: internal only, JSON in/out, `Accept-Language`-free — locale is an
explicit field because copy must follow the requesting user's app
language (`vi` / `ja` / `en`).

### `GET /health`

`{ status: "ok", provider: "claude", model: "<current>" }` — what the
NestJS proxy pings.

### `POST /suggestions/gifts` · `POST /suggestions/messages` · `POST /suggestions/quality-time`

Request (built entirely by NestJS):

```jsonc
{
  "locale": "ja",
  "kind": "gifts", // matches the route; present for logging symmetry
  "subject": {
    // who the suggestion is about — no ids the model could leak, names only
    "name": "Dad",
    "birthDate": "1964-03-14", // nullable
    "interests": ["Bonsai", "Bát Tràng pottery"],
    "lifeEvents": [{ "title": "Opened the shop", "date": "1975-06-01", "place": "Huế" }],
  },
  "occasion": { "title": "62nd birthday", "date": "2026-03-14" }, // nullable
  "userContext": "He mentioned his shears are getting dull", // free text from the form, nullable
  "constraints": { "budget": "under 1,500,000₫", "count": 3 }, // per-feature, nullable fields
  "evidence": {
    // the requesting user's own private notes about the subject + shared content
    "memos": [
      { "title": "Likes chrysanthemums", "content": "…", "category": "gift", "updatedAt": "…" },
    ],
    "recentPosts": [{ "content": "…", "place": "…", "createdAt": "…" }],
    // phase-1 facts, already filtered by the requester's visibility of
    // the source photos (anti-laundering rule above)
    "photoInsights": [{ "scene": "outing", "labels": ["beach", "family"], "photoDate": "…" }],
    "counts": { "notes": 12, "photos": 248, "gifts": 3 }, // echoed back verbatim
  },
}
```

Response — the envelope states the evidence **before** the ideas, and
every idea carries its provenance (shape mirrors the shipped UI,
`apps/mobile/src/fixtures/ai.ts`):

```jsonc
{
  "evidence": { "notes": 12, "photos": 248, "gifts": 3 },
  "suggestions": [
    {
      "title": "Clay teapot from Bát Tràng",
      "price": "800,000 – 1,200,000₫", // gifts only; messages return "text", quality-time returns "steps"
      "tags": ["Bát Tràng", "In his taste"],
      "why": "He stopped at the shop near the ferry twice…",
      "source": "From Lan's note · 2 weeks ago", // human-readable; MUST trace to a sent evidence item
    },
  ],
  "model": "claude-haiku-4-5", // for logging/debugging, not shown to users
}
```

`messages` adds nothing structural (regenerate = the same call again);
`quality-time` returns `steps: string[]` per suggestion — the app may
save one as a `Plan` via the NestJS Plan endpoints (2.6.4, pure NestJS,
no AI involvement in the save).

### `POST /videos` + status

Video render (sprint 2.2) is **owned end-to-end by the AI team** behind
this seam — **the NestJS side shipped 2026-08-19**: NestJS creates the
authoritative `VideoJob` row and calls `POST /videos` with
`{ jobId, mediaPaths[], locale, style? }` (10s dispatch timeout; a
non-2xx or unreachable service = the job is rolled back and the app gets
`503 AI_UNAVAILABLE`, so retries are clean). Media travel as **paths in
the shared storage volume** (`UPLOAD_DIR` — both services see the same
disk in the MVP deployment). FastAPI processes async and reports to
`POST /api/internal/video-jobs/:jobId/complete` (same
`X-AI-Service-Token`) with `{ resultPath, mimeType }` on success — the
rendered file written under the shared volume — or `{ error }` on
failure. Anything in between is a 400, as is a body carrying **both**
shapes, an unsupported `mimeType`, or a `resultPath` that is not a
readable file under the volume; the file's **size is measured from
disk**, never taken from the payload. Duplicate or concurrent reports on
a finished job are acknowledged and ignored (retry-safe: the job is
claimed with a conditional update inside the registration transaction).
A dispatch **timeout** leaves the job PENDING — the AI service may have
accepted it, and its callback still completes the job late; only a
definite refusal rolls the job back. NestJS registers the result as the
requester's own Media row (FK `VideoJob.resultMediaId`, unique) and
serves it through the existing authorized streaming; the app only ever
polls NestJS (`GET /api/video-jobs/:id`).

## NestJS side (what backend implements — mobile-facing)

Documented in `docs/00-shared/api-contract.md` as each lands:

- `POST /api/ai/gifts` · `/api/ai/messages` · `/api/ai/quality-time` —
  auth'd; NestJS resolves the member, checks family membership, gathers
  the context above (own memos only), forwards, returns the envelope.
- `GET/POST/PATCH/DELETE /api/me/plans` + share endpoints (2.6.4) —
  `Plan`/`PlanShare` tables from sprint 0; owner edits, shares are
  view-only.
- `POST /api/video-jobs` · `GET /api/video-jobs/:id` (2.2) + the
  internal completion callback.
- Memory list (2.1.2) reuses `Post` — a filter extension on the family
  feed, no AI involvement.
- **Shipped 2026-08-19** — the phase-1 pipe:
  `GET /api/internal/ai/media/pending` (`?limit` 1–200, default 50) and
  `PUT /api/internal/ai/media/:mediaId/insight`
  (`{ insight: object, model: string }`, upsert). Both under
  `X-AI-Service-Token`; a user bearer token does not open them, and with
  `AI_SERVICE_TOKEN` unset they answer `503 { code: "AI_UNAVAILABLE" }`.

## What the AI team built (answers the open items above)

Written by the AI team 2026-08-19, after the contract draft above. Everything here
is running and covered by `pnpm verify`; the contract's non-negotiables (1-5) hold.

### Models

`gpt-5.6-luna` for every call 窶・analysis, rollup, gift, message, storyboard 窶・set through `MODEL_ANALYSIS` / `MODEL_SUGGEST` in `apps/ai/.env`, plus
`max_completion_tokens: 8192`. Measured 2026-08-19: `gpt-5` (reasoning) needed
77.9s for one gift round against luna's 14-16s, and that call is ~80% of the
latency the family feels. Do not switch models without re-measuring.

Latency is roughly linear in OUTPUT tokens (out 1420 竊・13.4s ﾂｷ out 2359 竊・24.3s),
so the prompts carry hard length caps per field and ask for exactly 5 ideas.
Both services log it: FastAPI writes `suggest_gift gpt-5.6-luna 15.0s in=2439
out=1520`, NestJS writes `gift ideas: AI 15.0s ﾂｷ shops 0.4s`.

### FastAPI surface (`apps/ai`, stateless, never touches Postgres)

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/gift-ideas` | 5 ideas + insights + `note_to_giver`, each idea with `why`, sources, JP search keywords |
| `POST /v1/message-suggestions` | three variants (short/standard/heartfelt) |
| `POST /v1/video-storyboard` | title/subtitle/opening/closing/dedication + scenes (caption, duration, reason) + palette |
| `POST /v1/analyze-post` | one post (caption + up to 6 photos) 竊・0-4 interest signals about its AUTHOR |
| `POST /v1/profile-rollup` | pending signals + current profile 竊・the next profile version |
| `GET /health` | reachability + whether a key is configured |

Every call uses OpenAI Structured Outputs (`json_schema`, `strict: true`) generated
from pydantic. `AI_MOCK=1` answers all of them with schema-correct data for 0 tokens,
which is how `pnpm test:ai` runs in CI.

### Understanding a person 窶・two layers

    post created 笏笏analyze (1 call, 竕､6 photos)笏笏笆ｺ  InterestSignal
                                                   atomic evidence, append-only
                                                          笏・rollup (1 call)
                                                          笆ｼ
                                                   MemberProfile v+1
                                                   distilled ~1k tokens, versioned

- `analyzePost` runs in the background when a post is created (retried once after
  8s on a provider error), and the rollup follows immediately 窶・  `ROLLUP_EVERY_N_POSTS` defaults to **1**. Rolling up at suggestion time is the
  one moment the user is actually waiting.
- The analysis prompt fills `context_analysis` FIRST: who did what to whom, and
  whether the author was ACTOR / RECIPIENT / OBSERVER. "Con trai v盻・quﾃｪ thﾄノ m蘯ｹ"
  posted by the mother means the MOTHER was visited 窶・not that she likes visiting.
- Signals belong to the post's AUTHOR, never to a tagged person. Code (not the
  model) decides `sourceType`, caps confidence (caption 0.75 ﾂｷ photo 0.85 ﾂｷ a
  human's 笙｡ 0.9) and stamps `observedAt` with the day it happened.
- The rollup follows six rules (never invent ﾂｷ human sources override machine
  ones ﾂｷ newer beats older, health goes to `avoid hard` ﾂｷ merge near-synonyms ﾂｷ
  竕､12 interests ﾂｷ set trend). `gift_history` is re-merged in code, not trusted to
  the model. Old versions are never overwritten, so a suggestion is always
  traceable to the profile that produced it.

### Gift and message read the profile, not the captions again

Each post is analysed once. Suggestion prompts carry the distilled profile plus
relatives' notes **verbatim** 窶・no captions a second time, which is both faster
and cheaper. Provenance survives because the model cites `sig_窶ｦ` ids from the
profile: `GET /families/:familyId/members/:memberId/evidence?refs=sig_窶ｦ,memo_窶ｦ`
resolves each one back to its signal 竊・original post 竊・photo, so screen 23
("Where this came from") still opens the real picture. If the post was deleted,
the signal's own detail is returned rather than silence.

Two independent caches: `AiSuggestionCache` (a whole round, keyed with the profile
version so new evidence invalidates it; the 竊ｻ button sends `force`) and
`ProductCache` (marketplace results by week + keyword + price band).

### Real products, 0 tokens

`src/ai/shops.service.ts` calls Yahoo!繧ｷ繝ｧ繝・ヴ繝ｳ繧ｰ `itemSearch V3`. The model only
supplies `search_keywords_ja`; "together" ideas map to a hard-coded 菴馴ｨ薙ぐ繝輔ヨ
keyword per `experience_kind`. When a query returns nothing the service widens in
steps (as-is 竊・wider budget 竊・shorter keyword 竊・both), then filters price ﾂｱ10%,
drops titles hitting the avoid list, dedupes and scores (price fit, review trust,
keyword match, has-image) and keeps the top 3. Three lookups run in parallel 窶・no
more, Yahoo rate-limits around 1 req/s. `resolve` returns `cached` / `relaxed` /
`dropped_by_avoid` / `attempts` so a price outside the budget can always be explained.

### Video render lives in NestJS, not in `apps/ai`

Rendering is ffmpeg work with no model call, so it sits in `src/video` beside the
data it needs (`VideoJob`, media on the shared volume) instead of crossing the
service boundary for every frame: cut on the music's beat, linear Ken Burns,
counter-slide/bloom/whip punctuation, six opening styles, and audio ducking that
keeps the voices in a family clip above the music. `apps/ai` only writes the
storyboard. The engine was ported from the `onemoretime` prototype after 92 smoke
checks there.

### Where the implementation differs from the draft above 窶・needs a team decision

1. **Analysis direction.** The draft has `apps/ai` polling
   `GET /internal/ai/media/pending` and pushing `MediaInsight` back. What runs is
   the opposite: NestJS calls `POST /v1/analyze-post` when a post is created, and
   stores `InterestSignal` + `MemberProfile`. The internal routes and
   `MediaInsight` are kept intact and still guarded; they simply have no caller
   yet. One of the two should eventually be retired.
2. **Provider.** The draft records Claude API as the direction; the implementation
   runs OpenAI (`gpt-5.6-luna`) because that is what the prototype was validated
   against. Provider choice is one constant in `apps/ai/app/config.py`.
3. **Memo scope.** Non-negotiable 5 says the context carries only the requesting
   user's own memos. The implementation currently sends every family member's
   memos about the subject, because design screen 22 shows "From Lan's note" as a
   source chip. This is a privacy boundary, so it is called out here rather than
   changed quietly 窶・see the PR description.
4. **Service token.** The draft's seam is `X-AI-Service-Token` / `AI_SERVICE_TOKEN`
   (AI 竊・NestJS). NestJS 竊・FastAPI uses `x-internal-token` / `AI_INTERNAL_TOKEN`.
   Both exist because they guard opposite directions; worth unifying the naming.
5. **`/video-jobs` namespace.** `src/video-job` (backend, WBS 2.2.3) and
   `src/video` (AI, screens 27-33) both answer `GET /video-jobs`. Only `src/video`
   is registered in `AppModule`; the other is left in the tree untouched.
