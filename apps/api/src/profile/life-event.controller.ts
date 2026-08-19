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
import { CreateLifeEventDto } from './dto/create-life-event.dto';
import { UpdateLifeEventDto } from './dto/update-life-event.dto';
import { LifeEventService, type LifeEventDetail } from './life-event.service';

@ApiTags('life-events')
@ApiBearerAuth()
@Controller('me/life-events')
export class MeLifeEventController {
  constructor(private readonly lifeEventService: LifeEventService) {}

  @Get()
  @ApiOperation({
    summary: 'My own life timeline, oldest first (WBS 1.6.8)',
  })
  list(@CurrentUser() user: AuthUser): Promise<LifeEventDetail[]> {
    return this.lifeEventService.listOwn(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a milestone to my own timeline' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    return this.lifeEventService.createOwn(user.userId, dto);
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Edit a milestone on my own timeline' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    return this.lifeEventService.updateOwn(user.userId, eventId, dto);
  }

  @Delete(':eventId')
  @ApiOperation({ summary: 'Remove a milestone and its media files' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<{ success: boolean }> {
    return this.lifeEventService.removeOwn(user.userId, eventId);
  }
}

@ApiTags('life-events')
@ApiBearerAuth()
@Controller('families/:familyId/members/:memberId/life-events')
export class MemberLifeEventController {
  constructor(private readonly lifeEventService: LifeEventService) {}

  @Get()
  @ApiOperation({
    summary:
      "A member's life timeline as seen inside one family — linked member " +
      'shows their global timeline, placeholder its family-local one',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<LifeEventDetail[]> {
    return this.lifeEventService.listForMember(user.userId, familyId, memberId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Add a milestone — wiki-editable for placeholders, owner-only for ' +
      'linked members',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateLifeEventDto,
  ): Promise<LifeEventDetail> {
    return this.lifeEventService.createForMember(
      user.userId,
      familyId,
      memberId,
      dto,
    );
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Edit a milestone (same wiki rule as create)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateLifeEventDto,
  ): Promise<LifeEventDetail> {
    return this.lifeEventService.updateForMember(
      user.userId,
      familyId,
      memberId,
      eventId,
      dto,
    );
  }

  @Delete(':eventId')
  @ApiOperation({ summary: 'Remove a milestone (same wiki rule as create)' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<{ success: boolean }> {
    return this.lifeEventService.removeForMember(
      user.userId,
      familyId,
      memberId,
      eventId,
    );
  }
}
