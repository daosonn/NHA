"""Mock provider — AI_MOCK=1: trả dữ liệu giả lập ĐÚNG schema, deterministic, 0 token.

Bắt buộc tồn tại vì nguyên tắc sản phẩm: "core phải chạy được khi AI unavailable"
(docs/00-shared/product-overview.md §14) — và để test tự động không tốn tiền.
Mock grounded vào evidence THẬT trong request (không bịa) để UI demo vẫn đúng tinh thần provenance.
"""

from .schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ContextAnalysis,
    GiftIdea,
    GiftIdeasRequest,
    GiftIdeasResponse,
    GiftInsight,
    GiftSource,
    InterestSignal,
    MessageRequest,
    MessageResponse,
    MessageVariant,
    ProfileAvoid,
    ProfileGiftIdea,
    ProfileInterest,
    ProfileJson,
    ProfileWish,
    RollupRequest,
    RollupResponse,
    RollupSignal,
    StoryboardRequest,
    StoryboardResponse,
    StoryboardScene,
)

_MOCK_PALETTES = {
    "warm": {"primary": "#8a5a3b", "secondary": "#d9b38c", "accent": "#e8a13c", "text_on_dark": "#f7ead9"},
    "nostalgic": {"primary": "#6b5d4f", "secondary": "#a89a85", "accent": "#c9a227", "text_on_dark": "#f2ecdc"},
    "playful": {"primary": "#2e6f95", "secondary": "#7fc8a9", "accent": "#f4a261", "text_on_dark": "#f5f9f7"},
    "quiet": {"primary": "#44576d", "secondary": "#8aa1b1", "accent": "#b0c4b1", "text_on_dark": "#eef2f1"},
}


def _src(req: GiftIdeasRequest, i: int) -> list[GiftSource]:
    ev = req.member.evidence
    if not ev:
        return []
    e = ev[i % len(ev)]
    return [GiftSource(evidence_id=e.id)]


def mock_gift_ideas(req: GiftIdeasRequest) -> GiftIdeasResponse:
    name = req.member.display_name
    ideas = [
        GiftIdea(
            title=f"(mock) A garden set {name} can use standing up",
            kind="gift",
            category="Hobbies",
            why="(mock) Grounded in the first evidence item provided.",
            sources=_src(req, 0),
            price_range=req.budget_label or "3.000〜8.000円",
            search_keywords_ja="園芸 3点セット 長柄 軽量",
            experience_kind="none",
            tags=["(mock) practical", "no bending"],
        ),
        GiftIdea(
            title="(mock) An afternoon together nearby",
            kind="together",
            category="Together",
            why="(mock) Company over objects — from shared posts.",
            sources=_src(req, 1),
            price_range=None,
            search_keywords_ja="体験ギフト 温泉 スパ エステ",
            experience_kind="onsen_spa",
            tags=["(mock) experience", "flexible"],
        ),
        GiftIdea(
            title="(mock) A small practical everyday item",
            kind="gift",
            category="Practical",
            why="(mock) Third deterministic idea.",
            sources=_src(req, 2),
            price_range=req.budget_label,
            search_keywords_ja="実用 ギフト 軽量",
            experience_kind="none",
            tags=["(mock) everyday"],
        ),
    ][: max(1, min(req.max_ideas, 3))]
    counts = {"notes": 0, "photos": 0, "past_gifts": len(req.member.past_gifts)}
    for e in req.member.evidence:
        if e.kind == "memo":
            counts["notes"] += 1
        elif e.kind in ("media", "post"):
            counts["photos"] += 1
    avoid = req.member.avoid
    insights = (
        [GiftInsight(text=f"(mock) Noticed from shared moments: {req.member.evidence[0].text[:60]}", sources=_src(req, 0))]
        if req.member.evidence
        else []
    )
    return GiftIdeasResponse(
        ideas=ideas,
        insights=insights,
        note_to_giver=(
            f"(mock) Avoid: {'; '.join(avoid)}"
            if avoid
            else "(mock) Nothing to avoid was recorded in the profile or the family's notes."
        ),
        evidence_read=counts,
        model="mock",
        mock=True,
    )


def mock_message(req: MessageRequest) -> MessageResponse:
    name = req.member.display_name
    used = [req.member.evidence[0].id] if req.member.evidence else []
    return MessageResponse(
        variants=[
            MessageVariant(length="short", text=f"(mock) Happy {req.occasion_label}, {name}.", memories_used=used),
            MessageVariant(
                length="standard",
                text=f"(mock) Happy {req.occasion_label}, {name}. Thinking of you today.",
                memories_used=used,
            ),
            MessageVariant(
                length="heartfelt",
                text=f"(mock) Dear {name}, on your {req.occasion_label} we remember the days we shared — thank you for everything.",
                memories_used=used,
            ),
        ],
        model="mock",
        mock=True,
    )


def mock_storyboard(req: StoryboardRequest) -> StoryboardResponse:
    body_budget = max(10, req.target_sec - 8)
    n = max(1, len(req.media))
    per = max(2.5, min(8.0, body_budget / n))
    scenes = [
        StoryboardScene(
            media_id=m.media_id,
            duration_s=round(per, 1),
            caption=f"（モック）シーン{i + 1}",
            reason=f"（モック）{i + 1}番目に置いた理由。",
        )
        for i, m in enumerate(req.media)
    ]
    return StoryboardResponse(
        title=f"（モック）{req.member.display_name}の思い出",
        subtitle="（モック）家族の時間",
        opening="（モック）いつもの景色から、思い出をたどります。",
        closing="（モック）同じ景色に、ありがとうを重ねて。",
        dedication=f"（モック）{req.member.display_name}へ　家族一同より",
        scenes=scenes,
        palette=_MOCK_PALETTES[req.mood],
        music_theme="family",
        model="mock",
        mock=True,
    )


def mock_analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Signal luôn về NGƯỜI ĐĂNG (không phải người được tag) — giống bản thật."""
    signals: list[InterestSignal] = []
    if req.caption:
        signals.append(
            InterestSignal(
                signal_type="like",
                topic=f"(mock) {req.caption[:28]}",
                detail=f"(mock) derived from the caption of {req.post_id}",
                confidence=0.7,
                basis=["caption"],
            )
        )
    if req.images_b64:
        signals.append(
            InterestSignal(
                signal_type="habit",
                topic="(mock) moments worth photographing",
                detail=f"(mock) {len(req.images_b64)} photo(s) in this post",
                confidence=0.45,
                basis=["photo 1"],
            )
        )
    return AnalyzeResponse(
        context_analysis=ContextAnalysis(
            described_event=f"(mock) {req.caption or 'a family moment'}",
            author_role_in_event="ACTOR (mock — no perspective reasoning in mock mode)",
            what_this_reveals_about_author="(mock) the author keeps this kind of moment",
        ),
        description=f"(mock) {req.caption or 'A family photo.'}",
        signals=signals,
        model="mock",
        mock=True,
    )


def mock_rollup(req: RollupRequest) -> RollupResponse:
    """Sáu quy tắc rollup bằng CODE — deterministic, 0 token.

    Gộp theo topic đã chuẩn hoá, cộng confidence kiểu noisy-OR (trần 0.85), đẩy
    signal health sang avoid hard, wish → wishes, gift_idea → gift_ideas_pending,
    giữ nguyên gift_history, cắt còn 12 mục mạnh nhất.
    """
    current = req.current_profile or ProfileJson()
    interests = {i.topic.lower()[:20]: i for i in current.interests}
    avoid = {a.item.lower(): a for a in current.avoid}
    wishes = list(current.wishes)
    pending = list(current.gift_ideas_pending)

    grouped: dict[str, list[RollupSignal]] = {}
    for sg in req.signals:
        if sg.signal_type == "health":
            key = sg.topic.lower()
            avoid[key] = ProfileAvoid(item=sg.topic, reason=f"(mock) {sg.detail} [{sg.id}]", hard=True, overrides=None)
        elif sg.signal_type == "wish":
            wishes.append(ProfileWish(wish=sg.topic, source=sg.id))
        elif sg.signal_type == "gift_idea":
            pending.append(ProfileGiftIdea(idea=sg.topic, occasion="", source=sg.id))
        else:
            grouped.setdefault(sg.topic.lower()[:20], []).append(sg)

    for key, sigs in grouped.items():
        # noisy-OR: nhiều bằng chứng yếu cộng lại vẫn không vượt trần suy-từ-ảnh
        combined = 1.0
        for sg in sigs:
            combined *= 1 - sg.confidence
        confidence = min(0.85, 1 - combined)
        existing = interests.get(key)
        evidence = ([*existing.evidence] if existing else []) + [sg.id for sg in sigs]
        interests[key] = ProfileInterest(
            topic=existing.topic if existing else sigs[0].topic,
            confidence=round(max(confidence, existing.confidence if existing else 0), 2),
            trend="rising" if len(sigs) > 1 else "stable",
            evidence=evidence[-8:],
            first_seen=(existing.first_seen if existing and existing.first_seen else sigs[0].observed_at),
            last_evidence=sigs[-1].observed_at,
            notes=f"(mock) {sigs[-1].detail}"[:120],
        )

    kept = sorted(interests.values(), key=lambda i: i.confidence, reverse=True)[:12]
    return RollupResponse(
        profile=ProfileJson(
            summary=f"(mock) Profile of {req.display_name} — {len(kept)} interests, {len(avoid)} to avoid.",
            interests=kept,
            avoid=list(avoid.values()),
            wishes=wishes,
            gift_ideas_pending=pending,
            gift_history=current.gift_history,
            conversation_topics=current.conversation_topics,
            style_hints=current.style_hints,
        ),
        model="mock",
        mock=True,
    )
