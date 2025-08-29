import { Injectable, NotFoundException } from '@nestjs/common';
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
    const notification = this.notificationRepo.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      chatId: dto.chatId ?? undefined, // null emas, undefined ishlatamiz
      isRead: false,
      user: { id: dto.userId || 1 }, // relation orqali bog‘laymiz
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

  // 🔹 Bitta bildirishnomani o‘qilgan deb belgilash
  async markAsRead(id: number) {
    const result = await this.notificationRepo.update(id, { isRead: true });
    if (result.affected === 0)
      throw new NotFoundException('Notification not found');
    return { success: true };
  }

  // 🔹 Barcha bildirishnomalarni o‘qilgan qilish
  async markAllAsRead(userId: number) {
    await this.notificationRepo.update(
      { user: { id: userId } }, // ⚠️ relation orqali filter
      { isRead: true },
    );
    return { success: true };
  }

  // 🔹 O‘qilmagan bildirishnomalar soni
  async getUnreadCount(userId: number) {
    return this.notificationRepo.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  // 🔹 Bitta bildirishnomani o‘chirish
  async deleteNotification(id: number) {
    const result = await this.notificationRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Notification not found');
    return { success: true };
  }

  // 🔹 Chat bildirishnomalarini chiqarib tashlash (faqat boshqa turlarni olish)
  async getNonChatNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { user: { id: userId }, type: Not('CHAT_MESSAGE') },
      order: { createdAt: 'DESC' },
    });
  }
}
