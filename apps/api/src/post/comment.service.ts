import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { CommentBodyDto } from './dto/comment-body.dto';
import { PostService } from './post.service';

export interface CommentSummary {
  id: string;
  postId: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentList {
  items: CommentSummary[];
  /** Pass back as `cursor` for the next page; null = no more comments. */
  nextCursor: string | null;
}

const COMMENT_DEFAULT_LIMIT = 20;

const commentInclude = {
  author: { select: { name: true } },
};

interface CommentRecord {
  id: string;
  postId: string;
  authorUserId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string };
}

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postService: PostService,
  ) {}

  /** Anyone who can view the post can comment (family-visible content). */
  async create(
    userId: string,
    postId: string,
    dto: CommentBodyDto,
  ): Promise<CommentSummary> {
    await this.postService.assertViewable(userId, postId);
    const comment = await this.prisma.comment.create({
      data: { postId, authorUserId: userId, content: dto.content.trim() },
      include: commentInclude,
    });
    return this.toSummary(comment);
  }

  /** Oldest first — a comment thread reads top-down. */
  async list(
    userId: string,
    postId: string,
    query: { limit?: number; cursor?: string },
  ): Promise<CommentList> {
    await this.postService.assertViewable(userId, postId);
    const limit = query.limit ?? COMMENT_DEFAULT_LIMIT;
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      // One extra row tells us whether another page exists.
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: commentInclude,
    });
    const page = comments.slice(0, limit);
    return {
      items: page.map((comment) => this.toSummary(comment)),
      nextCursor: comments.length > limit ? page[page.length - 1].id : null,
    };
  }

  async update(
    userId: string,
    postId: string,
    commentId: string,
    dto: CommentBodyDto,
  ): Promise<CommentSummary> {
    const comment = await this.findVisibleComment(userId, postId, commentId);
    if (comment.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can edit a comment');
    }
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
      include: commentInclude,
    });
    return this.toSummary(updated);
  }

  /**
   * Comment author only for MVP. Post-author moderation ("delete a
   * comment on my post") is an open product call — not invented here.
   */
  async remove(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<{ success: boolean }> {
    const comment = await this.findVisibleComment(userId, postId, commentId);
    if (comment.authorUserId !== userId) {
      throw new ForbiddenException('Only the author can delete a comment');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { success: true };
  }

  private async findVisibleComment(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<{ authorUserId: string }> {
    await this.postService.assertViewable(userId, postId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
      select: { authorUserId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private toSummary(comment: CommentRecord): CommentSummary {
    return {
      id: comment.id,
      postId: comment.postId,
      authorUserId: comment.authorUserId,
      authorName: comment.author.name,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
