import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  NotificationType,
  SendNotificationDto,
} from './dto/send-notification.dto';
import { Notification } from './entities/notification.entity';
import { Product } from 'src/product/entities/product.entity';
import { User } from 'src/auth/entities/user.entity';
import { FirebaseService } from 'firebase.service';

interface NotificationResult {
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly firebaseService: FirebaseService,
  ) {}

  async saveNotification(
    dto: SendNotificationDto,
  ): Promise<Notification | NotificationResult> {
    console.log(
      `[NotificationsService] Received notification request for type: ${dto.type}`,
    );

    if (!dto.type) {
      throw new BadRequestException('Notification type is required');
    }

    // 🔹 Agar notification turi UPDATE_APP bo'lsa, userId shart emas.
    if (dto.type === NotificationType.UPDATE_APP) {
      try {
        console.log(
          `[NotificationsService] Sending topic notification to '/topics/all' for title: "${dto.title}"`,
        );
        await this.firebaseService.sendNotificationToTopic(
          '/topics/all',
          dto.title,
          dto.body,
          { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        );
        console.log(
          '[NotificationsService] Successfully sent topic notification.',
        );
      } catch (error) {
        console.error(
          `[NotificationsService] Error sending topic notification:`,
          error,
        );
        throw new Error('Failed to send topic notification.');
      }
      return { message: 'Notification sent to all users via topic' };
    }

    // 🔹 Qolgan barcha turlar uchun userId majburiy.
    if (!dto.userId) {
      throw new BadRequestException(
        'userId is required for this notification type',
      );
    }

    if (dto.type === NotificationType.CHAT_MESSAGE) {
      console.log(
        `[NotificationsService] CHAT_MESSAGE type, not saving to DB.`,
      );
      return { message: 'Notification only sent, not saved in DB' };
    }

    let entityId: string | undefined = dto.entityId;

    if (dto.type === NotificationType.PRODUCT_PUBLISHED) {
      const unpublishedProducts = await this.productRepo.find({
        where: { profile: { user: { id: dto.userId } }, isPublish: false },
        relations: ['profile', 'profile.user'],
        select: ['id'],
      });

      entityId = unpublishedProducts.length
        ? unpublishedProducts.map((p) => p.id).join(',')
        : undefined;
    }

    const notification = this.notificationRepo.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      chatId: entityId,
      isRead: false,
      user: { id: dto.userId },
    });

    console.log(
      `[NotificationsService] Saving notification of type ${dto.type} to DB for user ID: ${dto.userId}`,
    );
    return this.notificationRepo.save(notification);
  }

  async getUserNotifications(userId: number) {
    const notifications = await this.notificationRepo.find({
      where: { user: { id: userId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return notifications.map((n) => ({
      to: n.user?.token || '',
      notification: { title: n.title, body: n.body },
      data: { type: n.type, chatId: n.chatId ?? '' },
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  }

  async markAsRead(id: number, userId: number) {
    const result = await this.notificationRepo.update(
      { id, user: { id: userId } },
      { isRead: true },
    );

    if (result.affected === 0)
      throw new NotFoundException(
        'Notification not found or does not belong to user',
      );

    return { success: true };
  }

  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { user: { id: userId } },
      { isRead: true },
    );
    return { success: true };
  }

  async getUnreadCount(userId: number) {
    return this.notificationRepo.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  async getNonChatNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { user: { id: userId }, type: Not('CHAT_MESSAGE') },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteNotification(id: number, userId: number) {
    const result = await this.notificationRepo.delete({
      id,
      user: { id: userId },
    });
    if (result.affected === 0)
      throw new NotFoundException(
        'Notification not found or does not belong to user',
      );

    return { success: true };
  }
}
