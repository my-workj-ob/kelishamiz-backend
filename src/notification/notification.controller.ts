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
import { SendNotificationDto } from './dto/send-notification.dto';
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

  // 🔹 Push notification yuborish
  @Post('send')
  @ApiOperation({ summary: 'Send a push notification via Firebase' })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid token.' })
  async sendNotification(@Body() body: SendNotificationDto) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.type) throw new BadRequestException('type is required');

    // 🔹 FCM data: type va entityId string bo‘lishi kerak
    const fcmData: Record<string, string> = {
      type: String(body.type),
    };
    if (body.entityId) fcmData.entityId = String(body.entityId);

    const user = await this.userRepo.findOne({
      where: { id: body.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const messageId = await this.firebaseService.sendNotification(
      user?.token ??
        (() => {
          throw new BadRequestException('User token is required');
        })(),
      body.title,
      body.body,
      fcmData,
    );

    // 🔹 DB saqlash
    await this.notificationService.saveNotification({
      ...body,
    });

    return {
      to: user?.token,
      notification: { title: body.title, body: body.body },
      data: fcmData,
      messageId,
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
