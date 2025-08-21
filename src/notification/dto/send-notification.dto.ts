import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({ description: 'FCM token of the target device' })
  token: string;

  @ApiProperty({ description: 'Title of the notification' })
  title: string;

  @ApiProperty({ description: 'Body text of the notification' })
  body: string;
}
