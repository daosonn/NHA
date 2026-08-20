/**
 * Wire contract cho khu AI (màn 21-33) — derive từ apps/api:
 * `src/ai/*` (gift/message) và `src/video/*` (video jobs). Không import từ server.
 */

// ---------------------------------------------------------------- gifts (màn 21-23)

export type GiftSource = { evidence_id: string; label: string };

export type ShopProduct = {
  name: string;
  price: number;
  url: string;
  image: string | null;
  review_rate: number | null;
  review_count: number | null;
  store: string | null;
  score: number;
};

/** Vì sao ra/không ra sản phẩm — UI hiện thành badge nhỏ, để giá lệch ngân sách có lời giải thích */
export type ResolveInfo = {
  keyword_ja: string;
  price_min: number;
  price_max: number;
  fetched: number;
  kept: number;
  dropped_by_avoid: number;
  cached: boolean;
  relaxed: string | null;
  attempts: string[];
  error: string | null;
};

export type GiftIdeaResult = {
  title: string;
  kind: 'gift' | 'together';
  category: string;
  why: string;
  sources: GiftSource[];
  price_range: string | null;
  /** từ khoá tra sàn Nhật — hiện dưới danh sách sản phẩm để người dùng tự tìm thêm */
  search_keywords_ja: string;
  experience_kind: string;
  tags: string[];
  /** sản phẩm THẬT từ sàn (Yahoo JP) — rỗng khi không tra được → UI hiện nút link tìm kiếm */
  products: ShopProduct[];
  resolve: ResolveInfo | null;
};

export type SavedGiftIdea = {
  id: string;
  title: string;
  why: string | null;
  price_range: string | null;
  saved_at: string;
};

export type GiftInsight = {
  text: string;
  sources: GiftSource[];
};

export type GiftIdeasResponse = {
  ideas: GiftIdeaResult[];
  /** khối "What we noticed" (11b) — quan sát nền, hiện trước các ý tưởng */
  insights: GiftInsight[];
  note_to_giver: string | null;
  evidence_read: { notes?: number; photos?: number; past_gifts?: number };
  model: string;
  mock: boolean;
  saved_ideas: SavedGiftIdea[];
  shops_enabled: boolean;
  /** cả lượt lấy từ cache (0 token) */
  cached: boolean;
  /** version hồ sơ đã chưng cất dùng để sinh gợi ý này */
  profile_version: number;
};

/** Màn 23 (11d): một nguồn AI đã trích, đã lần về dữ liệu thật */
export type EvidenceRef = {
  ref: string;
  kind: 'signal' | 'memo' | 'post' | 'unknown';
  text: string | null;
  author_name: string | null;
  created_at: string | null;
  post_id: string | null;
  media_id: string | null;
  topic: string | null;
};

/** Màn 21 (11a): "12 photos and 4 notes about her · shared since January" */
export type EvidenceStats = {
  notes: number;
  photos: number;
  past_gifts: number;
  since: string | null;
};

export type AiLocale = 'en' | 'ja' | 'vi';

export type GiftIdeasRequest = {
  occasionLabel: string;
  occasionDate?: string;
  budgetLabel?: string;
  locale?: AiLocale;
  maxIdeas?: number;
  /** nút ↻ — bỏ qua cache, hỏi AI lại từ đầu */
  force?: boolean;
};

// ---------------------------------------------------------------- message (màn 24-25)

export type MessageVariant = {
  length: 'short' | 'standard' | 'heartfelt';
  text: string;
  memories_used: string[];
};

export type MessageResponse = {
  variants: MessageVariant[];
  model: string;
  mock: boolean;
};

export type MessageRequest = {
  occasionLabel: string;
  extraNote?: string;
  tone?: 'warm' | 'formal' | 'playful';
  locale?: 'en' | 'ja' | 'vi';
};

// ---------------------------------------------------------------- video (màn 27-33)

export type VideoMood = 'warm' | 'nostalgic' | 'playful' | 'quiet';
export type VideoStyleId = 'album' | 'cinema' | 'film' | 'letter' | 'seasonal' | 'polaroid' | 'none';
export type VideoTargetSec = 30 | 60 | 90 | 120 | 180;

export type StoryboardScene = { media_id: string; duration_s: number; caption: string; reason: string };

export type StoryboardResponse = {
  title: string;
  subtitle: string;
  opening: string;
  closing: string;
  dedication: string;
  scenes: StoryboardScene[];
  palette: Record<string, string>;
  music_theme: string;
  model: string;
  mock: boolean;
};

export type StoryboardRequest = {
  memberId: string;
  mediaIds: string[];
  storyRequest?: string;
  kind?: 'year' | 'trip' | 'birthday' | 'memory';
  /** nhãn dịp hiển thị — có thể là dịp user tự đặt qua nút "+" (màn 27) */
  kindLabel?: string;
  targetSec?: VideoTargetSec;
  mood?: VideoMood;
  locale?: 'en' | 'ja' | 'vi';
};

export type VideoPlanScene = { mediaId: string; durationS: number; caption: string; reason?: string };

export type VideoPlan = {
  title: string;
  subtitle?: string;
  opening?: string;
  closing?: string;
  dedication?: string;
  scenes: VideoPlanScene[];
  palette?: Record<string, string>;
};

export type CreateVideoJobRequest = {
  memberId?: string;
  mediaIds: string[];
  mode: 'ai' | 'quick';
  plan?: VideoPlan;
  targetSec?: VideoTargetSec;
  mood?: VideoMood;
  aspect?: 'portrait' | 'landscape';
  style?: VideoStyleId;
  musicId?: string;
};

export type VideoJob = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  mode: string;
  title: string | null;
  progress: number;
  stage: string | null;
  duration_s: number | null;
  error: string | null;
  created_at: string;
  has_file: boolean;
  plan: (VideoPlan & { scenes: { mediaId: string; kind: 'image' | 'video'; durationS: number; caption: string; reason?: string }[] }) | null;
  options: {
    targetSec: number;
    mood: string;
    aspect: 'portrait' | 'landscape';
    style: VideoStyleId;
    musicId: string;
    locale: string;
  } | null;
};

// ---------------------------------------------------------------- special dates (hub "Coming up")

export type SpecialDateItem = {
  source: 'DERIVED' | 'CUSTOM';
  type: 'BIRTHDAY' | 'ANNIVERSARY' | 'MEMORIAL' | 'CUSTOM';
  /** CUSTOM có title; DERIVED client tự ghép nhãn từ type + tên thành viên */
  title: string | null;
  month: number;
  day: number;
  originYear: number | null;
  /** số năm tại lần tới ("turns 70", "30 years") — null khi không rõ năm gốc */
  ordinal: number | null;
  theme: string;
  nextOccurrence: string; // ISO YYYY-MM-DD
  daysUntil: number;
  members: { memberId: string; displayName: string }[];
};

export type UpcomingSpecialDates = { items: SpecialDateItem[] };

export type MusicCatalog = {
  themes: {
    id: string;
    emoji: string;
    name: string;
    name_ja: string;
    occasion_keys: string[];
    tracks: {
      id: string;
      title: string;
      lang: string;
      duration_s: number;
      attribution: string | null;
      license: string;
      source_url: string;
      bpm: number | null;
    }[];
  }[];
};
