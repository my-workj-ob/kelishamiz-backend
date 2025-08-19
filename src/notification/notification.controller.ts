import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { FirebaseService } from 'src/firebase.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Post('send')
  async sendNotification(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const messageId = await this.firebaseService.sendNotification(
        token,
        title,
        body,
        {
          route: '/orderDetail',
        },
      );

      return { success: true, messageId };
    } catch (err) {
      throw new BadRequestException((err as Error).message); // ✅ always throw Nest exception
    }
  }
}
