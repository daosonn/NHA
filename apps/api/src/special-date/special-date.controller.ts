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
import { UpcomingQueryDto } from './dto/upcoming-query.dto';
import { UpdateSpecialDateDto } from './dto/update-special-date.dto';
import {
  SpecialDateService,
  type SpecialDateDetail,
  type UpcomingSpecialDates,
} from './special-date.service';

@ApiTags('special-dates')
@ApiBearerAuth()
@Controller('families/:familyId/special-dates')
export class SpecialDateController {
  constructor(private readonly specialDateService: SpecialDateService) {}

  @Get()
  @ApiOperation({
    summary:
      'Upcoming occasions for the family-home widgets, soonest first — birthdays/memorials derived from LifeProfile dates plus stored custom occasions (WBS 1.2.5)',
  })
  upcoming(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Query() query: UpcomingQueryDto,
  ): Promise<UpcomingSpecialDates> {
    return this.specialDateService.listUpcoming(user.userId, familyId, query);
  }

  @Get('custom')
  @ApiOperation({
    summary:
      'The stored rows with their ids, calendar order — what the ' +
      'management side of screen 17 edits (WBS 3.2.3). Derived ' +
      'birthdays/memorials are not here: edit those on the profile.',
  })
  listCustom(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ): Promise<SpecialDateDetail[]> {
    return this.specialDateService.listCustom(user.userId, familyId);
  }

  @Get(':specialDateId')
  @ApiOperation({
    summary:
      'One stored row with computed nextOccurrence/daysUntil — 404 when ' +
      'the row lives in another family (or is personal)',
  })
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.getOne(user.userId, familyId, specialDateId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a custom occasion (WBS 3.2.3) — any family member may; ' +
      'solar or lunar, yearly or one-off, per-date reminder lead',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: CreateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.create(user.userId, familyId, dto);
  }

  @Patch(':specialDateId')
  @ApiOperation({
    summary:
      'Edit a custom occasion — partial; memberIds replaces the list, ' +
      'originYear: null clears the ordinal',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
    @Body() dto: UpdateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    return this.specialDateService.update(
      user.userId,
      familyId,
      specialDateId,
      dto,
    );
  }

  @Delete(':specialDateId')
  @ApiOperation({
    summary:
      'Delete a custom occasion — the widget forgets it; derived ' +
      'birthdays/memorials are untouched',
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('specialDateId', ParseUUIDPipe) specialDateId: string,
  ): Promise<{ success: boolean }> {
    return this.specialDateService.remove(user.userId, familyId, specialDateId);
  }
}
