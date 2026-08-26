import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PostService, type FamilyFeed } from './post.service';

/**
 * `GET /me/feed` — dòng thời gian chung của người đang đăng nhập: bài từ MỌI
 * nhà họ thuộc về, gộp và khử trùng, mới nhất trước. Home dùng route này thay
 * cho `/families/:id/posts` (route đó vẫn phục vụ Omoide/Memories theo nhà).
 */
@ApiTags('posts')
@ApiBearerAuth()
@Controller('me/feed')
export class MeFeedController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({
    summary:
      'Posts shared to any family I belong to, newest first, ' +
      'cursor-paginated — the Home timeline across all my families',
  })
  feed(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<FamilyFeed> {
    return this.postService.listMyFeed(user.userId, query);
  }
}
