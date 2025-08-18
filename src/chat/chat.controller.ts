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

  /**
   * Foydalanuvchining barcha chat xonalarini (konversatsiyalarini) olish.
   * Agar `chatId` berilsa, o'sha chatning xabarlarini qaytaradi.
   * `filter` parametri: 0-hammasi, 1-menga kelgan, 2-men yuborgan.
   */
  @Get('my-chats')
  async getUserChatRooms(
    @Req() req: { user: { userId: number } },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('chatId') chatId?: string, // Yangi ixtiyoriy parametr
    @Query('filter') filter: string = '0', // Yangi ixtiyoriy parametr
  ) {
    const userId = req.user.userId;
    if (chatId) {
      // Agar chatId berilsa, faqat bitta chatning xabarlarini qaytarish
      return this.chatService.getChatRoomMessages(
        parseInt(chatId),
        userId,
        parseInt(page),
        parseInt(limit),
        parseInt(filter),
      );
    } else {
      // Aks holda, barcha chatlar ro'yxatini qaytarish
      return this.chatService.getUserChatRooms(userId);
    }
  }

  // `getChatRoomMessages` funksiyasi endi kerak emas, chunki u yuqoriga birlashtirildi.

  @Get('unread-count')
  getUnreadMessageCount(@Req() req: { user: { userId: number } }) {
    const userId = req.user.userId;
    return this.chatService.getUnreadMessageCount(userId);
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
