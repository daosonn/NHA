"""Hợp đồng dữ liệu của AI service — NestJS là client duy nhất.

Nguyên tắc bắt buộc (docs/project-status.md + design màn 27-33):
- MỌI suggestion phải mang provenance: `why` + `sources[]` trỏ về dữ liệu thật (memo/post/media id).
- Không bịa kỷ niệm: chi tiết cụ thể chỉ được lấy từ context mà NestJS gửi sang.
- Service này KHÔNG đọc DB — NestJS gom context (authorization ở NestJS) rồi gửi kèm request.
"""

from typing import Literal

from pydantic import BaseModel, Field

# ---------- context chung do NestJS gom từ DB ----------


class EvidenceItem(BaseModel):
    """Một mẩu bằng chứng thật: memo, caption bài đăng, hoặc media đã phân tích."""

    id: str
    kind: Literal["memo", "post", "media", "gift_history", "interest"]
    text: str
    author_name: str | None = None
    created_at: str | None = None  # ISO


class ProfileInterest(BaseModel):
    topic: str
    confidence: float = 0.5
    trend: str = "stable"  # rising | stable | fading
    evidence: list[str] = Field(default_factory=list)
    first_seen: str | None = None
    last_evidence: str | None = None
    notes: str = ""


class ProfileAvoid(BaseModel):
    item: str
    reason: str = ""
    hard: bool = True  # hard=True là ràng buộc TUYỆT ĐỐI (thường là sức khoẻ)
    overrides: str | None = None


class ProfileWish(BaseModel):
    wish: str
    source: str = ""


class ProfileGiftIdea(BaseModel):
    idea: str
    occasion: str = ""
    source: str = ""


class ProfileGiftHistory(BaseModel):
    date: str
    gift: str
    reaction: str = ""


class ProfileTopic(BaseModel):
    topic: str
    notes: str = ""


class ProfileStyleHints(BaseModel):
    description: str = ""


class ProfileJson(BaseModel):
    """Bản chưng cất ~1k token về một người — NestJS đọc từ bảng MemberProfile.

    Đây là thứ khiến gợi ý "hiểu" người nhận: interests có confidence/trend, kiêng
    kỵ có hard, điều ước, ý tưởng đang chờ, lịch sử quà. Signal thô nằm ở DB, không
    gửi sang đây — profile chính là bản đã gộp.

    Mọi field con là model TƯỜNG MINH (không dict tự do): OpenAI strict mode từ chối
    additionalProperties, đã dính một lần ở palette storyboard.
    """

    summary: str = ""
    interests: list[ProfileInterest] = Field(default_factory=list)
    avoid: list[ProfileAvoid] = Field(default_factory=list)
    wishes: list[ProfileWish] = Field(default_factory=list)
    gift_ideas_pending: list[ProfileGiftIdea] = Field(default_factory=list)
    gift_history: list[ProfileGiftHistory] = Field(default_factory=list)
    conversation_topics: list[ProfileTopic] = Field(default_factory=list)
    style_hints: ProfileStyleHints = Field(default_factory=ProfileStyleHints)


class MemberContext(BaseModel):
    member_id: str
    display_name: str
    role_label: str | None = None  # "grandmother", "dad"…
    birth_date: str | None = None
    interests: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)  # kiêng kỵ cứng — tuyệt đối không vi phạm
    evidence: list[EvidenceItem] = Field(default_factory=list)
    past_gifts: list[str] = Field(default_factory=list)
    # Hồ sơ đã chưng cất (None = người này chưa từng rollup)
    profile: ProfileJson | None = None
    profile_version: int = 0


# ---------- /v1/gift-ideas (màn 28 · 9b) ----------


class GiftIdeasRequest(BaseModel):
    member: MemberContext
    occasion_label: str
    occasion_date: str | None = None
    giver_name: str | None = None
    giver_relation: str | None = None  # "granddaughter"…
    budget_label: str | None = None  # "3.000〜8.000円"
    locale: Literal["en", "ja", "vi"] = "en"
    max_ideas: int = 5
    # Ý tưởng gia đình đã lưu (♡) — prompt yêu cầu đưa lên đầu, không phải loại bỏ.
    saved_ideas: list[str] = Field(default_factory=list)


class GiftSource(BaseModel):
    # CHỈ evidence_id — nhãn hiển thị ("From Lan's note · 2 weeks ago") do NestJS
    # dựng từ dữ liệu thật (0 token). Bắt model soạn nhãn là ~50-120 output token
    # mỗi lượt gift, tức ~0.5-1s người dùng ngồi chờ chỉ để viết chữ code viết được.
    evidence_id: str


ExperienceKind = Literal["none", "dining", "onsen_spa", "travel_stay", "craft_workshop", "photo", "general"]


class GiftIdea(BaseModel):
    title: str
    kind: Literal["gift", "together"]  # vật phẩm | trải nghiệm cùng nhau (design 11b có "Together")
    category: str  # chip: "Hobbies", "Practical", "In his taste"…
    why: str  # 1-2 câu, PHẢI tham chiếu bằng chứng thật
    sources: list[GiftSource]
    price_range: str | None = None
    # Từ khoá tra sàn Nhật. Không có bản tiếng Việt: NHA chỉ tra Yahoo!ショッピング,
    # bắt model viết thêm một trường không ai đọc chỉ làm người dùng chờ lâu hơn.
    search_keywords_ja: str = ""
    # Quà trải nghiệm ở Nhật bán dưới dạng catalog 体験ギフト → tra được sản phẩm thật.
    experience_kind: ExperienceKind = "none"
    tags: list[str] = Field(default_factory=list)


class GiftInsight(BaseModel):
    """Quan sát nền tảng — UI 11b hiện khối "What we noticed" TRƯỚC các ý tưởng."""

    text: str  # "Most mornings in the garden — crouching has hurt her back since April."
    sources: list[GiftSource] = Field(default_factory=list)


class GiftIdeasResponse(BaseModel):
    ideas: list[GiftIdea]
    insights: list[GiftInsight] = Field(default_factory=list)  # khối "What we noticed" (11b)
    note_to_giver: str | None = None  # cảnh báo kiêng kỵ — UI hiện khối "Worth knowing"
    evidence_read: dict[str, int]  # {"notes": 12, "photos": 248, "past_gifts": 3} — hiện TRƯỚC ý tưởng
    model: str
    mock: bool


# ---------- /v1/message-suggestions (sprint 2.5) ----------


class MessageRequest(BaseModel):
    member: MemberContext
    occasion_label: str
    giver_name: str | None = None
    giver_relation: str | None = None
    tone: Literal["warm", "formal", "playful"] = "warm"
    locale: Literal["en", "ja", "vi"] = "en"


class MessageVariant(BaseModel):
    length: Literal["short", "standard", "heartfelt"]
    text: str
    memories_used: list[str] = Field(default_factory=list)  # evidence ids đã dùng


class MessageResponse(BaseModel):
    variants: list[MessageVariant]
    model: str
    mock: bool


# ---------- /v1/video-storyboard (màn 29 · 9c) ----------


class MediaMeta(BaseModel):
    media_id: str
    kind: Literal["image", "video"]
    caption: str | None = None
    taken_at: str | None = None
    duration_s: float | None = None


class StoryboardRequest(BaseModel):
    member: MemberContext
    title_hint: str | None = None  # "Dad's 60 years"
    kind_label: str | None = None  # "A year together" | dịp user tự đặt ở nút "+"
    media: list[MediaMeta]
    target_sec: Literal[30, 60, 90, 120, 180] = 90
    mood: Literal["warm", "nostalgic", "playful", "quiet"] = "warm"
    locale: Literal["en", "ja", "vi"] = "en"


class StoryboardScene(BaseModel):
    media_id: str
    duration_s: float
    caption: str = ""
    reason: str = ""  # 1 câu vì sao cảnh đặt ở đây — UI 11j hiện dưới mỗi scene


class StoryboardResponse(BaseModel):
    title: str
    subtitle: str = ""
    opening: str = ""
    closing: str = ""
    dedication: str = ""
    scenes: list[StoryboardScene]
    palette: dict[str, str]  # primary/secondary/accent/text_on_dark — hex
    music_theme: Literal["birthday", "family", "nostalgia", "gentle", "wafu"] = "family"
    model: str
    mock: bool


# ---------- /v1/analyze-post (tầng 1: sinh interest signal) ----------


class TaggedPerson(BaseModel):
    """Người được tag, kèm quan hệ TỚI NGƯỜI ĐĂNG — chìa khoá phân giải xưng hô."""

    label: str  # "A", "B"… — không bao giờ gửi model tự đoán ai là ai trong ảnh
    display_name: str
    relation_to_author: str | None = None  # "her son", "CHÍNH LÀ NGƯỜI ĐĂNG"


class AnalyzeRequest(BaseModel):
    post_id: str
    caption: str | None = None
    author_name: str | None = None
    author_role: str | None = None
    # Quan hệ của người đăng với các thành viên khác, để giải nghĩa "mẹ", "bà"…
    author_relations: list[str] = Field(default_factory=list)
    tagged: list[TaggedPerson] = Field(default_factory=list)
    taken_at: str | None = None
    place: str | None = None
    transcript: str | None = None  # tiếng nói trong clip (nếu có)
    images_b64: list[str] = Field(default_factory=list)  # NestJS gửi bytes đã authorize
    locale: Literal["en", "ja", "vi"] = "en"


class ContextAnalysis(BaseModel):
    """Bắt buộc điền TRƯỚC signal — ép model phân giải ngôi/vai trước khi suy diễn."""

    described_event: str
    author_role_in_event: str
    what_this_reveals_about_author: str


class InterestSignal(BaseModel):
    signal_type: Literal["like", "dislike", "wish", "habit", "health", "milestone"]
    topic: str
    detail: str
    confidence: float = Field(ge=0, le=1)
    basis: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    context_analysis: ContextAnalysis
    description: str
    signals: list[InterestSignal]
    model: str
    mock: bool


# ---------- /v1/profile-rollup (tầng 2: chưng cất signal → profile) ----------


class RollupSignal(BaseModel):
    id: str
    source_type: str
    source_id: str | None = None
    signal_type: str
    topic: str
    detail: str
    confidence: float
    observed_at: str


class RollupRequest(BaseModel):
    display_name: str
    role_label: str | None = None
    birth_date: str | None = None
    relations: list[str] = Field(default_factory=list)
    today: str
    current_version: int = 0
    current_profile: ProfileJson | None = None
    signals: list[RollupSignal] = Field(default_factory=list)
    locale: Literal["en", "ja", "vi"] = "en"


class RollupResponse(BaseModel):
    profile: ProfileJson
    model: str
    mock: bool
