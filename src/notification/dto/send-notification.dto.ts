import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export enum NotificationType {
  PRODUCT_PUBLISHED = 'PRODUCT_PUBLISHED',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  UPDATE_APP = 'UPDATE_APP',
  NEW_AD = 'NEW_AD',
  AD_EXPIRED = 'AD_EXPIRED',
  PROMOTION = 'PROMOTION',
}

export class SendNotificationDto {
  @IsOptional()
  @ApiProperty({
    description: 'User ID to whom the notification will be sent',
    required: false,
  })
  userId: number;

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
  entityId?: string;
}
