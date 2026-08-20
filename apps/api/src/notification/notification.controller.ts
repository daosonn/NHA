import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  NotificationService,
  type NotificationDetail,
  type NotificationPage,
} from './notification.service';

/**
 * Screen 19. Read-only from the app's side — a notification is raised by
 * something happening (a post, a comment, a reminder), never by a client
 * asking for one, so there is no create route here.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary:
      'My notifications, newest first, cursor-paginated (WBS 3.1.2) — ' +
      '`?unreadOnly=true` narrows it; the response also carries the badge count',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsDto,
  ): Promise<NotificationPage> {
    return this.notificationService.list(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Unread badge on its own, without loading a page (WBS 3.1.4)',
  })
  unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return this.notificationService.unreadCount(user.userId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({
    summary:
      'Mark one read (WBS 3.1.3) — idempotent, the first `readAt` is kept',
  })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationDetail> {
    return this.notificationService.markRead(user.userId, notificationId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark everything read — returns how many changed' })
  markAllRead(@CurrentUser() user: AuthUser): Promise<{ updated: number }> {
    return this.notificationService.markAllRead(user.userId);
  }
}
