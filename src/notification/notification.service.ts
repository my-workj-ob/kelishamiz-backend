import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { SendNotificationDto } from './dto/send-notification.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // 🔹 Bildirishnoma saqlash
  async saveNotification(dto: SendNotificationDto) {
    if (!dto.type)
      throw new BadRequestException('Notification type is required');

    const notification = this.notificationRepo.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      chatId: dto.entityId ?? undefined, // Chat yoki Product Id
      isRead: false,
      user: { id: dto.userId },
    });

    return this.notificationRepo.save(notification);
  }

  // 🔹 Userning barcha bildirishnomalari
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

  // 🔹 Bitta notificationni o‘qilgan qilish
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

  // 🔹 Barcha notificationlarni o‘qilgan qilish
  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { user: { id: userId } },
      { isRead: true },
    );
    return { success: true };
  }

  // 🔹 O‘qilmagan notificationlar soni
  async getUnreadCount(userId: number) {
    return this.notificationRepo.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  // 🔹 Bitta notificationni o‘chirish
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

  // 🔹 Chat notificationlarni chiqarib tashlash (faqat boshqa turlar)
  async getNonChatNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { user: { id: userId }, type: Not('CHAT_MESSAGE') },
      order: { createdAt: 'DESC' },
    });
  }
}
