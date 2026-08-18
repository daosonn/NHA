import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService, type ProfileDetail } from './profile.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('families/:familyId/members/:memberId/profile')
export class MemberProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({
    summary:
      'A member’s Life Profile — linked member shows their global profile, placeholder shows the family wiki profile (screen 8)',
  })
  get(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<ProfileDetail> {
    return this.profileService.getForMember(user.userId, familyId, memberId);
  }

  @Patch()
  @ApiOperation({
    summary:
      'Edit a placeholder profile (wiki — any family member) or your own linked profile; every edit is logged to EditHistory',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    return this.profileService.updateForMember(
      user.userId,
      familyId,
      memberId,
      dto,
    );
  }
}
