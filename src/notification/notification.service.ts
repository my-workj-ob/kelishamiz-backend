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
    @InjectRepository(User) // 🔹 userRepo qo'shildi
    private readonly userRepo: Repository<User>,
  ) {}

  async saveNotification(
    dto: SendNotificationDto,
  ): Promise<Notification | Notification[] | NotificationResult> {
    if (!dto.type) {
      throw new BadRequestException('Notification type is required');
    }

    if (dto.type === NotificationType.CHAT_MESSAGE) {
      return { message: 'Notification only sent, not saved in DB' };
    }

    if (dto.type === NotificationType.UPDATE_APP) {
      const users = await this.userRepo.find();
      const notifications: Notification[] = [];

      for (const user of users) {
        const notification = this.notificationRepo.create({
          title: dto.title,
          body: dto.body,
          type: dto.type,
          chatId: dto.entityId,
          isRead: false,
          user: { id: user.id },
        });
        notifications.push(notification);
      }

      return this.notificationRepo.save(notifications);
    }

    // Bitta user uchun notification
    const notification = this.notificationRepo.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      chatId: dto.entityId,
      isRead: false,
      user: { id: dto.userId },
    });

    return this.notificationRepo.save(notification); // ✅ Endi type mos
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
