import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { SuggestionRequestDto } from './dto/suggestion-request.dto';
import {
  SuggestionService,
  type SuggestionEnvelope,
} from './suggestion.service';

/**
 * The app's only door to AI (docs/03-ai/architecture.md § 1): the Expo
 * client never calls FastAPI or a provider itself. Each route answers
 * `503 { code: 'AI_UNAVAILABLE' }` when the AI service is off or
 * unreachable, and the screens degrade rather than break.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly suggestionService: SuggestionService) {}

  // A suggestion request creates nothing — it is a read expressed as a
  // POST because the context does not fit in a query string.
  @Post('gifts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gift ideas for a family member (WBS 2.4.3) — at least 3 by default, ' +
      'each carrying why and source',
  })
  gifts(
    @CurrentUser() user: AuthUser,
    @Body() dto: SuggestionRequestDto,
  ): Promise<SuggestionEnvelope> {
    return this.suggestionService.suggest(user.userId, 'gifts', dto);
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Message suggestions for a person and occasion (WBS 2.5.2) — ' +
      'regenerate is the same call again',
  })
  messages(
    @CurrentUser() user: AuthUser,
    @Body() dto: SuggestionRequestDto,
  ): Promise<SuggestionEnvelope> {
    return this.suggestionService.suggest(user.userId, 'messages', dto);
  }

  @Post('quality-time')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Activity plans to spend time with a member (WBS 2.6.3) — each ' +
      'suggestion carries its steps; saving one is WBS 2.6.4',
  })
  qualityTime(
    @CurrentUser() user: AuthUser,
    @Body() dto: SuggestionRequestDto,
  ): Promise<SuggestionEnvelope> {
    return this.suggestionService.suggest(user.userId, 'quality-time', dto);
  }
}
