import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeText, requireTrimmed } from '../common/input';
import { PrismaService } from '../database/prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AddAlbumItemsDto } from './dto/add-album-items.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

export interface AlbumItemDetail {
  mediaId: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: Date;
}

export interface AlbumSummary {
  id: string;
  name: string;
  description: string | null;
  coverMediaId: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlbumDetail extends AlbumSummary {
  items: AlbumItemDetail[];
}

const itemInclude = {
  media: { select: { id: true, mimeType: true, sizeBytes: true } },
} as const;

type AlbumWithItems = Prisma.AlbumGetPayload<{
  include: { items: { include: typeof itemInclude } };
}>;

/**
 * Personal albums (database.md § Album + AlbumItem, task 1.6.7, decided
 * 2026-08-14): user-curated, **always private** — never shown on the
 * profile (that's the derived gallery, `gallery/`, a different thing).
 * No screen has been built for this yet (screens.md #11 only sketches a
 * "choose album" step inside Post a Moment); this ships from the spec,
 * not a UI to match.
 */
@Injectable()
export class AlbumService {
  constructor(private readonly prisma: PrismaService) {}

  /** Most recently touched first — the album you're adding to today is
   *  the one being looked for (same convention as memos). */
  async list(userId: string): Promise<AlbumSummary[]> {
    const albums = await this.prisma.album.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: { select: { items: true } },
        // Ảnh mới nhất, để làm bìa DỰ PHÒNG khi người dùng chưa tự chọn bìa —
        // album có ảnh mà ô lại hiện icon xám thì trông như rỗng/hỏng (Sơn
        // 27/08). Có bìa tự chọn thì tôn trọng nó.
        items: {
          orderBy: { addedAt: 'desc' },
          take: 1,
          select: { mediaId: true },
        },
      },
    });
    return albums.map((album) => ({
      id: album.id,
      name: album.name,
      description: album.description,
      coverMediaId: album.coverMediaId ?? album.items[0]?.mediaId ?? null,
      itemCount: album._count.items,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    }));
  }

  async create(userId: string, dto: CreateAlbumDto): Promise<AlbumDetail> {
    const name = requireTrimmed(dto.name, 'An album needs a name');
    const album = await this.prisma.album.create({
      data: {
        ownerUserId: userId,
        name,
        description: normalizeText(dto.description),
      },
      include: { items: { include: itemInclude } },
    });
    return this.toDetail(album);
  }

  async get(userId: string, albumId: string): Promise<AlbumDetail> {
    const album = await this.findOwn(userId, albumId);
    return this.toDetail(album);
  }

  async update(
    userId: string,
    albumId: string,
    dto: UpdateAlbumDto,
  ): Promise<AlbumDetail> {
    const existing = await this.findOwn(userId, albumId);
    if (dto.name !== undefined) {
      requireTrimmed(dto.name, 'An album needs a name');
    }
    if (dto.coverMediaId) {
      const isOwnItem = existing.items.some(
        (item) => item.mediaId === dto.coverMediaId,
      );
      if (!isOwnItem) {
        throw new BadRequestException(
          "coverMediaId must be one of the album's own items",
        );
      }
    }

    const data: Prisma.AlbumUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && {
        description: normalizeText(dto.description),
      }),
      ...(dto.coverMediaId !== undefined && {
        coverMedia: dto.coverMediaId
          ? { connect: { id: dto.coverMediaId } }
          : { disconnect: true },
      }),
    };
    if (Object.keys(data).length === 0) {
      return this.toDetail(existing);
    }
    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data,
      include: { items: { include: itemInclude } },
    });
    return this.toDetail(updated);
  }

  /** Deletes the album's organization only — cascades `AlbumItem` rows,
   *  never the underlying `Media` (still owned by its post/memo/life-event
   *  or standing alone; an album is one more index onto it, not a home). */
  async remove(userId: string, albumId: string): Promise<{ success: boolean }> {
    const deleted = await this.prisma.album.deleteMany({
      where: { id: albumId, ownerUserId: userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Album not found');
    }
    return { success: true };
  }

  /**
   * Add your own media to the album (database.md content rule: only media
   * you uploaded — a post's photo or a standalone upload; no cross-owner
   * references). Already-attached media is fine: an album is a second,
   * independent index, not another exclusive parent like `attach-media.ts`
   * enforces for posts/memos/life-events. Re-adding an item already in the
   * album is a no-op, not a 409 — the caller is selecting photos, not
   * asserting a new fact.
   */
  async addItems(
    userId: string,
    albumId: string,
    dto: AddAlbumItemsDto,
  ): Promise<AlbumDetail> {
    await this.findOwn(userId, albumId);
    const ownedCount = await this.prisma.media.count({
      where: { id: { in: dto.mediaIds }, uploaderUserId: userId },
    });
    if (ownedCount !== dto.mediaIds.length) {
      throw new BadRequestException('Media must be your own uploads');
    }
    await this.prisma.albumItem.createMany({
      data: dto.mediaIds.map((mediaId) => ({ albumId, mediaId })),
      skipDuplicates: true,
    });
    return this.get(userId, albumId);
  }

  /** Idempotent — removing an item not in the album is still a success
   *  (same convention as the reaction endpoints). Clears the cover if the
   *  removed item was it, so `coverMediaId` never points outside the
   *  album's current items. */
  async removeItem(
    userId: string,
    albumId: string,
    mediaId: string,
  ): Promise<{ success: boolean }> {
    const album = await this.findOwn(userId, albumId);
    await this.prisma.$transaction([
      this.prisma.albumItem.deleteMany({ where: { albumId, mediaId } }),
      ...(album.coverMediaId === mediaId
        ? [
            this.prisma.album.update({
              where: { id: albumId },
              data: { coverMedia: { disconnect: true } },
            }),
          ]
        : []),
    ]);
    return { success: true };
  }

  /** 404 for anything that is not the caller's own album — existence is
   *  private, same as a memo. */
  private async findOwn(
    userId: string,
    albumId: string,
  ): Promise<AlbumWithItems> {
    const album = await this.prisma.album.findFirst({
      where: { id: albumId, ownerUserId: userId },
      include: { items: { include: itemInclude } },
    });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  private toDetail(album: AlbumWithItems): AlbumDetail {
    return {
      id: album.id,
      name: album.name,
      description: album.description,
      coverMediaId: album.coverMediaId,
      itemCount: album.items.length,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
      items: [...album.items]
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
        .map((item) => ({
          mediaId: item.mediaId,
          mimeType: item.media.mimeType,
          sizeBytes: item.media.sizeBytes,
          addedAt: item.addedAt,
        })),
    };
  }
}
