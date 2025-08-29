import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ description: 'FCM token of the target device' })
  token: string;

  @ApiProperty({ description: 'FCM token of the target device' })
  userId: number;
  @ApiProperty({ description: 'FCM token of the target device' })
  title: string;

  @ApiProperty({ description: 'Body text of the notification' })
  body: string;

  @ApiProperty({
    description: 'Type of the notification',
    example: 'PRODUCT_PUBLISHED',
  })
  @ApiProperty({ description: 'Chat ID if the type is chat', required: false })
  chatId?: string;
  type: string; // Yangi qo'shildi
}
