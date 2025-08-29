// src/notification/dto/chat-notification.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatNotificationDto {
  @ApiProperty({ description: 'The ID of the chat room.' })
  @IsString()
  @IsNotEmpty()
  chatRoomId: string;

  @ApiProperty({ description: 'The ID of the product related to the chat.' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'The title of the notification (e.g., sender name).',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'The body text of the message.' })
  @IsString()
  @IsNotEmpty()
  body: string;
}
