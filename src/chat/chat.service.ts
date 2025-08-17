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
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';

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
      .innerJoin(
        'chatRoom.participants',
        'userParticipant',
        'userParticipant.id = :userId',
        { userId },
      ) // Faqat user qatnashgan chatlar
      .leftJoinAndSelect('chatRoom.product', 'product') // Mahsulot ma'lumotlari
      .leftJoinAndSelect('chatRoom.participants', 'participant') // Barcha ishtirokchilar (filterlanmagan)
      .leftJoinAndSelect('chatRoom.messages', 'message') // Xabarlar
      .orderBy('chatRoom.updatedAt', 'DESC')
      .getMany();

    const chatRoomsWithLastMessage = await Promise.all(
      chatRooms.map(async (room) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { chatRoom: { id: room.id } },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        // Endi bu yerda barcha ishtirokchilar bor bo'ladi
        const otherParticipant = room.participants.find((p) => p.id !== userId);

        return {
          id: room.id,
          productName: room.product?.title || 'Mahsulot topilmadi',
          imageUrl:
            Array.isArray(room.product?.images) &&
            room.product.imageIndex !== undefined
              ? room.product.images[room.product.imageIndex]
              : 'Mahsulot topilmadi' || 'Mahsulot topilmadi',
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
    chatRoomId: number,
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
    if (participantIds.length !== 2) {
      throw new BadRequestException(
        'Chat xonasi uchun aniq 2 ta ishtirokchi kerak.',
      );
    }

    // Foydalanuvchilarning mavjudligini tekshirish
    const participants = await this.userRepository.findBy({
      id: In(participantIds),
    });

    console.log(participantIds);

    if (participants.length !== 2) {
      throw new NotFoundException(
        'Ishtirokchilardan biri yoki ikkalasi ham topilmadi.',
      );
    }

    // Mahsulotni topamiz
    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi.');
    }

    const existingChatRoom = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin('chatRoom.participants', 'participant1')
      .innerJoin('chatRoom.participants', 'participant2')
      .where('chatRoom.productId = :productId', { productId })
      .andWhere('participant1.id = :id1', { id1: participantIds[0] })
      .andWhere('participant2.id = :id2', { id2: participantIds[1] })
      .getOne();

    if (existingChatRoom) {
      return existingChatRoom;
    }

    const newChatRoom = this.chatRoomRepository.create({
      product: product,
      participants: participants,
    });

    return this.chatRoomRepository.save(newChatRoom);
  }

  /**
   * Xabarni saqlash. Bu funksiyani ChatGateway ham ishlatadi.
   */
  async saveMessage(
    chatRoomId: number,
    senderId: number,
    messageContent: string,
  ): Promise<Message> {
    console.log('Incoming message:', messageContent);

    // Validatsiya
    if (typeof messageContent !== 'string' || messageContent.length > 10000) {
      throw new BadRequestException('Xabar formati noto‘g‘ri yoki juda uzun.');
    }

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
