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
this seam: NestJS creates the authoritative `VideoJob` row
(PENDING) and calls `POST /videos` with `{ jobId, mediaPaths[], locale,
style? }`; media travel as **paths in the shared storage volume**
(`UPLOAD_DIR` — both services see the same disk in the MVP deployment).
FastAPI processes async and reports completion to the NestJS internal
callback `POST /api/internal/video-jobs/:jobId/complete` (same
`X-AI-Service-Token`) with `{ resultPath }` or `{ error }`; NestJS
updates the row and serves the file through the existing authorized
Media streaming. The app only ever polls NestJS (`GET /api/video-jobs/:id`).

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

## Open items for the AI team to record here

- Final model choices per feature (and cost ceiling).
- Prompt/versioning conventions.
- Video render approach inside `apps/ai` (tooling is theirs; the seam
  above does not change with it).
