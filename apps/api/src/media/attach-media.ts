import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/**
 * The one home of the Media one-parent rule's write side (schema.prisma
 * names the invariant: at most one of postId/memoId/lifeEventId, CHECK in
 * the migration). Extracted 2026-08-19 when MemoService would have become
 * the third copy. Plain functions taking a client/tx — no DI, so post,
 * profile and memo modules can all use them without module edges into
 * MediaModule (which already imports PostModule and ProfileModule).
 */

/** A media row nothing owns yet, uploaded by this user. */
const attachableWhere = (userId: string, mediaIds: string[]) => ({
  id: { in: mediaIds },
  uploaderUserId: userId,
  postId: null,
  memoId: null,
  lifeEventId: null,
});

type Db = PrismaClient | Prisma.TransactionClient;

/** Pre-flight 400 for a friendlier message; the transactional attach below
 *  is the check that actually holds under concurrency. */
export async function assertAttachableMedia(
  db: Db,
  userId: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) {
    return;
  }
  const attachable = await db.media.count({
    where: attachableWhere(userId, mediaIds),
  });
  if (attachable !== mediaIds.length) {
    throw new BadRequestException(
      'Media must be your own uploads and not attached elsewhere',
    );
  }
}

/**
 * Attaches media to exactly one parent inside the caller's transaction.
 * A count mismatch means a concurrent request attached one of these media
 * first; the ConflictException rolls the caller's transaction back.
 */
export async function attachMediaInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  mediaIds: string[],
  parent: { postId: string } | { memoId: string } | { lifeEventId: string },
): Promise<void> {
  if (mediaIds.length === 0) {
    return;
  }
  const attached = await tx.media.updateMany({
    where: attachableWhere(userId, mediaIds),
    data: parent,
  });
  if (attached.count !== mediaIds.length) {
    throw new ConflictException('Some media are no longer attachable');
  }
}
