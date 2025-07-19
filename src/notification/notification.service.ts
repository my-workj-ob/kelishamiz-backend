import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { ConfigService } from '@nestjs/config';
import * as OneSignal from 'onesignal-node';

export type NotificationType =
  | 'NEW_CONNECTION'
  | 'MESSAGE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONNECTION_REMOVED'
  | 'OTHER'
  | 'CONNECTION_REQUEST';

@Injectable()
export class NotificationService {
  private readonly oneSignalClient: OneSignal.Client;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly configService: ConfigService,
  ) {
    
    this.oneSignalClient = new OneSignal.Client(
      this.configService.get<string>('ONESIGNAL_APP_ID')!,
      this.configService.get<string>('ONESIGNAL_REST_API_KEY')!,
    );
  }

  
  async createNotification(
    userId: number,
    type: NotificationType,
    message: string,
    relatedId?: number,
    externalId?: string,
  ) {
    console.log(process.env.ONESIGNAL_APP_ID)
    console.log(process.env.ONESIGNAL_REST_API_KEY)
    try {
      const notification = this.notificationRepo.create({
        userId,
        type,
        message,
        relatedId,
      });
      const savedNotification = await this.notificationRepo.save(notification);

    
      if (externalId) {
        await this.sendPushNotification(userId, type, message, externalId);
      }

      return savedNotification;
    } catch (error) {
      console.error(
        `[NotificationService] Bildirishnoma yaratishda xatolik:`,
        error,
      );
      throw error;
    }
  }

  async sendPushNotification(
    userId: number,
    type: NotificationType,
    message: string,
    externalId: string,
  ) {
    try {
      const notification = {
        app_id: this.configService.get<string>('ONESIGNAL_APP_ID'),
        include_external_user_ids: [externalId], // Foydalanuvchining external ID’si
        contents: { en: message },
        headings: { en: type },
        data: { userId, type, notificationId: Date.now() }, // Qo‘shimcha ma’lumotlar
      };

      const response =
        await this.oneSignalClient.createNotification(notification);
      console.log(`Push notification yuborildi: ${userId}`, response);
    } catch (error) {
      console.error(
        `[NotificationService] Push notification yuborishda xatolik (Foydalanuvchi ID: ${userId}):`,
        error,
      );
      throw error;
    }
  }

  async getUnreadCount(userId: number) {
    try {
      const count = await this.notificationRepo.count({
        where: { userId, isRead: false },
      });
      return count;
    } catch (error) {
      console.error(
        `[NotificationService] O'qilmagan bildirishnomalar sonini olishda xatolik (Foydalanuvchi ID: ${userId}):`,
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        `O'qilmagan bildirishnomalar sonini olishda xatolik: ${error}`,
      );
    }
  }

  async markAsRead(notificationId: number) {
    try {
      await this.notificationRepo.update(notificationId, { isRead: true });
    } catch (error) {
      console.error(
        `[NotificationService] Bildirishnomani o'qilgan deb belgilashda xatolik (ID: ${notificationId}):`,
        error,
      );
      throw error;
    }
  }

  async markAllAsRead(userId: number) {
    try {
      await this.notificationRepo.update(
        { userId, isRead: false },
        { isRead: true },
      );
    } catch (error) {
      console.error(
        `[NotificationService] Barcha bildirishnomalarni o'qilgan deb belgilashda xatolik (Foydalanuvchi ID: ${userId}):`,
        error,
      );
      throw error;
    }
  }

  async getUserNotifications(userId: number) {
    try {
      const notifications = await this.notificationRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      return notifications;
    } catch (error) {
      console.error(
        `[NotificationService] Foydalanuvchi bildirishnomalarini olishda xatolik (Foydalanuvchi ID: ${userId}):`,
        error,
      );
      throw error;
    }
  }
}
