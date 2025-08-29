import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SendNotificationDto } from './dto/send-notification.dto';
import { FirebaseService } from 'firebase.service';
import { NotificationsService } from './notification.service';

@ApiTags('Notifications')
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly notificationService: NotificationsService,
  ) {}
  @Post('send')
  @ApiOperation({ summary: 'Send a push notification via Firebase' })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid token.' })
  async sendNotification(@Body() body: SendNotificationDto) {
    try {
      // Firebase orqali yuboramiz
      const messageId = await this.firebaseService.sendNotification(
        body.token,
        body.title,
        body.body,
        { type: body.type, chatId: body.chatId || '' },
      );

      // DB ga saqlaymiz
      await this.notificationService.saveNotification(body);

      // 🔹 FCM formatida javob qaytaramiz
      return {
        to: body.token,
        notification: {
          title: body.title,
          body: body.body,
        },
        data: {
          type: body.type,
          chatId: body.chatId || '',
        },
        messageId, // 🔹 Qo'shildi
      };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Get(':userId')
  async getNotifications(@Param('userId') userId: number) {
    return this.notificationService.getUserNotifications(userId);
  }

  @Patch(':id')
  async markAsRead(@Param('id') id: number) {
    return this.notificationService.markAsRead(id);
  }
  @Get('unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: number) {
    return this.notificationService.getUnreadCount(userId);
  }
  @Patch('mark-all/:userId')
  async markAllAsRead(@Param('userId') userId: number) {
    return this.notificationService.markAllAsRead(userId);
  }
}
