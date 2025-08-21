import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { SendNotificationDto } from './dto/send-notification.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { FirebaseService } from 'firebase.service';

@ApiTags('Notifications') // 🔹 Swagger tag
@Controller('notification')
export class NotificationController {
  constructor(private readonly firebaseService: FirebaseService) {}
  @Post('send')
  @ApiOperation({ summary: 'Send a push notification via Firebase' })
  @ApiBody({ type: SendNotificationDto })
  @ApiResponse({ status: 201, description: 'Notification sent successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid token.' })
  async sendNotification(
    @Body() body: SendNotificationDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const messageId = await this.firebaseService.sendNotification(
        body.token,
        body.title,
        body.body,
        {
          route: '/orderDetail',
        },
      );

      return { success: true, messageId };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}
