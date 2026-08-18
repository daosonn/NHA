import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { UpcomingQueryDto } from './dto/upcoming-query.dto';
import {
  SpecialDateService,
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
}
