import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  PRODUCT_PUBLISHED = 'PRODUCT_PUBLISHED',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_ROOM = 'CHAT_ROOM',
  NEW_AD = 'NEW_AD', // elonlar sayti uchun
  AD_EXPIRED = 'AD_EXPIRED', // elonlar sayti uchun
  PROMOTION = 'PROMOTION', // reklama yoki promo uchun
}

export class SendNotificationDto {
  @ApiProperty({ description: 'User ID to whom notification belongs' })
  userId: number; // optionalni olib tashladik, JWT orqali ham beriladi

  @ApiProperty({ description: 'Title of the notification' })
  title: string;

  @ApiProperty({ description: 'Body text of the notification' })
  body: string;

  @ApiProperty({
    description: 'Type of the notification',
    enum: NotificationType,
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Related entity ID (ProductId, ChatId, AdId etc.)',
    required: false,
  })
  entityId?: string; // optional, FCM data uchun
}
