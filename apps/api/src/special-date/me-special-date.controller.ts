import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateSpecialDateDto } from './dto/create-special-date.dto';
import { MeUpcomingQueryDto } from './dto/me-upcoming-query.dto';
import { UpdateSpecialDateDto } from './dto/update-special-date.dto';
import {
  SpecialDateService,
  type SpecialDateDetail,
  type UpcomingSpecialDates,
} from './special-date.service';

/**
 * "Dates we keep" (mockup 12a–12d): the aggregate feed across every family
 * the caller belongs to, plus CRUD for their personal ("Only me") rows.
 * Family rows keep their CRUD under /families/:id/special-dates — this
 * controller never edits those.
 */
@ApiTags('special-dates')
@ApiBearerAuth()
@Controller('me/special-dates')
export class MeSpecialDateController {
  constructor(private readonly specialDateService: SpecialDateService) {}

  @Get()
  @ApiOperation({
    summary:
      'Every upcoming date the caller can see — derived + custom across ' +
      'all their families, plus their personal rows; soonest first. ' +
      'Filter with ?familyId= or ?scope=FAMILY|PERSONAL (the 12b chips).',
  })
  upcoming(
    @CurrentUser() user: AuthUser,
    @Query() query: MeUpcomingQueryDto,
  ): Promise<UpcomingSpecialDates> {
    return this.specialDateService.listUpcomingForUser(user.userId, query);
  }

  // 'custom' MUST be declared before ':specialDateId' — Nest matches in
  // declaration order and the UUID pipe would 400 the literal otherwise.
  @Get('custom')
  @ApiOperation({
    summary: "The caller's personal rows with ids, calendar order.",
  })
  listCustom(@CurrentUser() user: AuthUser): Promise<SpecialDateDetail[]> {
    return this.specialDateService.listCustomPersonal(user.userId);
  }

  @Get(':specialDateId')
  @ApiOperation({
    summary:
      "One personal row — 404 for anyone but the owner (a personal date's " +
      'existence is private, the same rule memos follow).',
  })
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.getPersonal(user.userId, specialDateId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create an "Only me" date — reminders go to the owner alone; linked ' +
      "members may come from any of the caller's families.",
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.createPersonal(user.userId, dto);
  }

  @Patch(':specialDateId')
  @ApiOperation({ summary: 'Edit a personal row — owner only, partial.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
    @Body() dto: UpdateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.updatePersonal(
      user.userId,
      specialDateId,
      dto,
    );
  }

  @Delete(':specialDateId')
  @ApiOperation({ summary: 'Delete a personal row — owner only.' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
  ): Promise<{ success: boolean }> {
    return this.specialDateService.removePersonal(user.userId, specialDateId);
  }
}
