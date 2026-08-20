import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP client duy nhất tới AI service (apps/ai — FastAPI).
 * Kiến trúc (CLAUDE.md §3): mobile → NestJS → FastAPI → provider; mobile KHÔNG bao giờ
 * gọi provider trực tiếp, và NestJS là nơi duy nhất giữ authorization.
 * Node 24 có fetch native — không thêm dependency HTTP nào.
 */

export interface AiEvidenceItem {
  id: string;
  kind: 'memo' | 'post' | 'media' | 'gift_history' | 'interest';
  text: string;
  author_name?: string | null;
  created_at?: string | null;
}

/**
 * Hồ sơ đã CHƯNG CẤT của một người (bảng MemberProfile, do rollup viết lại).
 * Đây là thứ làm AI "hiểu" người nhận thay vì đọc lại toàn bộ bài đăng mỗi lần.
 */
export interface AiProfileJson {
  summary: string;
  interests: {
    topic: string;
    confidence: number;
    /** rising | stable | fading — mật độ bằng chứng gần đây so với trước */
    trend: string;
    evidence: string[];
    first_seen: string | null;
    last_evidence: string | null;
    notes: string;
  }[];
  avoid: {
    item: string;
    reason: string;
    hard: boolean;
    overrides: string | null;
  }[];
  wishes: { wish: string; source: string }[];
  gift_ideas_pending: { idea: string; occasion: string; source: string }[];
  gift_history: { date: string; gift: string; reaction: string }[];
  conversation_topics: { topic: string; notes: string }[];
  style_hints: { description: string };
}

export interface AiMemberContext {
  member_id: string;
  display_name: string;
  role_label?: string | null;
  birth_date?: string | null;
  interests: string[];
  avoid: string[];
  evidence: AiEvidenceItem[];
  past_gifts: string[];
  /** null khi người này chưa từng được rollup — AI chỉ còn evidence thô để dựa vào */
  profile?: AiProfileJson | null;
  profile_version?: number;
}

export interface GiftIdeaDto {
  title: string;
  kind: 'gift' | 'together';
  category: string;
  why: string;
  /** FastAPI chỉ trả evidence_id; `label` do AiService dựng từ dữ liệu thật (0 token) */
  sources: { evidence_id: string; label?: string }[];
  price_range: string | null;
  /** từ khoá tra sàn Nhật — nguồn duy nhất để tìm SẢN PHẨM THẬT */
  search_keywords_ja: string;
  /** 'none' | dining | onsen_spa | travel_stay | craft_workshop | photo | general */
  experience_kind: string;
  tags: string[];
}

export interface GiftInsightDto {
  text: string;
  sources: { evidence_id: string; label?: string }[];
}

export interface GiftIdeasResult {
  ideas: GiftIdeaDto[];
  /** khối "What we noticed" (màn 22 · 11b) — quan sát nền, hiện trước các ý tưởng */
  insights: GiftInsightDto[];
  note_to_giver: string | null;
  evidence_read: Record<string, number>;
  model: string;
  mock: boolean;
}

export interface MessageVariantDto {
  length: 'short' | 'standard' | 'heartfelt';
  text: string;
  memories_used: string[];
}

export interface MessageResult {
  variants: MessageVariantDto[];
  model: string;
  mock: boolean;
}

export interface StoryboardSceneDto {
  media_id: string;
  duration_s: number;
  caption: string;
  /** vì sao cảnh đặt ở vị trí này — màn 31 (11j) hiện dưới mỗi scene */
  reason: string;
}

export interface StoryboardResult {
  title: string;
  subtitle: string;
  opening: string;
  closing: string;
  dedication: string;
  scenes: StoryboardSceneDto[];
  palette: Record<string, string>;
  music_theme: string;
  model: string;
  mock: boolean;
}

export interface AnalyzeResult {
  context_analysis: {
    described_event: string;
    author_role_in_event: string;
    what_this_reveals_about_author: string;
  };
  description: string;
  signals: {
    signal_type: 'like' | 'dislike' | 'wish' | 'habit' | 'health' | 'milestone';
    topic: string;
    detail: string;
    confidence: number;
    basis: string[];
  }[];
  model: string;
  mock: boolean;
}

@Injectable()
export class AiClientService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('AI_SERVICE_URL') ?? 'http://127.0.0.1:8000';
    this.token = config.get<string>('AI_INTERNAL_TOKEN') ?? '';
  }

  async health(): Promise<{ ok: boolean; mock: boolean; has_key: boolean }> {
    return this.request('GET', '/health');
  }

  async giftIdeas(body: {
    member: AiMemberContext;
    occasion_label: string;
    occasion_date?: string | null;
    giver_name?: string | null;
    giver_relation?: string | null;
    budget_label?: string | null;
    locale?: string;
    max_ideas?: number;
    saved_ideas?: string[];
  }): Promise<GiftIdeasResult> {
    return this.request('POST', '/v1/gift-ideas', body);
  }

  async messageSuggestions(body: {
    member: AiMemberContext;
    occasion_label: string;
    giver_name?: string | null;
    giver_relation?: string | null;
    tone?: 'warm' | 'formal' | 'playful';
    locale?: string;
  }): Promise<MessageResult> {
    return this.request('POST', '/v1/message-suggestions', body);
  }

  /** Tầng 1: bài đăng → interest signal VỀ TÁC GIẢ (1 call, nhiều ảnh) */
  async analyzePost(body: {
    post_id: string;
    caption?: string | null;
    author_name?: string | null;
    author_role?: string | null;
    author_relations?: string[];
    tagged?: {
      label: string;
      display_name: string;
      relation_to_author?: string | null;
    }[];
    taken_at?: string | null;
    place?: string | null;
    transcript?: string | null;
    images_b64?: string[];
    locale?: string;
  }): Promise<AnalyzeResult> {
    return this.request('POST', '/v1/analyze-post', body);
  }

  /** Tầng 2: signal chưa xử lý + profile hiện tại → profile mới (viết lại toàn bộ) */
  async profileRollup(body: {
    display_name: string;
    role_label?: string | null;
    birth_date?: string | null;
    relations?: string[];
    today: string;
    current_version?: number;
    current_profile?: AiProfileJson | null;
    signals: {
      id: string;
      source_type: string;
      source_id?: string | null;
      signal_type: string;
      topic: string;
      detail: string;
      confidence: number;
      observed_at: string;
    }[];
    locale?: string;
  }): Promise<{ profile: AiProfileJson; model: string; mock: boolean }> {
    return this.request('POST', '/v1/profile-rollup', body);
  }

  async videoStoryboard(body: {
    member: AiMemberContext;
    title_hint?: string | null;
    kind_label?: string | null;
    media: {
      media_id: string;
      kind: 'image' | 'video';
      caption?: string | null;
      taken_at?: string | null;
      duration_s?: number | null;
    }[];
    target_sec?: 30 | 60 | 90 | 120 | 180;
    mood?: 'warm' | 'nostalgic' | 'playful' | 'quiet';
    locale?: string;
  }): Promise<StoryboardResult> {
    return this.request('POST', '/v1/video-storyboard', body);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    let rsp: Response;
    try {
      rsp = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { 'x-internal-token': this.token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // Nguyên tắc sản phẩm: core phải sống khi AI chết — lỗi rõ ràng, không crash chuỗi khác
      throw new ServiceUnavailableException(
        'AI service is not reachable — start apps/ai (uvicorn) or set AI_SERVICE_URL',
      );
    }
    if (!rsp.ok) {
      const detail = await rsp.text().catch(() => '');
      throw new ServiceUnavailableException(
        `AI service error ${rsp.status}: ${detail.slice(0, 300)}`,
      );
    }
    return (await rsp.json()) as T;
  }
}
