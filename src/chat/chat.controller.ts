// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@Controller('chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('my-chats')
  async getUserChatRooms(@Req() req: { user: { userId: number } }) {
    const userId = req.user.userId;
    return this.chatService.getUserChatRooms(userId);
  }

  @Get('unread-count')
  getUnreadMessageCount(@Req() req: { user: { userId: number } }) {
    const userId = req.user.userId;
    return this.chatService.getUnreadMessageCount(userId);
  }

  @Get(':id/messages')
  async getChatRoomMessages(
    @Param('id', ParseIntPipe) chatRoomId: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    // userId odatda auth guard orqali olinadi
    const userId = 1; // TEMP, o'zgartiring auth bilan

    const skip = (page - 1) * limit;

    const messages = await this.chatService.getChatRoomMessages(
      chatRoomId,
      userId,
      skip,
      limit,
    );

    return messages;
  }
  /**
   * Muayyan chat xonasidagi barcha xabarlarni o'qilgan deb belgilash.
   */
  @Post(':chatRoomId/mark-as-read')
  async markMessagesAsRead(
    @Param('chatRoomId') chatRoomId: number,
    @Req() req: { user: { userId: number } },
  ) {
    const userId = req.user.userId;
    await this.chatService.markMessagesAsRead(chatRoomId, userId);
    return { success: true };
  }
  /**
   * Yangi chat xonasini yaratish yoki mavjudini topish.
   */
  @Post('create-or-get')
  async createOrGetChatRoom(
    @Body('productId') productId: number,
    @Body('participantIds') participantIds: string[],
    @Req() req: { user: { userId: string } },
  ) {
    const authenticatedUserId = req.user.userId;
    if (!participantIds.includes(authenticatedUserId)) {
      participantIds.push(authenticatedUserId);
    }
    return this.chatService.findOrCreateChatRoom(productId, participantIds);
  }
}
