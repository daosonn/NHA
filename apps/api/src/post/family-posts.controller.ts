import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PostService, type FamilyFeed } from './post.service';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('families/:familyId/posts')
export class FamilyPostsController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({
    summary:
      'Posts shared to this family, newest first, cursor-paginated ' +
      '(WBS 1.2.3). Optional Memories filters (WBS 2.1.2): ?memberId, ' +
      '?from/?to (YYYY-MM-DD, posted date), ?type',
  })
  feed(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Query() query: FeedQueryDto,
  ): Promise<FamilyFeed> {
    return this.postService.listFamilyFeed(user.userId, familyId, query);
  }
}
