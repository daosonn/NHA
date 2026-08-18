import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService, type ProfileDetail } from './profile.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('me/profile')
export class MeProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'My global Life Profile — shown in every family (WBS 1.6.2)',
  })
  get(@CurrentUser() user: AuthUser): Promise<ProfileDetail> {
    return this.profileService.getOwn(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my Life Profile (bio, interests, dates)' })
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    return this.profileService.updateOwn(user.userId, dto);
  }
}
