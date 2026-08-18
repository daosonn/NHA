import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { SetReactionDto } from './dto/set-reaction.dto';
import { ReactionService, type ReactionState } from './reaction.service';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts/:postId/reactions')
export class ReactionController {
  constructor(private readonly reactionService: ReactionService) {}

  @Put('me')
  @ApiOperation({
    summary: 'Set or change your reaction — one per user per post (WBS 1.5.7)',
  })
  set(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: SetReactionDto,
  ): Promise<ReactionState> {
    return this.reactionService.set(user.userId, postId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('me')
  @ApiOperation({ summary: 'Remove your reaction (idempotent)' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ReactionState> {
    return this.reactionService.remove(user.userId, postId);
  }
}
