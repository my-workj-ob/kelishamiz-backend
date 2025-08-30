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

// Bu yerdagi "NotificationResult" interfeysi odatda service-dan qaytuvchi
// ma'lumot turlarini aniq belgilash uchun ishlatiladi.
interface NotificationResult {
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    // 🔹 "productRepo" endi konstruktor ichiga to'g'ri joylashtirildi
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // 🔹 Bildirishnoma saqlash
  async saveNotification(
    dto: SendNotificationDto,
  ): Promise<Notification | NotificationResult> {
    if (!dto.type) {
      throw new BadRequestException('Notification type is required');
    }

    // 1️⃣ CHAT_MESSAGE bo'lsa - DB ga saqlamaymiz
    if (dto.type === NotificationType.CHAT_MESSAGE) {
      const result: NotificationResult = {
        message: 'Notification only sent, not saved in DB',
      };
      return result;
    }

    let entityId: string | undefined = dto.entityId;

    // 2️⃣ PRODUCT_PUBLISHED bo'lsa - faqat shu holatda mahsulotlarni qidiramiz
    if (dto.type === NotificationType.PRODUCT_PUBLISHED) {
      const unpublishedProducts = await this.productRepo.find({
        // 🔹 Xatolikni tuzatish uchun 'relations' maydoni qo'shildi
        where: { profile: { id: dto.userId }, isPublish: false },
        relations: ['user'],
        select: ['id'],
      });

      entityId = unpublishedProducts.length
        ? unpublishedProducts.map((p) => p.id).join(',')
        : undefined;
    }

    // 3️⃣ Notification obyektini yaratamiz
    const notification = this.notificationRepo.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      // "entityId" nomidan foydalanish mantiqan to'g'riroq.
      // Agar "Notification" entity'sida "chatId" maydoni bo'lsa, uni ishlatish kerak.
      chatId: entityId,
      isRead: false,
      user: { id: dto.userId },
    });

    // 4️⃣ Notification bazaga saqlanadi
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
