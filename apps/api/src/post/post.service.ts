import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProfileService } from '../ai/profile.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { FamilyService } from '../family/family.service';
import { PostType, ReactionType } from '../generated/prisma/enums';
import { StorageService } from '../storage/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

export interface PostMediaSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PostDetail {
  id: string;
  authorUserId: string;
  authorName: string;
  type: PostType;
  content: string | null;
  eventDate: Date | null;
  eventTitle: string | null;
  place: string | null;
  familyIds: string[];
  taggedMemberIds: string[];
  media: PostMediaSummary[];
  commentCount: number;
  reactionCount: number;
  /** The viewer's own reaction, null when they have not reacted. */
  myReaction: ReactionType | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyFeed {
  items: PostDetail[];
  /** Pass back as `cursor` for the next page; null = no more posts. */
  nextCursor: string | null;
}

interface PostRecord {
  id: string;
  authorUserId: string;
  type: PostType;
  content: string | null;
  eventDate: Date | null;
  eventTitle: string | null;
  place: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string };
  families: { familyId: string }[];
  memberTags: { memberId: string }[];
  media: PostMediaSummary[];
  /** Filtered to the viewer's own reaction (0 or 1 rows). */
  reactions: { type: ReactionType }[];
  _count: { comments: number; reactions: number };
}

const FEED_DEFAULT_LIMIT = 20;

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly familyService: FamilyService,
    private readonly profiles: ProfileService,
  ) {}

  /** The include every PostDetail read uses — viewer-dependent because it
   *  carries the viewer's own reaction. */
  private detailInclude(userId: string) {
    return {
      author: { select: { name: true } },
      families: { select: { familyId: true } },
      memberTags: { select: { memberId: true } },
      media: {
        select: { id: true, mimeType: true, sizeBytes: true },
        orderBy: { createdAt: 'asc' as const },
      },
      reactions: { where: { userId }, select: { type: true } },
      _count: { select: { comments: true, reactions: true } },
    };
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostDetail> {
    const content = this.normalizeText(dto.content);
    const eventTitle = this.normalizeText(dto.eventTitle);
    const eventDate = dto.eventDate ? this.parseDate(dto.eventDate) : null;
    this.validateEventFields(dto.type, eventTitle, eventDate);

    const mediaIds = dto.mediaIds ?? [];
    // An EVENT is never empty — its title is mandatory (WBS 1.5.4 lists
    // content as optional there).
    if (!content && mediaIds.length === 0 && dto.type !== PostType.EVENT) {
      throw new BadRequestException(
        'A post needs text content or at least one media attachment',
      );
    }

    const familyIds = dto.familyIds ?? [];
    await this.requireMembershipInAll(userId, familyIds);

    const taggedMemberIds = dto.taggedMemberIds ?? [];
    await this.validateTags(userId, taggedMemberIds, familyIds);

    if (mediaIds.length > 0) {
      await this.validateAttachableMedia(userId, mediaIds);
    }

    const postId = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorUserId: userId,
          type: dto.type,
          content,
          eventDate,
          eventTitle,
          place: this.normalizeText(dto.place),
          families: { create: familyIds.map((familyId) => ({ familyId })) },
          memberTags: {
            create: taggedMemberIds.map((memberId) => ({ memberId })),
          },
        },
        select: { id: true },
      });
      if (mediaIds.length > 0) {
        const attached = await tx.media.updateMany({
          where: {
            id: { in: mediaIds },
            uploaderUserId: userId,
            postId: null,
            memoId: null,
            lifeEventId: null,
          },
          data: { postId: post.id },
        });
        if (attached.count !== mediaIds.length) {
          // A concurrent request attached one of these media first;
          // throwing rolls the whole transaction back.
          throw new ConflictException('Some media are no longer attachable');
        }
      }
      return post.id;
    });

    // Đọc bài để hiểu người đăng (0-4 interest signal) — chạy nền, KHÔNG chặn
    // response và không được làm đăng bài thất bại nếu AI hỏng.
    this.profiles.analyzePostInBackground(postId);

    return this.getPost(userId, postId);
  }

  /**
   * Recent posts shared to one family, newest first (WBS 1.2.3). Within a
   * family all shared content is visible to every member (domain-model.md),
   * so membership is the only check — no per-post filtering needed.
   */
  async listFamilyFeed(
    userId: string,
    familyId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<FamilyFeed> {
    await this.familyService.requireMembership(familyId, userId);
    const limit = query.limit ?? FEED_DEFAULT_LIMIT;
    const posts = await this.prisma.post.findMany({
      where: { families: { some: { familyId } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // One extra row tells us whether another page exists.
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: this.detailInclude(userId),
    });
    const page = posts.slice(0, limit);
    return {
      items: page.map((post) => this.toDetail(post)),
      nextCursor: posts.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** Visible to the author and to members of families it is shared to. */
  async getPost(userId: string, postId: string): Promise<PostDetail> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: this.detailInclude(userId),
    });
    // 404 in both cases — do not confirm that private posts exist.
    if (!post || !(await this.canViewPost(userId, post))) {
      throw new NotFoundException('Post not found');
    }
    return this.toDetail(post);
  }

  /**
   * 404 unless the post exists and the viewer may see it — the shared
   * gate for everything hanging off a post (media, comments, reactions).
   * 404 rather than 403 so private posts stay unconfirmable.
   */
  async assertViewable(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorUserId: true,
        families: { select: { familyId: true } },
      },
    });
    if (!post || !(await this.canViewPost(userId, post))) {
      throw new NotFoundException('Post not found');
    }
  }

  async update(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<PostDetail> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorUserId: true,
        type: true,
        content: true,
        eventTitle: true,
        eventDate: true,
        families: { select: { familyId: true } },
        memberTags: { select: { memberId: true } },
        _count: { select: { media: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    // 404 before 403: non-viewers must not learn that a private post
    // exists (same rule as getPost — a 403 here would be an oracle).
    if (!(await this.canViewPost(userId, post))) {
      throw new NotFoundException('Post not found');
    }
    if (post.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can edit a post');
    }

    const nextTitle =
      dto.eventTitle !== undefined
        ? this.normalizeText(dto.eventTitle)
        : post.eventTitle;
    // `undefined` = unchanged; null/'' = clear (rejected below for EVENT).
    // Without the explicit null branch, new Date(null) would silently
    // rewrite the date to 1970-01-01.
    const nextDate =
      dto.eventDate === undefined
        ? post.eventDate
        : dto.eventDate
          ? this.parseDate(dto.eventDate)
          : null;
    this.validateEventFields(post.type, nextTitle, nextDate);

    const nextContent =
      dto.content !== undefined
        ? this.normalizeText(dto.content)
        : post.content;
    if (
      !nextContent &&
      post._count.media === 0 &&
      post.type !== PostType.EVENT
    ) {
      throw new BadRequestException(
        'A post needs text content or at least one media attachment',
      );
    }

    // Membership is re-checked against the visibility that results from
    // this update — including the unchanged stored list: an author who
    // left a family must not keep writing into its feed. Un-sharing
    // (familyIds: []) stays possible for ex-members.
    const effectiveFamilyIds =
      dto.familyIds ?? post.families.map((f) => f.familyId);
    await this.requireMembershipInAll(userId, effectiveFamilyIds);
    const effectiveTagIds =
      dto.taggedMemberIds ?? post.memberTags.map((t) => t.memberId);
    await this.validateTags(userId, effectiveTagIds, effectiveFamilyIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          ...(dto.content !== undefined && { content: nextContent }),
          ...(dto.place !== undefined && {
            place: this.normalizeText(dto.place),
          }),
          ...(dto.eventTitle !== undefined && { eventTitle: nextTitle }),
          ...(dto.eventDate !== undefined && { eventDate: nextDate }),
        },
      });
      if (dto.familyIds) {
        await tx.postFamily.deleteMany({ where: { postId } });
        await tx.postFamily.createMany({
          data: dto.familyIds.map((familyId) => ({ postId, familyId })),
        });
      }
      if (dto.taggedMemberIds) {
        await tx.postMemberTag.deleteMany({ where: { postId } });
        await tx.postMemberTag.createMany({
          data: dto.taggedMemberIds.map((memberId) => ({ postId, memberId })),
        });
      }
    });
    return this.getPost(userId, postId);
  }

  async remove(userId: string, postId: string): Promise<{ success: boolean }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorUserId: true,
        families: { select: { familyId: true } },
        media: { select: { storageKey: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    // 404 before 403 — same privacy rule as getPost/update.
    if (!(await this.canViewPost(userId, post))) {
      throw new NotFoundException('Post not found');
    }
    if (post.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can delete a post');
    }
    // Cascades remove the media/family/tag/comment/reaction rows.
    await this.prisma.post.delete({ where: { id: postId } });
    // Files go best-effort after the DB commit — an orphan file is
    // recoverable noise, a dangling DB row is not.
    await Promise.all(
      post.media.map(async ({ storageKey }) => {
        try {
          await this.storage.remove(storageKey);
        } catch (error) {
          this.logger.warn(
            `Could not delete stored file ${storageKey}: ${String(error)}`,
          );
        }
      }),
    );
    return { success: true };
  }

  /**
   * The one post-visibility rule (docs/02-backend/architecture.md →
   * Authorization): author sees their own; otherwise the viewer needs a
   * membership in a family the post is shared to. Public so MediaService
   * (and future consumers) delegate instead of copying it.
   */
  async canViewPost(
    userId: string,
    post: { authorUserId: string; families: { familyId: string }[] },
  ): Promise<boolean> {
    if (post.authorUserId === userId) {
      return true;
    }
    const familyIds = post.families.map((f) => f.familyId);
    if (familyIds.length === 0) {
      return false; // private post
    }
    const membership = await this.prisma.familyMember.findFirst({
      where: { userId, familyId: { in: familyIds } },
      select: { id: true },
    });
    return membership !== null;
  }

  /** EVENT requires title + date; plain POST must not carry them (WBS 1.5.4). */
  private validateEventFields(
    type: PostType,
    eventTitle: string | null,
    eventDate: Date | null,
  ): void {
    if (type === PostType.EVENT) {
      if (!eventTitle || !eventDate) {
        throw new BadRequestException(
          'An event needs both eventTitle and eventDate',
        );
      }
    } else if (eventTitle || eventDate) {
      throw new BadRequestException(
        'eventTitle and eventDate are only allowed when type = EVENT',
      );
    }
  }

  private async requireMembershipInAll(
    userId: string,
    familyIds: string[],
  ): Promise<void> {
    await this.familyService.requireMembershipInAll(
      userId,
      familyIds,
      'You can only share to families you belong to',
    );
  }

  private async validateTags(
    userId: string,
    taggedMemberIds: string[],
    familyIds: string[],
  ): Promise<void> {
    if (taggedMemberIds.length === 0) {
      return;
    }
    const members = await this.prisma.familyMember.findMany({
      where: { id: { in: taggedMemberIds } },
      select: { id: true, familyId: true },
    });
    if (members.length !== taggedMemberIds.length) {
      throw new NotFoundException('Some tagged members were not found');
    }
    if (familyIds.length > 0) {
      // Everyone who can see the post must be able to see who is tagged.
      const allowed = new Set(familyIds);
      if (members.some((member) => !allowed.has(member.familyId))) {
        throw new BadRequestException(
          'Tagged members must belong to the families the post is shared to',
        );
      }
      return;
    }
    // Private post: tags must still stay within the author's own families.
    const memberFamilyIds = [
      ...new Set(members.map((member) => member.familyId)),
    ];
    const myMemberships = await this.prisma.familyMember.count({
      where: { userId, familyId: { in: memberFamilyIds } },
    });
    if (myMemberships !== memberFamilyIds.length) {
      throw new BadRequestException(
        'You can only tag members of your own families',
      );
    }
  }

  private async validateAttachableMedia(
    userId: string,
    mediaIds: string[],
  ): Promise<void> {
    const attachable = await this.prisma.media.count({
      where: {
        id: { in: mediaIds },
        uploaderUserId: userId,
        postId: null,
        memoId: null,
        lifeEventId: null,
      },
    });
    if (attachable !== mediaIds.length) {
      throw new BadRequestException(
        'Media must be your own uploads and not attached elsewhere',
      );
    }
  }

  private toDetail(post: PostRecord): PostDetail {
    return {
      id: post.id,
      authorUserId: post.authorUserId,
      authorName: post.author.name,
      type: post.type,
      content: post.content,
      eventDate: post.eventDate,
      eventTitle: post.eventTitle,
      place: post.place,
      familyIds: post.families.map((f) => f.familyId),
      taggedMemberIds: post.memberTags.map((t) => t.memberId),
      media: post.media,
      commentCount: post._count.comments,
      reactionCount: post._count.reactions,
      myReaction: post.reactions[0]?.type ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private normalizeText(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  /** @IsISO8601({ strict: true }) guards the format; this guards forms
   *  JS Date cannot parse (week dates, ordinal dates) from becoming an
   *  Invalid Date that Prisma turns into a 500. */
  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('eventDate is not a parsable date');
    }
    return date;
  }
}
