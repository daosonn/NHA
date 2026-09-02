import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AddMemberDto } from './dto/add-member.dto';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { JoinFamilyDto } from './dto/join-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  FamilyService,
  type FamilyDetail,
  type FamilyMemberSummary,
  type FamilySummary,
  type FamilyTree,
  type JoinFamilyResult,
  type RelationshipSummary,
} from './family.service';

@ApiTags('families')
@ApiBearerAuth()
@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a family with an invite code (WBS 1.3.3)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFamilyDto,
  ): Promise<FamilyDetail> {
    return this.familyService.createFamily(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the families I belong to' })
  list(@CurrentUser() user: AuthUser): Promise<FamilySummary[]> {
    return this.familyService.listMyFamilies(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('join')
  @ApiOperation({
    summary:
      'Join a family via invite code, optionally linking to a placeholder member',
  })
  join(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinFamilyDto,
  ): Promise<JoinFamilyResult> {
    return this.familyService.join(user.userId, dto);
  }

  @Get(':familyId')
  @ApiOperation({ summary: 'Family detail with its members' })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ): Promise<FamilyDetail> {
    return this.familyService.getFamily(user.userId, familyId);
  }

  @Patch(':familyId')
  @ApiOperation({
    summary:
      'Edit the family (mockup 13b) — name, address, about, cover photo. ' +
      'Any member may (wiki rule); the cover must be an image from a post ' +
      'shared to this family, or one the setter uploaded. null clears a ' +
      'nullable field.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: UpdateFamilyDto,
  ): Promise<{
    id: string;
    name: string;
    coverMediaId: string | null;
    address: string | null;
    about: string | null;
  }> {
    if (
      dto.name === undefined &&
      dto.address === undefined &&
      dto.about === undefined &&
      dto.coverMediaId === undefined
    ) {
      // {} không được lặng lẽ coi là "xong" — cũng không được gỡ gì.
      throw new BadRequestException('Nothing to update');
    }
    return this.familyService.update(user.userId, familyId, dto);
  }

  @Get(':familyId/tree')
  @ApiOperation({
    summary: 'Family tree data — member nodes + relationship edges (WBS 1.4.1)',
  })
  tree(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ): Promise<FamilyTree> {
    return this.familyService.getTree(user.userId, familyId);
  }

  @Post(':familyId/members')
  @ApiOperation({ summary: 'Add a placeholder member (WBS 1.3.4)' })
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: AddMemberDto,
  ): Promise<FamilyMemberSummary> {
    return this.familyService.addMember(user.userId, familyId, dto);
  }

  @Patch(':familyId/members/:memberId')
  @ApiOperation({ summary: 'Edit a member (WBS 1.3.6)' })
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<FamilyMemberSummary> {
    return this.familyService.updateMember(
      user.userId,
      familyId,
      memberId,
      dto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':familyId')
  @ApiOperation({
    summary:
      'Delete a family you created (only while no other account is a member). Posts stay with their authors.',
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ): Promise<{ success: boolean }> {
    return this.familyService.remove(user.userId, familyId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':familyId/members/:memberId')
  @ApiOperation({ summary: 'Remove a member / leave the family (WBS 1.3.6)' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<{ success: boolean }> {
    return this.familyService.removeMember(user.userId, familyId, memberId);
  }

  @Post(':familyId/relationships')
  @ApiOperation({ summary: 'Set a relationship between members (WBS 1.3.5)' })
  addRelationship(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: CreateRelationshipDto,
  ): Promise<RelationshipSummary> {
    return this.familyService.addRelationship(user.userId, familyId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':familyId/relationships/:relationshipId')
  @ApiOperation({ summary: 'Remove a relationship (WBS 1.3.5)' })
  removeRelationship(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('relationshipId', ParseUUIDPipe) relationshipId: string,
  ): Promise<{ success: boolean }> {
    return this.familyService.removeRelationship(
      user.userId,
      familyId,
      relationshipId,
    );
  }
}
