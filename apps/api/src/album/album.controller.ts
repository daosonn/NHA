import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import {
  AlbumService,
  type AlbumDetail,
  type AlbumSummary,
} from './album.service';
import { AddAlbumItemsDto } from './dto/add-album-items.dto';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';

@ApiTags('albums')
@ApiBearerAuth()
@Controller('me/albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Get()
  @ApiOperation({
    summary:
      'My personal albums, most recently touched first (WBS 1.6.7) — ' +
      'always private, never shown on any profile',
  })
  list(@CurrentUser() user: AuthUser): Promise<AlbumSummary[]> {
    return this.albumService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create an album' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAlbumDto,
  ): Promise<AlbumDetail> {
    return this.albumService.create(user.userId, dto);
  }

  @Get(':albumId')
  @ApiOperation({ summary: 'One album with its items' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('albumId', ParseUUIDPipe) albumId: string,
  ): Promise<AlbumDetail> {
    return this.albumService.get(user.userId, albumId);
  }

  @Patch(':albumId')
  @ApiOperation({ summary: 'Rename, redescribe, or set the cover photo' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('albumId', ParseUUIDPipe) albumId: string,
    @Body() dto: UpdateAlbumDto,
  ): Promise<AlbumDetail> {
    return this.albumService.update(user.userId, albumId, dto);
  }

  @Delete(':albumId')
  @ApiOperation({
    summary:
      "Delete the album's organization only — never the underlying media",
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('albumId', ParseUUIDPipe) albumId: string,
  ): Promise<{ success: boolean }> {
    return this.albumService.remove(user.userId, albumId);
  }

  @Post(':albumId/items')
  @ApiOperation({
    summary:
      'Add your own media to the album (a post photo or a standalone ' +
      'upload) — screen 11 "choose album"',
  })
  addItems(
    @CurrentUser() user: AuthUser,
    @Param('albumId', ParseUUIDPipe) albumId: string,
    @Body() dto: AddAlbumItemsDto,
  ): Promise<AlbumDetail> {
    return this.albumService.addItems(user.userId, albumId, dto);
  }

  @Delete(':albumId/items/:mediaId')
  @ApiOperation({
    summary: 'Remove one item from the album (the media itself is untouched)',
  })
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('albumId', ParseUUIDPipe) albumId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<{ success: boolean }> {
    return this.albumService.removeItem(user.userId, albumId, mediaId);
  }
}
