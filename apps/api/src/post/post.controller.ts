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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService, type PostDetail } from './post.service';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a post or event, shared to chosen families or private (WBS 1.5.2/1.5.4/1.5.5)',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostDetail> {
    return this.postService.create(user.userId, dto);
  }

  @Get(':postId')
  @ApiOperation({
    summary: 'Post detail — author or member of a family it is shared to',
  })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<PostDetail> {
    return this.postService.getPost(user.userId, postId);
  }

  @Patch(':postId')
  @ApiOperation({
    summary:
      'Edit a post — content, event fields, visibility, tags (WBS 1.5.2)',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostDetail> {
    return this.postService.update(user.userId, postId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':postId')
  @ApiOperation({
    summary: 'Delete a post and its attached media files (WBS 1.5.2)',
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<{ success: boolean }> {
    return this.postService.remove(user.userId, postId);
  }
}
