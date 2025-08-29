import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ description: 'FCM token of the target device' })
  token: string;

  @ApiProperty({ description: 'Title of the notification' })
  title: string;

  @ApiProperty({ description: 'Body text of the notification' })
  body: string;

  @ApiProperty({
    description: 'Type of the notification',
    example: 'PRODUCT_PUBLISHED',
  })
  type: string; // majburiy

  @ApiProperty({
    description: 'Optional chat ID associated with the notification',
    required: false,
  })
  chatId?: string;

  // userId backendda JWT orqali olinadi, shuning uchun optional qilib qo‘ymoqchimiz
  userId?: number;
}
