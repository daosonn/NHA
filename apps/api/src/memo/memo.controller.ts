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
import { CreateMemoDto } from './dto/create-memo.dto';
import { UpdateMemoDto } from './dto/update-memo.dto';
import { MemoService, type MemoDetail } from './memo.service';

@ApiTags('memos')
@ApiBearerAuth()
@Controller('families/:familyId/members/:memberId/memos')
export class MemberMemoController {
  constructor(private readonly memoService: MemoService) {}

  @Get()
  @ApiOperation({
    summary:
      'My private notes about this member, most recently touched first ' +
      '(WBS 1.6.5) — always author-only, nobody else ever sees them',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<MemoDetail[]> {
    return this.memoService.list(user.userId, familyId, memberId);
  }

  @Post()
  @ApiOperation({ summary: 'Write a private note about this member' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: CreateMemoDto,
  ): Promise<MemoDetail> {
    return this.memoService.create(user.userId, familyId, memberId, dto);
  }
}

@ApiTags('memos')
@ApiBearerAuth()
@Controller('memos')
export class MemoController {
  constructor(private readonly memoService: MemoService) {}

  @Get(':memoId')
  @ApiOperation({ summary: 'One of my notes — 404 for anything not mine' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('memoId', ParseUUIDPipe) memoId: string,
  ): Promise<MemoDetail> {
    return this.memoService.get(user.userId, memoId);
  }

  @Patch(':memoId')
  @ApiOperation({ summary: 'Edit one of my notes' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('memoId', ParseUUIDPipe) memoId: string,
    @Body() dto: UpdateMemoDto,
  ): Promise<MemoDetail> {
    return this.memoService.update(user.userId, memoId, dto);
  }

  @Delete(':memoId')
  @ApiOperation({ summary: 'Delete one of my notes and its media files' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('memoId', ParseUUIDPipe) memoId: string,
  ): Promise<{ success: boolean }> {
    return this.memoService.remove(user.userId, memoId);
  }
}
