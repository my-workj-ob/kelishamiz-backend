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
  NotFoundException,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  NotificationType,
  SendNotificationDto,
} from './dto/send-notification.dto';
import { FirebaseService } from 'firebase.service';
import { NotificationsService } from './notification.service';
import { AuthGuard } from '@nestjs/passport';
import { User, UserRole } from 'src/auth/entities/user.entity';
import { RolesGuard } from 'src/common/interceptors/roles/roles.guard';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

interface AuthRequest {
  user?: {
    userId: number;
    role?: UserRole;
  };
}
export interface NotificationResult {
  message: string;
}
interface SendNotificationResponse {
  to?: string; // FCM topic yoki user token
  notification: { title: string; body: string };
  data: Record<string, string>;
  messageId?: string;
  resultMessage: string; // NotificationResult uchun
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notification')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly notificationService: NotificationsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a push notification via Firebase' })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid token.' })
  async sendNotification(
    @Body() body: SendNotificationDto,
  ): Promise<SendNotificationResponse> {
    const fcmData: Record<string, string> = { type: String(body.type) };
    if (body.entityId) fcmData.entityId = String(body.entityId);

    let messageId: string | undefined;
    let resultMessage: string;

    if (body.type === NotificationType.UPDATE_APP) {
      await this.firebaseService.sendNotificationToTopic(
        `all`,
        body.title,
        body.body,
        { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      );
      resultMessage = 'Notification sent to all users via topic';
    } else {
      if (!body.userId) throw new BadRequestException('userId is required');

      const user = await this.userRepo.findOne({ where: { id: body.userId } });
      if (!user) throw new NotFoundException('User not found');

      messageId = await this.firebaseService.sendNotification(
        user.token!,
        body.title,
        body.body,
        fcmData,
      );

      await this.notificationService.saveNotification(body);
      resultMessage = 'Notification saved and sent to user';
    }

    return {
      to: body.type === NotificationType.UPDATE_APP ? '/topics/all' : undefined,
      notification: { title: body.title, body: body.body },
      data: fcmData,
      messageId,
      resultMessage,
    };
  }

  // 🔹 Userning barcha notificationlari
  @Get()
  async getNotifications(@Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.getUserNotifications(req.user.userId);
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

  // 🔹 Bitta notificationni o‘qilgan qilish
  @Patch('read/:id')
  async markAsRead(@Param('id') id: number, @Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.markAsRead(id, req.user.userId);
  }
  // 🔹 Bitta notificationni o'chirish
  @Delete('delete/:id')
  async deleteNotification(@Param('id') id: number, @Req() req: AuthRequest) {
    if (!req.user?.userId) throw new ForbiddenException('User not found');
    return this.notificationService.deleteNotification(id, req.user.userId);
  }
}
