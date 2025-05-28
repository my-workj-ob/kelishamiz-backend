/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOptionalAuthGuard } from './../common/jwt/guards/jwt-optional-auth.guard';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtOptionalAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('')
  @ApiOperation({ summary: 'Get all notifications for user' })
  async getNotifications(@Req() req) {
    const userId = req.user?.userId as number;
    return this.notificationService.getUserNotifications(userId);
  }

  @Get('/unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@Req() req) {
    const userId = req.user?.userId as number;
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markAsRead(@Param('id') id: number) {
    return this.notificationService.markAsRead(+id);
  }

  @Post('/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  async markAllAsRead(@Req() req) {
    const userId = req.user?.userId as number;
    return this.notificationService.markAllAsRead(userId);
  }
}
