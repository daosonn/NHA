import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import type { JoinFamilyResult } from './family.service';
import {
  InvitationService,
  type InvitationPreview,
  type InvitationSummary,
} from './invitation.service';

@ApiTags('invitations')
@ApiBearerAuth()
@Controller('families/:familyId/invitations')
export class FamilyInvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @ApiOperation({
    summary:
      'Invite a person to a reserved tree spot — creates the placeholder, ' +
      'its relationship edge and the invitation in one step',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationSummary> {
    return this.invitationService.create(user.userId, familyId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "The family's invitations, newest first (pending banner)",
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ): Promise<InvitationSummary[]> {
    return this.invitationService.list(user.userId, familyId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':invitationId/resend')
  @ApiOperation({ summary: 'Extend an outstanding invitation by a week' })
  resend(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<InvitationSummary> {
    return this.invitationService.resend(user.userId, familyId, invitationId);
  }

  @Delete(':invitationId')
  @ApiOperation({
    summary:
      'Cancel an invitation — an untouched reserved spot falls back to Empty',
  })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<{ success: boolean; memberRemoved: boolean }> {
    return this.invitationService.cancel(user.userId, familyId, invitationId);
  }
}

/** Follows the `me/memos` convention: one controller per "mine" resource. */
@ApiTags('invitations')
@ApiBearerAuth()
@Controller('me/invitations')
export class MyInvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  @ApiOperation({
    summary:
      'Invitations addressed to me and still live — what the in-app ' +
      'FAMILY_INVITE notification links to',
  })
  listMine(@CurrentUser() user: AuthUser): Promise<InvitationSummary[]> {
    return this.invitationService.listMine(user.userId);
  }
}

@ApiTags('invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Public()
  @Get(':code')
  @ApiOperation({
    summary:
      'Public preview of a live invitation — who invited you, as what, ' +
      'and where you land (invite page, no account needed)',
  })
  preview(@Param('code') code: string): Promise<InvitationPreview> {
    return this.invitationService.preview(code);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post(':code/accept')
  @ApiOperation({
    summary: 'Accept an invitation — joins the family on the reserved spot',
  })
  accept(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
  ): Promise<JoinFamilyResult> {
    return this.invitationService.accept(user.userId, code);
  }
}
