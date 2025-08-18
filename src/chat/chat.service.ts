// src/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, FindOptionsWhere } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { Message } from './entities/message.entity';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { isArray } from 'class-validator';

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
   */
  async getUserChatRooms(userId: number) {
    const chatRooms = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin(
        'chatRoom.participants',
        'userParticipant',
        'userParticipant.id = :userId',
        { userId },
      )
      .leftJoinAndSelect('chatRoom.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('chatRoom.participants', 'participant')
      .orderBy('chatRoom.updatedAt', 'DESC')
      .getMany();

    const chatRoomsWithLastMessage = await Promise.all(
      chatRooms.map(async (room) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { chatRoomId: room.id },
          order: { createdAt: 'DESC' },
          relations: ['sender'],
        });

        const unreadCount = await this.messageRepository.count({
          where: {
            chatRoomId: room.id,
            read: false,
            senderId: Not(userId),
          },
        });

        const otherParticipant = room.participants.find((p) => p.id !== userId);

        return {
          id: room.id,
          productName: room.product?.title || 'Mahsulot topilmadi',
          imageUrl:
            isArray(room.product.images) &&
            room.product.imageIndex !== undefined &&
            room.product.images[room.product.imageIndex]
              ? room.product.images[room.product.imageIndex].url
              : null,
          otherParticipant: otherParticipant
            ? { id: otherParticipant.id, username: otherParticipant.username }
            : null,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.sender.id,
                senderUsername: lastMessage.sender.username,
              }
            : null,
          updatedAt: room.updatedAt,
          unreadCount: unreadCount,
        };
      }),
    );

    return chatRoomsWithLastMessage;
  }

  /**
   * Muayyan chat xonasidagi xabarlar tarixini olish (paginatsiya va raqamli filtr bilan).
   * 0 - Hammasi, 1 - Menga kelgan xabarlar, 2 - Men yuborgan xabarlar.
   */
  async getChatRoomMessages(
    chatRoomId: number,
    userId: number,
    page: number = 1,
    limit: number = 50,
    filter: number = 0,
  ) {
    const skip = (page - 1) * limit;

    let whereClause: FindOptionsWhere<Message> = {
      chatRoom: { id: chatRoomId },
    };

    switch (filter) {
      case 1: // Menga kelgan xabarlar
        whereClause = { ...whereClause, sender: { id: Not(userId) } };
        break;
      case 2: // Men yuborgan xabarlar
        whereClause = { ...whereClause, sender: { id: userId } };
        break;
      case 0: // Hammasi (standart)
      default:
        break;
    }

    const messages = await this.messageRepository.find({
      where: whereClause,
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      skip,
      take: limit,
    });

    return messages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      senderId: message.sender.id,
      senderUsername: message.sender.username,
      read: message.read,
    }));
  }

  /**
   * Yangi chat xonasini yaratish yoki mavjudini topish.
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

    const participants = await this.userRepository.findBy({
      id: In(participantIds),
    });

    if (participants.length !== 2) {
      throw new NotFoundException(
        'Ishtirokchilardan biri yoki ikkalasi ham topilmadi.',
      );
    }

    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['images'],
    });
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
   * Muayyan chatdagi xabarlarni o'qilgan deb belgilash.
   */
  async markMessagesAsRead(chatRoomId: number, userId: number): Promise<void> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['participants'],
    });

    if (!chatRoom) {
      throw new NotFoundException('Chat xonasi topilmadi.');
    }

    const isParticipant = chatRoom.participants.some((p) => p.id === userId);
    if (!isParticipant) {
      throw new BadRequestException(
        'Siz bu chat xonasining ishtirokchisi emassiz.',
      );
    }

    await this.messageRepository.update(
      {
        chatRoomId: chatRoomId,
        read: false,
        senderId: Not(userId),
      },
      { read: true },
    );
  }

  /**
   * Foydalanuvchining umumiy o'qilmagan xabarlar sonini olish.
   */
  async getUnreadMessageCount(userId: number): Promise<number> {
    const chatRooms = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin(
        'chatRoom.participants',
        'userParticipant',
        'userParticipant.id = :userId',
        { userId },
      )
      .getMany();

    const chatRoomIds = chatRooms.map((room) => room.id);

    return this.messageRepository.count({
      where: {
        chatRoomId: In(chatRoomIds),
        read: false,
        senderId: Not(userId),
      },
    });
  }

  /**
   * Xabarni saqlash. Bu funksiyani ChatGateway ham ishlatadi.
   */
  async saveMessage(
    chatRoomId: number,
    senderId: number,
    messageContent: string,
  ): Promise<Message> {
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
      read: false,
    });

    const savedMessage = await this.messageRepository.save(newMessage);

    chatRoom.updatedAt = new Date();
    await this.chatRoomRepository.save(chatRoom);

    return savedMessage;
  }
}
