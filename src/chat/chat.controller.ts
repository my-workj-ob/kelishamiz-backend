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
// import { AuthGuard } from '@nestjs/passport'; // Agar autentifikatsiya ishlatayotgan bo'lsangiz
// import { Request } from 'express'; // Agar express Request ishlatayotgan bo'lsangiz
// import { GetUser } from '../auth/decorators/get-user.decorator'; // Custom decorator bo'lsa
// import { User } from '../entities/user.entity'; // User entity/interface

@Controller('chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Foydalanuvchining barcha chat xonalarini (konversatsiyalarini) olish.
   * Bu sizning "Habarlar" ro'yxatiga mos keladi.
   * @param req Express so'rov obyekti (autentifikatsiya qilingan foydalanuvchi ma'lumotlari uchun)
   */
  @Get('my-chats')
  async getUserChatRooms(@Req() req: { user: { userId: number } }) {
    // Type 'any' vaqtinchalik, User tipini o'rnating
    const userId = req.user.userId; // Haqiqiy autentifikatsiya qilingan user ID
    return this.chatService.getUserChatRooms(userId);
  }

  /**
   * Muayyan chat xonasidagi xabarlar tarixini olish (paginatsiya bilan).
   * Foydalanuvchi chatni ochganda chaqiriladi.
   * @param chatRoomId Chat xonasining IDsi.
   * @param page Paginatsiya sahifa raqami.
   * @param limit Bir sahifadagi xabarlar soni.
   */
  @Get(':chatRoomId/messages')
  async getChatRoomMessages(
    @Param('chatRoomId') chatRoomId: number,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.chatService.getChatRoomMessages(
      chatRoomId,
      parseInt(page),
      parseInt(limit),
    );
  }

  /**
   * Yangi chat xonasini yaratish yoki mavjudini topish.
   * Foydalanuvchi biror mahsulot e'lonini ko'rganda "Chatni boshlash" tugmasini bosganda.
   * @param productId Yangi chat ochilayotgan mahsulotning IDsi.
   * @param participantIds Chatda ishtirok etadigan foydalanuvchilar IDlari (odatda 2 ta).
   */
  @Post('create-or-get')
  async createOrGetChatRoom(
    @Body('productId') productId: number,
    @Body('participantIds') participantIds: string[],
    @Req() req: { user: { userId: string } }, // Hozirgi user ID sini olish uchun
  ) {
    // Autentifikatsiya qilingan user ID sini participantIds ga qo'shamiz
    const authenticatedUserId = req.user.userId; // Haqiqiy autentifikatsiya qilingan user ID
    if (!participantIds.includes(authenticatedUserId)) {
      participantIds.push(authenticatedUserId);
    }
    return this.chatService.findOrCreateChatRoom(productId, participantIds);
  }
}
