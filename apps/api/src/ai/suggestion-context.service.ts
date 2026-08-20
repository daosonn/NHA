import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { GalleryService } from '../gallery/gallery.service';
import { MemoService } from '../memo/memo.service';
import { PostService } from '../post/post.service';
import { LifeEventService } from '../profile/life-event.service';
import { ProfileService } from '../profile/profile.service';

/**
 * Ceilings on how much evidence travels to the AI service. They exist so
 * one long-lived profile cannot grow the request without bound; the
 * counts in the envelope report what was actually sent, never the size of
 * the corpus it came from, so a capped bundle never overstates itself.
 */
const MAX_LIFE_EVENTS = 20;
const MAX_MEMOS = 30;
const MAX_RECENT_POSTS = 20;
const MAX_PHOTO_INSIGHTS = 50;
/** How far back through the subject's gallery we look for analysed photos. */
const INSIGHT_SCAN_LIMIT = 200;

/** Who the suggestion is about — names and dates, never ids. */
export interface SuggestionSubject {
  name: string;
  bio: string | null;
  birthDate: string | null;
  /** Set for a deceased member: a memorial is not a birthday. */
  deathDate: string | null;
  interests: string[];
  lifeEvents: { title: string; date: string; place: string | null }[];
}

export interface SuggestionEvidence {
  memos: {
    title: string;
    content: string | null;
    category: string | null;
    updatedAt: string;
  }[];
  recentPosts: {
    author: string;
    content: string | null;
    place: string | null;
    createdAt: string;
  }[];
  photoInsights: {
    /** The AI team owns this shape — NestJS stores and returns it whole. */
    insight: unknown;
    model: string;
    photoDate: string;
  }[];
  counts: EvidenceCounts;
}

/** Stated before the ideas, not after (decision 2026-08-18). */
export interface EvidenceCounts {
  notes: number;
  photos: number;
  posts: number;
  lifeEvents: number;
}

export interface SuggestionContext {
  subject: SuggestionSubject;
  evidence: SuggestionEvidence;
}

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Phase 2 of the pipeline (docs/03-ai/architecture.md): everything the AI
 * service is allowed to read about one member, assembled from Postgres by
 * NestJS. FastAPI is stateless and never queries the database, so this is
 * the only place the boundary is drawn.
 *
 * Two rules are enforced here rather than trusted downstream:
 *
 * 1. **Only the requester's own memos.** Memos are private to their
 *    author; `MemoService.list` filters on `ownerUserId`, so another
 *    member's private notes cannot reach the model.
 * 2. **The anti-laundering rule.** Photo insights are reached through
 *    `GalleryService`, which returns only media the requester may
 *    actually see. An insight derived from a photo they cannot open
 *    therefore never enters their bundle — the hidden store cannot leak
 *    content across a family or privacy boundary.
 *
 * Every gatherer below independently enforces family membership, so the
 * subject cannot be read by a stranger through any one of them.
 */
@Injectable()
export class SuggestionContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly lifeEventService: LifeEventService,
    private readonly memoService: MemoService,
    private readonly postService: PostService,
    private readonly galleryService: GalleryService,
  ) {}

  async gather(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<SuggestionContext> {
    const [profile, lifeEvents, memos, feed, photoInsights] = await Promise.all(
      [
        this.profileService.getForMember(userId, familyId, memberId),
        this.lifeEventService.listForMember(userId, familyId, memberId),
        this.memoService.list(userId, familyId, memberId),
        this.postService.listFamilyFeed(userId, familyId, {
          memberId,
          limit: MAX_RECENT_POSTS,
        }),
        this.gatherPhotoInsights(userId, familyId, memberId),
      ],
    );

    // Timeline is oldest first; the recent end of a life is what a gift or
    // a message is usually reacting to, so the tail is what survives the cap.
    const events = lifeEvents.slice(-MAX_LIFE_EVENTS).map((event) => ({
      title: event.title,
      date: event.eventDate.toISOString().slice(0, 10),
      place: event.place,
    }));
    const notes = memos.slice(0, MAX_MEMOS).map((memo) => ({
      title: memo.title,
      content: memo.content,
      category: memo.category,
      updatedAt: memo.updatedAt.toISOString(),
    }));
    const recentPosts = feed.items.map((post) => ({
      author: post.authorName,
      content: post.content,
      place: post.place,
      createdAt: post.createdAt.toISOString(),
    }));

    return {
      subject: {
        name: profile.displayName,
        bio: profile.bio,
        birthDate: toDateOnly(profile.birthDate),
        deathDate: toDateOnly(profile.deathDate),
        interests: profile.interests,
        lifeEvents: events,
      },
      evidence: {
        memos: notes,
        recentPosts,
        photoInsights,
        counts: {
          notes: notes.length,
          photos: photoInsights.length,
          posts: recentPosts.length,
          lifeEvents: events.length,
        },
      },
    };
  }

  /**
   * Phase-1 facts about the subject's photos, filtered by the requester's
   * own view of them. The gallery is the filter: it already answers "the
   * media of this member's posts and milestones that this viewer may
   * see", so the visibility rule lives in one place instead of being
   * re-derived here. Photos with no insight yet simply contribute
   * nothing — analysis runs in the background and may not have reached
   * them (or may not be running at all).
   */
  private async gatherPhotoInsights(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<SuggestionEvidence['photoInsights']> {
    const gallery = await this.galleryService.listForMember(
      userId,
      familyId,
      memberId,
    );
    const photoIds = gallery
      .filter((item) => item.mimeType.startsWith('image/'))
      .slice(0, INSIGHT_SCAN_LIMIT)
      .map((item) => item.id);
    if (photoIds.length === 0) {
      return [];
    }
    const insights = await this.prisma.mediaInsight.findMany({
      where: { mediaId: { in: photoIds } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_PHOTO_INSIGHTS,
      select: {
        insight: true,
        model: true,
        media: { select: { createdAt: true } },
      },
    });
    return insights.map((row) => ({
      insight: row.insight,
      model: row.model,
      photoDate: row.media.createdAt.toISOString(),
    }));
  }
}
