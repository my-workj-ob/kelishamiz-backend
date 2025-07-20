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
  async getUserChatRooms(@Req() req: any) {
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
    @Param('chatRoomId') chatRoomId: string,
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
    @Body('participantIds') participantIds: number[],
    @Req() req: any, // User ID ni olish uchun
  ) {
    
    const authenticatedUserId = req.user.userId;

    // ⚠️ Agar participantIds bo‘sh bo‘lsa yoki undefined bo‘lsa, uni array qilib olamiz
    const participants = participantIds ?? [];

    console.log('participants: ', participants);

    // Autentifikatsiyalangan foydalanuvchi ro‘yxatda yo‘q bo‘lsa, qo‘shamiz
    if (!participants.includes(authenticatedUserId)) {
      participants.push(authenticatedUserId);
    }
    //

    // Agar faqat bitta ishtirokchi bo‘lsa va u authenticated user bo‘lmasa, uni ham qo‘shamiz
    if (participants.length === 1 && participants[0] !== authenticatedUserId) {
      participants.push(authenticatedUserId);
    }

    console.log('Creating or finding chat room with:', {
      productId,
      participants,
      authenticatedUserId,
    });

    return this.chatService.findOrCreateChatRoom(productId, participants);
  }
}
