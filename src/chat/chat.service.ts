// src/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { Message } from './entities/message.entity';
import { User } from './../auth/entities/user.entity';
import { Product } from './../product/entities/product.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Foydalanuvchining barcha chat xonalarini olish.
   * Dizayndagi "Habarlar" ro'yxati uchun.
   */
  async getUserChatRooms(userId: number) {
    const chatRooms = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .leftJoinAndSelect('chatRoom.product', 'product')
      .leftJoinAndSelect('chatRoom.participants', 'participant')
      .leftJoinAndSelect('chatRoom.messages', 'message')
      // Jadval va ustun nomlari to'g'rilandi
      .where(
        'chatRoom.id IN (SELECT "chatRoomId" FROM chat_room_participants_user WHERE "userId" = :userId)',
        { userId },
      )
      .orderBy('chatRoom.updatedAt', 'DESC')
      .getMany();

    const chatRoomsWithLastMessage = await Promise.all(
      chatRooms.map(async (room) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { chatRoom: { id: room.id } },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        const otherParticipant = room.participants.find((p) => p.id !== userId);

        return {
          id: room.id,
          productName: room.product?.title || 'Mahsulot topilmadi',
          otherParticipant: otherParticipant
            ? { id: otherParticipant.id, username: otherParticipant.username }
            : null,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                senderUsername: lastMessage.sender.username,
              }
            : null,
          updatedAt: room.updatedAt,
        };
      }),
    );

    return chatRoomsWithLastMessage;
  }

  /**
   * Muayyan chat xonasidagi xabarlar tarixini olish (paginatsiya bilan).
   * Foydalanuvchi chatni ochganda chaqiriladi.
   */
  async getChatRoomMessages(
    chatRoomId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const messages = await this.messageRepository.find({
      where: { chatRoom: { id: chatRoomId } },
      relations: ['sender'], // Kim yuborganligini ham olish
      order: { createdAt: 'ASC' }, // Eng eski xabarlar birinchi keladi
      skip: skip,
      take: limit,
    });

    return messages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      senderId: message.sender.id,
      senderUsername: message.sender.username,
    }));
  }

  /**
   * Yangi chat xonasini yaratish yoki mavjudini topish.
   * Foydalanuvchi biror mahsulot e'lonini ko'rganda "Chatni boshlash" tugmasini bosganda.
   */
  async findOrCreateChatRoom(
    productId: number,
    participantIds: string[],
  ): Promise<ChatRoom> {
    if (participantIds?.length !== 2) {
      throw new BadRequestException(
        'Chat xonasi uchun aniq 2 ta ishtirokchi kerak.',
      );
    }

    // Foydalanuvchilarning mavjudligini tekshirish
    const participants = await this.userRepository.findBy({
      id: In(participantIds),
    });

    if (participants?.length !== 2) {
      throw new NotFoundException(
        'Ishtirokchilardan biri yoki ikkalasi ham topilmadi.',
      );
    }

    // Mahsulotni topamiz
    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi.');
    }

    // Chat xonasini topishga urinish:
    // 1. Shu mahsulotga tegishli bo'lishi kerak.
    // 2. Ikkala ishtirokchi ham shu chat xonasida bo'lishi kerak.
    const existingChatRoom = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin('chatRoom.participants', 'participant1')
      .innerJoin('chatRoom.participants', 'participant2')
      .where('chatRoom.productId = :productId', { productId })
      .andWhere('participant1.id = :id1', { id1: participantIds[0] })
      .andWhere('participant2.id = :id2', { id2: participantIds[1] })
      .getOne();

    if (existingChatRoom) {
      return existingChatRoom; // Mavjud chat xonasini qaytaramiz
    }

    // Agar topilmasa, yangi chat xonasi yaratamiz
    const newChatRoom = this.chatRoomRepository.create({
      product: product, // Product obyektini to'g'ridan-to'g'ri bog'laymiz
      participants: participants, // Participants massivini to'g'ridan-to'g'ri bog'laymiz
    });

    return this.chatRoomRepository.save(newChatRoom);
  }

  /**
   * Xabarni saqlash. Bu funksiyani ChatGateway ham ishlatadi.
   */
  async saveMessage(
    chatRoomId: string,
    senderId: number,
    messageContent: string,
  ): Promise<Message> {
    const chatRoom = await this.chatRoomRepository.findOneBy({
      id: chatRoomId,
    });
    if (!chatRoom) {
      throw new NotFoundException('Chat xonasi topilmadi.');
    }

    const sender = await this.userRepository.findOneBy({ id: senderId });
    if (!sender) {
      throw new NotFoundException('Yuboruvchi foydalanuvchi topilmadi.');
    }

    const newMessage = this.messageRepository.create({
      chatRoom: chatRoom,
      sender: sender,
      content: messageContent,
    });

    const savedMessage = await this.messageRepository.save(newMessage);

    chatRoom.updatedAt = new Date();
    await this.chatRoomRepository.save(chatRoom);

    return savedMessage;
  }
}
