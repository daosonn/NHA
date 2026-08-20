import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { ReactionType } from '../generated/prisma/enums';
import { NotificationEventsService } from '../notification/notification-events.service';
import { SetReactionDto } from './dto/set-reaction.dto';
import { PostService } from './post.service';

export interface ReactionState {
  /** The viewer's reaction after the call; null = none. */
  myReaction: ReactionType | null;
  reactionCount: number;
}

@Injectable()
export class ReactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postService: PostService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  /** One reaction per user per post; setting again changes the type. */
  async set(
    userId: string,
    postId: string,
    dto: SetReactionDto,
  ): Promise<ReactionState> {
    await this.postService.assertViewable(userId, postId);
    // Only a *first* reaction is news. Changing LIKE to LOVE and back
    // would otherwise notify the author once per tap.
    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { userId: true },
    });
    await this.prisma.reaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, type: dto.type },
      update: { type: dto.type },
    });
    if (!existing) {
      this.notificationEvents.reactionSet(postId, userId);
    }
    return this.state(postId, dto.type);
  }

  /** Idempotent: removing a reaction that is not there still succeeds. */
  async remove(userId: string, postId: string): Promise<ReactionState> {
    await this.postService.assertViewable(userId, postId);
    await this.prisma.reaction.deleteMany({ where: { postId, userId } });
    return this.state(postId, null);
  }

  private async state(
    postId: string,
    myReaction: ReactionType | null,
  ): Promise<ReactionState> {
    const reactionCount = await this.prisma.reaction.count({
      where: { postId },
    });
    return { myReaction, reactionCount };
  }
}
