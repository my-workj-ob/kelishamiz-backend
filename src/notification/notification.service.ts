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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}
  async saveNotification(dto: SendNotificationDto): Promise<Notification> {
    if (dto.type === NotificationType.CHAT_MESSAGE) {
      throw new BadRequestException(
        'CHAT_MESSAGE notifications are not saved to DB',
      );
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
