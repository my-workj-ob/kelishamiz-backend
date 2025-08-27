// src/chat/chat.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
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

  async getUserChatRooms(userId: number) {
    const allChatRooms = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin(
        'chatRoom.participants',
        'userParticipant',
        'userParticipant.id = :userId',
        { userId },
      )
      .where('chatRoom.isDeleted = :isDeleted', { isDeleted: false })
      .leftJoinAndSelect('chatRoom.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('chatRoom.participants', 'participant')
      .orderBy('chatRoom.updatedAt', 'DESC')
      .getMany();

    const mapChatRoom = async (room: ChatRoom) => {
      const lastMessage = await this.messageRepository.findOne({
        where: { chatRoomId: room.id, isDeleted: false }, // Faqat o'chirilmagan oxirgi xabarni oladi
        order: { createdAt: 'DESC' },
        relations: ['sender'],
      });

      const unreadCount = await this.messageRepository.count({
        where: { chatRoomId: room.id, read: false, senderId: Not(userId) },
      });

      const otherParticipant = room.participants.find((p) => p.id !== userId);

      return {
        id: room.id,
        isDeleted: room.isDeleted,
        productName: room.product?.title || 'Mahsulot topilmadi',
        imageUrl:
          Array.isArray(room.product?.images) &&
          room.product?.imageIndex !== undefined &&
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
              read: lastMessage.read,
              isDeleted: lastMessage.isDeleted,
            }
          : null,
        updatedAt: room.updatedAt,
        unreadCount,
        index: (() => {
          if (!lastMessage) return 0;
          if (!lastMessage.read && lastMessage.sender.id !== userId) return 3;
          if (lastMessage.sender.id === userId) return 1;
          if (lastMessage.sender.id !== userId) return 2;
          return 0;
        })(),
      };
    };

    const mappedRooms = await Promise.all(allChatRooms.map(mapChatRoom));
    return mappedRooms;
  }

  async getChatRoomMessages(
    chatRoomId: number,
    userId: number,
    skip: number = 0,
    take: number = 50,
  ) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
    });

    if (!chatRoom) {
      throw new NotFoundException('Chat xonasi topilmadi.');
    }

    const messages = await this.messageRepository.find({
      where: { chatRoom: { id: chatRoomId }, isDeleted: false }, // Faqat o'chirilmagan xabarlarni oladi
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      skip,
      take,
    });

    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      isDeleted: msg.isDeleted,
      createdAt: msg.createdAt,
      senderId: msg.sender.id,
      senderUsername: msg.sender.username,
      read: msg.read,
      index: chatRoom.isDeleted
        ? 4
        : !msg.read && msg.sender.id !== userId
          ? 3
          : msg.sender.id === userId
            ? 1
            : 2,
    }));
  }

  async softDeleteChatRoom(chatRoomId: number, userId: number): Promise<void> {
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
        'Siz bu chat xonasini oʻchirish huquqiga ega emassiz.',
      );
    }

    await this.chatRoomRepository.update(
      { id: chatRoomId },
      { isDeleted: true },
    );
  }

  /**
   * Xabarni yumshoq o'chirish (isDeleted: true).
   */
  async softDeleteMessage(messageId: string, userId: number): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });

    if (!message) throw new NotFoundException('Xabar topilmadi.');

    if (message.sender.id !== userId)
      throw new BadRequestException(
        'Siz bu xabarni oʻchirish huquqiga ega emassiz.',
      );

    await this.messageRepository.update({ id: messageId }, { isDeleted: true });
  }

  /**
   * Yangi chat xonasini yaratish yoki mavjudini topish.
   */
  async findOrCreateChatRoom(
    productId: number,
    participantIds: number[],
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
      await this.messageRepository.update(
        { chatRoom: { id: existingChatRoom.id } },
        { isDeleted: true },
      );

      existingChatRoom.isDeleted = false;
      await this.chatRoomRepository.save(existingChatRoom);
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
   * Xabarni ID orqali topish.
   */
  async getMessageById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chatRoom', 'sender'],
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
