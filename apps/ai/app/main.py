"""NHA AI service (FastAPI) — client duy nhất là NestJS (apps/api).

Chạy dev:  .venv\\Scripts\\uvicorn app.main:app --port 8000 --reload
Mock mode: AI_MOCK=1 (mặc định) — 0 token, dữ liệu giả lập đúng schema.
"""

import json

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import mock, prompts
from .config import settings
from .llm import chat_json
from .schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ContextAnalysis,
    GiftIdea,
    GiftIdeasRequest,
    GiftIdeasResponse,
    GiftInsight,
    InterestSignal,
    MessageRequest,
    MessageResponse,
    MessageVariant,
    ProfileJson,
    RollupRequest,
    RollupResponse,
    StoryboardRequest,
    StoryboardResponse,
    StoryboardScene,
)

app = FastAPI(title="NHA AI service", version="0.1.0", docs_url="/docs")


def require_internal(x_internal_token: str | None = Header(default=None)) -> None:
    """Token nội bộ đơn giản giữa NestJS ↔ FastAPI. Trống = dev, bỏ kiểm tra."""
    expected = settings().internal_token
    if expected and x_internal_token != expected:
        raise HTTPException(status_code=401, detail="invalid internal token")


@app.get("/health")
def health() -> dict:
    s = settings()
    return {"ok": True, "mock": s.ai_mock, "has_key": bool(s.openai_api_key)}


# ---------- payload models cho LLM (không chứa field do service tự thêm) ----------


class _GiftPayload(BaseModel):
    ideas: list[GiftIdea]
    insights: list[GiftInsight] = Field(default_factory=list)
    note_to_giver: str | None = None


class _MessagePayload(BaseModel):
    variants: list[MessageVariant]


class _PaletteModel(BaseModel):
    """OpenAI strict mode KHÔNG nhận dict tự do (additionalProperties) — phải liệt kê rõ 4 màu."""

    primary: str
    secondary: str
    accent: str
    text_on_dark: str


class _StoryboardPayload(BaseModel):
    title: str
    subtitle: str = ""
    opening: str = ""
    closing: str = ""
    dedication: str = ""
    scenes: list[StoryboardScene]
    palette: _PaletteModel
    music_theme: str = "family"


class _AnalyzePayload(BaseModel):
    """context_analysis đứng TRƯỚC — ép model phân giải ngôi/vai rồi mới suy signal."""

    context_analysis: ContextAnalysis
    description: str
    signals: list[InterestSignal] = Field(default_factory=list)


def _member_block(req: GiftIdeasRequest | MessageRequest | StoryboardRequest) -> str:
    """Khối ngữ cảnh: hồ sơ đã chưng cất + MEMO nguyên văn. KHÔNG có caption bài đăng.

    Mỗi bài đăng đã được đọc một lần ở bước analyze và gộp vào hồ sơ, nên gửi lại
    caption là phân tích hai lần cùng một dữ liệu. Provenance lấy từ `sig_…` bên
    trong hồ sơ. Memo thì luôn đi nguyên văn: lời người thân viết tay là nguồn tin
    cậy cao nhất và không bao giờ được chưng cất.
    """
    m = req.member
    memos = [e for e in m.evidence if e.kind == "memo"]
    others = [e for e in m.evidence if e.kind != "memo"]

    def fmt(items: list) -> str:
        return "\n".join(
            f"- [{e.id}] ({e.kind}{' by ' + e.author_name if e.author_name else ''}"
            f"{', ' + e.created_at[:10] if e.created_at else ''}): {e.text}"
            for e in items
        )

    profile_block = (
        f"\n\n## DISTILLED PROFILE (version {m.profile_version} — written by the rollup step, verbatim JSON;"
        " the sig_… ids inside `evidence`, `source` fields are citable)\n" + m.profile.model_dump_json(indent=2)
        if m.profile is not None
        else "\n\n## DISTILLED PROFILE\n(nothing distilled yet — say what you can from the notes alone)"
    )

    return (
        f"Member: {m.display_name}"
        + (f" ({m.role_label})" if m.role_label else "")
        + (f", born {m.birth_date}" if m.birth_date else "")
        + f"\nInterests: {', '.join(m.interests) or '(none recorded)'}"
        + f"\nHARD AVOID LIST: {', '.join(m.avoid) or '(none)'}"
        + f"\nPast gifts: {', '.join(m.past_gifts) or '(none)'}"
        + profile_block
        + f"\n\n## NOTES WRITTEN BY RELATIVES ({len(memos)}) — NOT part of the profile, highest-trust source, must be respected\n"
        + (fmt(memos) or "(none)")
        + (f"\n\n## OTHER EVIDENCE ({len(others)})\n{fmt(others)}" if others else "")
    )


def _citable_ids(member) -> set[str]:
    """Id được phép trích: memo đang gửi + mọi `sig_…` nằm trong hồ sơ đã chưng cất.

    Signal id là cầu nối về bài gốc — NestJS lần từ `sig_…` ra bài đăng và tấm ảnh,
    nên trích signal cho provenance tốt hơn là trích caption đã bị bỏ khỏi prompt.
    """
    ids = {e.id for e in member.evidence}
    p = member.profile
    if p is not None:
        for i in p.interests:
            ids.update(i.evidence)
        for w in p.wishes:
            if w.source:
                ids.add(w.source)
        for g in p.gift_ideas_pending:
            if g.source:
                ids.add(g.source)
    return ids


_NO_AVOID_NOTE = {
    "en": "Nothing to avoid was recorded in the profile or in the family's notes — check with whoever knows them best before buying food or drink.",
    "ja": "プロフィールや家族のメモに避けるべきことは記録されていません。食べ物や飲み物を贈る前に、いちばん近いご家族にひと言確認してください。",
    "vi": "Hồ sơ và ghi chú của gia đình không ghi điều gì cần tránh — nếu tặng đồ ăn uống thì vẫn nên hỏi lại người gần gũi nhất.",
}


def _no_avoid_note(req: GiftIdeasRequest) -> str:
    return _NO_AVOID_NOTE.get(req.locale, _NO_AVOID_NOTE["en"])


@app.post("/v1/gift-ideas", response_model=GiftIdeasResponse, dependencies=[Depends(require_internal)])
def gift_ideas(req: GiftIdeasRequest) -> GiftIdeasResponse:
    s = settings()
    if s.ai_mock:
        return mock.mock_gift_ideas(req)
    user = (
        f"{_member_block(req)}\n\nOccasion: {req.occasion_label}"
        + (f" ({req.occasion_date})" if req.occasion_date else "")
        + (f"\nGiver: {req.giver_name} ({req.giver_relation})" if req.giver_name else "")
        + (f"\nBudget: {req.budget_label}" if req.budget_label else "")
        + (f"\nIdeas the family already saved (put these first): {', '.join(req.saved_ideas)}" if req.saved_ideas else "")
        + f"\nLocale: {req.locale}\nReturn {min(req.max_ideas, 4)}–{req.max_ideas} ideas."
    )
    payload = chat_json(s.model_suggest, prompts.GIFT_SYSTEM, user, _GiftPayload, feature="suggest_gift")
    counts = {"notes": 0, "photos": 0, "past_gifts": len(req.member.past_gifts)}
    for e in req.member.evidence:
        counts["notes" if e.kind == "memo" else "photos"] = counts.get("notes" if e.kind == "memo" else "photos", 0) + 1
    valid_ids = _citable_ids(req.member)
    for idea in payload.ideas:  # chốt an toàn provenance: nguồn phải là id THẬT
        idea.sources = [x for x in idea.sources if x.evidence_id in valid_ids]
    for ins in payload.insights:
        ins.sources = [x for x in ins.sources if x.evidence_id in valid_ids]
    # "Lưu ý cho người tặng" LUÔN có mặt: không có kiêng kỵ cũng phải nói ra,
    # vì người tặng cần biết là hệ thống ĐÃ kiểm chứ không phải bỏ qua.
    note = (payload.note_to_giver or "").strip() or _no_avoid_note(req)
    return GiftIdeasResponse(
        ideas=payload.ideas[: req.max_ideas],
        insights=payload.insights[:2],
        note_to_giver=note,
        evidence_read=counts,
        model=s.model_suggest,
        mock=False,
    )


@app.post("/v1/message-suggestions", response_model=MessageResponse, dependencies=[Depends(require_internal)])
def message_suggestions(req: MessageRequest) -> MessageResponse:
    s = settings()
    if s.ai_mock:
        return mock.mock_message(req)
    user = (
        f"{_member_block(req)}\n\nOccasion: {req.occasion_label}"
        + (f"\nGiver: {req.giver_name} ({req.giver_relation})" if req.giver_name else "")
        + f"\nTone: {req.tone}\nLocale: {req.locale}"
    )
    payload = chat_json(s.model_suggest, prompts.MESSAGE_SYSTEM, user, _MessagePayload, feature="suggest_message")
    valid_ids = _citable_ids(req.member)
    for v in payload.variants:
        v.memories_used = [i for i in v.memories_used if i in valid_ids]
    return MessageResponse(variants=payload.variants, model=s.model_suggest, mock=False)


@app.post("/v1/video-storyboard", response_model=StoryboardResponse, dependencies=[Depends(require_internal)])
def video_storyboard(req: StoryboardRequest) -> StoryboardResponse:
    s = settings()
    if s.ai_mock:
        return mock.mock_storyboard(req)
    media_lines = "\n".join(
        f"- {m.media_id} ({m.kind}{', ' + str(m.duration_s) + 's' if m.duration_s else ''}"
        f"{', ' + m.taken_at if m.taken_at else ''}): {m.caption or '(no caption)'}"
        for m in req.media
    )
    user = (
        f"{_member_block(req)}\n\nTitle hint: {req.title_hint or '(none)'}\n"
        f"Occasion / kind of film: {req.kind_label or '(not specified)'}\n"
        f"Target length: {req.target_sec}s · Mood: {req.mood} · Locale for on-screen text: {req.locale}\n"
        f"Media ({len(req.media)}):\n{media_lines}"
    )
    payload = chat_json(s.model_suggest, prompts.STORYBOARD_SYSTEM, user, _StoryboardPayload, feature="video_storyboard")
    valid = {m.media_id for m in req.media}
    scenes = [sc for sc in payload.scenes if sc.media_id in valid] or mock.mock_storyboard(req).scenes
    music = payload.music_theme if payload.music_theme in ("birthday", "family", "nostalgia", "gentle", "wafu") else "family"
    raw_palette = payload.palette.model_dump()
    hex_ok = lambda v: isinstance(v, str) and len(v) == 7 and v.startswith("#")  # noqa: E731
    palette = {k: (raw_palette.get(k) if hex_ok(raw_palette.get(k)) else v) for k, v in
               {"primary": "#6b5d4f", "secondary": "#a89a85", "accent": "#c9a227", "text_on_dark": "#f2ecdc"}.items()}
    return StoryboardResponse(
        title=payload.title, subtitle=payload.subtitle, opening=payload.opening, closing=payload.closing,
        dedication=payload.dedication, scenes=scenes, palette=palette,
        music_theme=music,  # type: ignore[arg-type]
        model=s.model_suggest, mock=False,
    )


@app.post("/v1/analyze-post", response_model=AnalyzeResponse, dependencies=[Depends(require_internal)])
def analyze_post(req: AnalyzeRequest) -> AnalyzeResponse:
    """Tầng 1 của việc hiểu một người: bài đăng → 0-4 interest signal VỀ CHÍNH TÁC GIẢ.

    Một bài = ĐÚNG một call, kể cả 6 ảnh: ảnh gửi kèm dạng detail="low".
    """
    s = settings()
    if s.ai_mock:
        return mock.mock_analyze(req)

    tagged = "\n".join(
        f"- {p.label}: {p.display_name}"
        + (f" — {p.relation_to_author}" if p.relation_to_author else "")
        for p in req.tagged
    )
    user = (
        f"AUTHOR (all interest_signals must describe this person): {req.author_name or '(unknown)'}"
        + (f" — family role: {req.author_role}" if req.author_role else "")
        + f"\nAUTHOR'S FAMILY RELATIONSHIPS (use these to resolve kinship words in the caption): "
        + (", ".join(req.author_relations) or "(unknown)")
        + f"\nCaption (written by the author, from the author's point of view): {req.caption or '(none)'}"
        + f"\nPlace: {req.place or '(unknown)'}"
        + f"\nDate taken: {req.taken_at or '(unknown)'}"
        + f"\nTagged people appearing in the post:\n{tagged or '(none)'}"
        + (f"\nTranscript of the clip: {req.transcript}" if req.transcript else "")
        + f"\nPhotos attached: {len(req.images_b64)}"
        + f"\nLocale: {req.locale}"
    )
    payload = chat_json(
        s.model_analysis,
        prompts.ANALYZE_SYSTEM,
        user,
        _AnalyzePayload,
        images_b64=req.images_b64[:6],
        feature="analyze_post",
    )
    # Chốt an toàn: trần confidence theo nguồn được NestJS áp lại lần nữa khi ghi DB.
    signals = [sg for sg in payload.signals if sg.topic.strip()][:4]
    return AnalyzeResponse(
        context_analysis=payload.context_analysis,
        description=payload.description,
        signals=signals,
        model=s.model_analysis,
        mock=False,
    )


@app.post("/v1/profile-rollup", response_model=RollupResponse, dependencies=[Depends(require_internal)])
def profile_rollup(req: RollupRequest) -> RollupResponse:
    """Tầng 2: gộp signal chưa xử lý + profile hiện tại → VIẾT LẠI toàn bộ profile.

    Không phải đếm tần suất: model gộp topic gần nghĩa, xử lý mâu thuẫn theo thời
    gian, đánh trend, và giữ nguyên gift_history (6 quy tắc trong ROLLUP_SYSTEM).
    """
    s = settings()
    if s.ai_mock:
        return mock.mock_rollup(req)

    current = req.current_profile or ProfileJson()
    signal_lines = "\n".join(
        f"- {sg.id} | source: {sg.source_type} ({sg.source_id or '-'}) | date: {sg.observed_at}"
        f" | type: {sg.signal_type} | topic: {sg.topic} | detail: {sg.detail} | confidence: {sg.confidence}"
        for sg in req.signals
    )
    user = (
        f"## MEMBER\n{req.display_name}"
        + (f" — {req.role_label}" if req.role_label else "")
        + (f", born {req.birth_date}" if req.birth_date else "")
        + f". Family relationships: {', '.join(req.relations) or '(not declared)'}. Today: {req.today}."
        + f"\n\n## CURRENT PROFILE (version {req.current_version})\n{current.model_dump_json(indent=2)}"
        + f"\n\n## UNPROCESSED SIGNALS ({len(req.signals)})\n{signal_lines or '(none)'}"
        + f"\n\nLocale: {req.locale}\nRewrite the whole profile now."
    )
    profile = chat_json(s.model_analysis, prompts.ROLLUP_SYSTEM, user, ProfileJson, feature="rollup_profile")

    # Quy tắc "gift_history chỉ thêm, không xoá" — không tin model, ghép lại bằng code.
    kept = {(g.date, g.gift) for g in profile.gift_history}
    for g in current.gift_history:
        if (g.date, g.gift) not in kept:
            profile.gift_history.append(g)
    # Trần 12 interests (quy tắc 5) — cắt bằng code, giữ mục tự tin nhất.
    profile.interests = sorted(profile.interests, key=lambda i: i.confidence, reverse=True)[:12]
    return RollupResponse(profile=profile, model=s.model_analysis, mock=False)
