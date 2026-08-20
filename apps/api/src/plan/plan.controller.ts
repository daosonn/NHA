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
import { CreatePlanDto } from './dto/create-plan.dto';
import { SharePlanDto } from './dto/share-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanService, type PlanDetail, type PlanSummary } from './plan.service';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('me/plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({
    summary:
      'Plans I own plus plans shared with me, most recently touched ' +
      'first (WBS 2.6.4) — `canEdit` tells the two apart',
  })
  list(@CurrentUser() user: AuthUser): Promise<PlanSummary[]> {
    return this.planService.list(user.userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Save a plan — typically a quality-time suggestion the user kept',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanDetail> {
    return this.planService.create(user.userId, dto);
  }

  @Get(':planId')
  @ApiOperation({
    summary:
      'One plan with its content; the share list is returned to the owner only',
  })
  get(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<PlanDetail> {
    return this.planService.get(user.userId, planId);
  }

  @Patch(':planId')
  @ApiOperation({
    summary: 'Edit the plan — owner only; a shared viewer gets 403',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanDetail> {
    return this.planService.update(user.userId, planId, dto);
  }

  @Delete(':planId')
  @ApiOperation({ summary: 'Delete the plan and its shares — owner only' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<{ success: boolean }> {
    return this.planService.remove(user.userId, planId);
  }

  @Post(':planId/shares')
  @ApiOperation({
    summary:
      'Share view-only with someone in one of your families — idempotent',
  })
  share(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: SharePlanDto,
  ): Promise<PlanDetail> {
    return this.planService.share(user.userId, planId, dto);
  }

  @Delete(':planId/shares/:userId')
  @ApiOperation({ summary: 'Stop sharing with one person — idempotent' })
  unshare(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('userId', ParseUUIDPipe) sharedWithUserId: string,
  ): Promise<{ success: boolean }> {
    return this.planService.unshare(user.userId, planId, sharedWithUserId);
  }
}
