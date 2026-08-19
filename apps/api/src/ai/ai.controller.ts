import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AiService, type EvidenceStats, type GiftIdeasView, type MessageView, type SavedGiftIdea } from './ai.service';
import { CardService } from './card.service';
import { ProfileService } from './profile.service';
import { CardRenderDto } from './dto/card.dto';
import { GiftIdeasRequestDto, SaveGiftIdeaDto } from './dto/gift-ideas.dto';
import { MessageRequestDto } from './dto/message.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly cardService: CardService,
    private readonly profileService: ProfileService,
  ) {}

  @Get('families/:familyId/members/:memberId/profile-understanding')
  @ApiOperation({
    summary:
      'What the app has learned about this person: the distilled profile (interests with confidence/trend, things to avoid, wishes) plus how many signals are still unmerged',
  })
  profileUnderstanding(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.profileService.profileFor(user.userId, familyId, memberId);
  }

  @Get('families/:familyId/members/:memberId/evidence')
  @ApiOperation({
    summary:
      'Screen 23 — follow a source the AI cited (sig_… / memo_… / post_…) back to the real note or post, with its photo',
  })
  evidence(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Query('refs') refs: string,
  ) {
    const list = (refs ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    return this.profileService.resolveEvidence(user.userId, familyId, memberId, list);
  }

  @Post('families/:familyId/members/:memberId/profile-rollup')
  @ApiOperation({ summary: 'Merge every pending signal about this person into a new profile version (1 AI call)' })
  async rollup(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.aiService.assertMember(user.userId, familyId);
    return this.profileService.rollupMember(memberId);
  }

  @Post('posts/:postId/analyze')
  @ApiOperation({
    summary:
      'Read one post for durable facts about its AUTHOR (0–4 interest signals). Runs automatically when a post is created; this is the manual re-run.',
  })
  async analyzePost(@CurrentUser() user: AuthUser, @Param('postId', ParseUUIDPipe) postId: string) {
    await this.aiService.assertPostAuthor(user.userId, postId);
    return this.profileService.analyzePost(postId);
  }

  @Post('families/:familyId/cards')
  @ApiOperation({
    summary:
      'Screen 26 — render a greeting card PNG server-side (5 designs, 0 tokens); returns a media id to view or attach to a post',
  })
  renderCard(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: CardRenderDto,
  ): Promise<{ media_id: string }> {
    return this.cardService.render(user.userId, familyId, dto);
  }

  @Public()
  @Get('ai/health')
  @ApiOperation({ summary: 'AI service reachability + mock mode (core app must keep working when this is down)' })
  health(): Promise<{ ok: boolean; mock: boolean; has_key: boolean }> {
    return this.aiService.health();
  }

  @Post('families/:familyId/members/:memberId/gift-ideas')
  @ApiOperation({
    summary:
      'Screen 21→22 — gift ideas grounded in family notes/photos, with provenance, hard-avoid warning and saved-idea history',
  })
  giftIdeas(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: GiftIdeasRequestDto,
  ): Promise<GiftIdeasView> {
    return this.aiService.giftIdeas(user.userId, familyId, memberId, dto);
  }

  @Post('families/:familyId/members/:memberId/gift-ideas/save')
  @ApiOperation({ summary: 'Screen 22 — Save one idea ("Two ideas you saved last year", never re-suggested)' })
  saveGiftIdea(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SaveGiftIdeaDto,
  ): Promise<SavedGiftIdea> {
    return this.aiService.saveGiftIdea(user.userId, familyId, memberId, dto);
  }

  @Get('families/:familyId/members/:memberId/evidence-stats')
  @ApiOperation({ summary: 'Screen 21 — "12 photos and 4 notes about her · shared since January" (0 tokens, before asking AI)' })
  evidenceStats(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<EvidenceStats> {
    return this.aiService.evidenceStats(user.userId, familyId, memberId);
  }

  @Get('families/:familyId/members/:memberId/gift-ideas/saved')
  @ApiOperation({ summary: 'Screen 21 — ideas you saved before (shown under the Ask form)' })
  savedGiftIdeas(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<SavedGiftIdea[]> {
    return this.aiService.savedGiftIdeas(user.userId, familyId, memberId);
  }

  @Post('families/:familyId/members/:memberId/message-suggestions')
  @ApiOperation({ summary: 'Screens 24-25 — three message variants (short/standard/heartfelt), regenerate with a tone' })
  message(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: MessageRequestDto,
  ): Promise<MessageView> {
    return this.aiService.messageSuggestions(user.userId, familyId, memberId, dto);
  }
}
