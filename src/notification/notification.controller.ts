import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SendNotificationDto } from './dto/send-notification.dto';
import { FirebaseService } from 'firebase.service';
import { NotificationsService } from './notification.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from 'src/auth/entities/user.entity';
import { RolesGuard } from 'src/common/interceptors/roles/roles.guard';

interface AuthRequest {
  user?: {
    userId: number;
    role?: UserRole;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notification')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly notificationService: NotificationsService,
  ) {}

  // 🔹 Push notification yuborish
  @Post('send')
  @ApiOperation({ summary: 'Send a push notification via Firebase' })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid token.' })
  async sendNotification(
    @Body() body: SendNotificationDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.user?.userId) {
      throw new ForbiddenException('User not found in request');
    }

    try {
      // 🔹 FCM data faqat string bo‘lishi kerak
      const fcmData: Record<string, string> = {};
      if (body.type) fcmData.type = String(body.type);
      if (body.chatId) fcmData.chatId = String(body.chatId);

      const messageId = await this.firebaseService.sendNotification(
        body.token,
        body.title,
        body.body,
        fcmData,
      );

      await this.notificationService.saveNotification({
        ...body,
        userId: req.user.userId,
      });

      return {
        to: body.token,
        notification: { title: body.title, body: body.body },
        data: fcmData,
        messageId,
      };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  // 🔹 Userning barcha notificationlari
  @Get()
  async getNotifications(@Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.getUserNotifications(req.user.userId);
  }

  // 🔹 Bitta notificationni o‘qilgan qilish
  @Patch(':id')
  async markAsRead(@Param('id') id: number, @Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.markAsRead(id, req.user.userId);
  }

  // 🔹 O‘qilmagan notificationlar soni
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.getUnreadCount(req.user.userId);
  }

  // 🔹 Barcha notificationlarni o‘qilgan qilish
  @Patch('mark-all')
  async markAllAsRead(@Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.markAllAsRead(req.user.userId);
  }
}
