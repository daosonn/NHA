import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';

/**
 * One tile in the derived gallery. Exactly one of `postId`/`lifeEventId`
 * is set — the same one-parent shape `Media` itself uses — so a tap can
 * open the moment or milestone it came from (same idea as Omoide's
 * `PhotoTile`, `features/omoide/group-photos.ts`).
 */
export interface GalleryMediaItem {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  postId: string | null;
  lifeEventId: string | null;
}

/**
 * Profile gallery — the Album tab (screen 8, task 1.6.4). **Derived, not
 * stored** (database.md § Profile gallery): the media of posts authored
 * by or tagged with the member, plus their life-event media, filtered to
 * what the viewer may actually see. This is a different thing from the
 * `Album` model (screen 11, task 1.6.7) — that one is a private,
 * user-curated collection with its own table.
 *
 * Not paginated: unlike the family feed (shared, high-volume, task 1.2.3),
 * this is one person's own history — the same "return everything" choice
 * already made for their life-event timeline.
 */
@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  /** The caller's own gallery (Profile tab — works with no family). */
  async listOwn(userId: string): Promise<GalleryMediaItem[]> {
    const profile = await this.profileService.ensureGlobalProfile(userId);
    return this.listForProfile(userId, profile);
  }

  /** A member's gallery inside one family — same profile resolution as
   *  the rest of the Life Profile (linked → global, placeholder → local).
   *  Read-only: nothing here is created directly, so no wiki-edit rule. */
  async listForMember(
    userId: string,
    familyId: string,
    memberId: string,
  ): Promise<GalleryMediaItem[]> {
    const { profile } = await this.profileService.resolveForMember(
      userId,
      familyId,
      memberId,
    );
    return this.listForProfile(userId, profile);
  }

  private async listForProfile(
    viewerId: string,
    profile: { id: string; userId: string | null; memberId: string | null },
  ): Promise<GalleryMediaItem[]> {
    // The identities a post can be "about" this profile through: the
    // account itself (authorUserId, global) and every FamilyMember row
    // that account holds — one per family it has joined — since a tag is
    // always recorded against a family-scoped member id. A placeholder
    // has exactly one such row: itself.
    const taggableMemberIds = profile.userId
      ? (
          await this.prisma.familyMember.findMany({
            where: { userId: profile.userId },
            select: { id: true },
          })
        ).map((member) => member.id)
      : profile.memberId
        ? [profile.memberId]
        : [];

    const posts = await this.prisma.post.findMany({
      where: {
        OR: [
          ...(profile.userId ? [{ authorUserId: profile.userId }] : []),
          ...(taggableMemberIds.length > 0
            ? [
                {
                  memberTags: { some: { memberId: { in: taggableMemberIds } } },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        authorUserId: true,
        families: { select: { familyId: true } },
        media: {
          select: {
            id: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
    // The same gate every other reader of a post goes through
    // (PostService.canViewPost's three conditions — author, private,
    // shared-family membership), batched into one membership query
    // instead of one canViewPost call per post.
    const candidateFamilyIds = [
      ...new Set(posts.flatMap((post) => post.families.map((f) => f.familyId))),
    ];
    const viewerFamilyIds =
      candidateFamilyIds.length > 0
        ? new Set(
            (
              await this.prisma.familyMember.findMany({
                where: {
                  userId: viewerId,
                  familyId: { in: candidateFamilyIds },
                },
                select: { familyId: true },
              })
            ).map((member) => member.familyId),
          )
        : new Set<string>();
    const postItems: GalleryMediaItem[] = posts
      .filter(
        (post) =>
          post.authorUserId === viewerId ||
          post.families.some((f) => viewerFamilyIds.has(f.familyId)),
      )
      .flatMap((post) =>
        post.media.map((media) => ({
          ...media,
          postId: post.id,
          lifeEventId: null,
        })),
      );

    // LifeEvent belongs to this exact profile, and reaching this method at
    // all already proves the viewer may see the profile's content (self,
    // or a family shared with them via resolveForMember) — the same rule
    // MediaService applies per download (ProfileService.canViewProfileContent).
    const lifeEvents = await this.prisma.lifeEvent.findMany({
      where: { profileId: profile.id },
      select: {
        id: true,
        media: {
          select: {
            id: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
    const eventItems: GalleryMediaItem[] = lifeEvents.flatMap((event) =>
      event.media.map((media) => ({
        ...media,
        postId: null,
        lifeEventId: event.id,
      })),
    );

    return [...postItems, ...eventItems].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
