import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import {
  CommentService,
  type CommentList,
  type CommentSummary,
} from './comment.service';
import { CommentBodyDto } from './dto/comment-body.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts/:postId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @ApiOperation({ summary: 'Comment on a post you can view (WBS 1.5.6)' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentSummary> {
    return this.commentService.create(user.userId, postId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Comments on a post, oldest first, cursor-paginated',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CommentList> {
    return this.commentService.list(user.userId, postId, query);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Edit your own comment' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentSummary> {
    return this.commentService.update(user.userId, postId, commentId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':commentId')
  @ApiOperation({ summary: 'Delete your own comment' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<{ success: boolean }> {
    return this.commentService.remove(user.userId, postId, commentId);
  }
}
