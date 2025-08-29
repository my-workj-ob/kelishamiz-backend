// src/notification/dto/update-notification.dto.ts

import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationDto {
  @ApiProperty({
    description: 'The new read status of the notification (true/false)',
  })
  @IsBoolean()
  @IsNotEmpty()
  isRead: boolean;
}
