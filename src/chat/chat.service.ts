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

  // --- 1. CHAT XONASI OPERATSIYALARI ---

  /**
   * Foydalanuvchi ishtirok etgan barcha chat xonalarini topadi.
   */
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
      // Faqat o'chirilmagan oxirgi xabarni oladi
      const lastMessage = await this.messageRepository.findOne({
        where: { chatRoomId: room.id, isDeleted: false },
        order: { createdAt: 'DESC' },
        relations: ['sender'],
      });

      // Faqat sizga yuborilgan va o'qilmagan xabarlarni sanaydi
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
        // Chat ro'yxatida xabarni belgilash uchun INDEX
        index: (() => {
          if (!lastMessage) return 0;
          if (!lastMessage.read && lastMessage.sender.id !== userId) return 3; // O'qilmagan kiruvchi xabar
          if (lastMessage.sender.id === userId) return 1; // Siz yuborgan xabar
          if (lastMessage.sender.id !== userId) return 2; // O'qilgan kiruvchi xabar
          return 0;
        })(),
      };
    };

    const mappedRooms = await Promise.all(allChatRooms.map(mapChatRoom));
    return mappedRooms;
  }

  /**
   * YANGI FUNKSIYA: Chat xonasi ishtirokchilarini olish.
   * ChatGateway da 'deleteChatRoom' va 'sendMessage' uchun kerak.
   */
  async getChatRoomParticipants(chatRoomId: number): Promise<ChatRoom | null> {
    return this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['participants'],
    });
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

    // Mavjud chatni qidirish logikasi
    const existingChatRoom = await this.chatRoomRepository
      .createQueryBuilder('chatRoom')
      .innerJoin('chatRoom.participants', 'participant1')
      .innerJoin('chatRoom.participants', 'participant2')
      .where('chatRoom.productId = :productId', { productId })
      .andWhere('participant1.id = :id1', { id1: participantIds[0] })
      .andWhere('participant2.id = :id2', { id2: participantIds[1] })
      .getOne();

    if (existingChatRoom) {
      // Agar topilsa, uning o'chirilgan holatini bekor qilish
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
   * Chat xonasini yumshoq o'chirish (isDeleted: true).
   */
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

  // --- 2. XABAR OPERATSIYALARI ---

  /**
   * Muayyan chatdagi xabarlarni sahifalash bilan olish.
   */
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
      // Xabar ko'rsatish holatini belgilash uchun INDEX
      index: chatRoom.isDeleted
        ? 4 // Chat o'chirilgan
        : !msg.read && msg.sender.id !== userId
        ? 3 // O'qilmagan kiruvchi xabar
        : msg.sender.id === userId
        ? 1 // Siz yuborgan xabar
        : 2, // Boshqa ishtirokchi yuborgan o'qilgan xabar
    }));
  }

  /**
   * Xabarni saqlash va chat xonasining yangilanish vaqtini yangilash.
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
      read: false, // Yangi xabar avvaliga o'qilmagan bo'ladi
    });

    const savedMessage = await this.messageRepository.save(newMessage);

    // Chat xonasining updated at vaqtini yangilash (chat ro'yxatini sort qilish uchun muhim)
    chatRoom.updatedAt = new Date();
    await this.chatRoomRepository.save(chatRoom);

    return savedMessage;
  }

  /**
   * Xabarni ID orqali topish.
   */
  async getMessageById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId, isDeleted: false }, // Faqat o'chirilmagan xabarni oladi
      relations: ['sender'],
    });
  }

  /**
   * YANGI FUNKSIYA: Xabarni ID orqali Chat xonasi ma'lumotlari bilan topish.
   * ChatGateway da 'deleteMessage' uchun kerak.
   */
  async getMessageWithRoom(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chatRoom', 'sender'],
    });
  }

  /**
   * YANGI FUNKSIYA: Xabarni o'chirilgan holatda ID orqali topish.
   * ChatGateway da 'deleteMessage' eventidan keyin xona ID sini topish uchun kerak.
   */
  async getDeletedMessageById(messageId: string): Promise<Message | null> {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chatRoom', 'sender'],
    });
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

  // --- 3. O'QILGANLIK HOLATI OPERATSIYALARI ---

  /**
   * Muayyan xabarni o'qilgan deb belgilash.
   */
  async markMessageAsRead(messageId: string, readerId: number): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });

    if (!message) {
      throw new NotFoundException('Xabar topilmadi.');
    }

    // Faqat xabar yuboruvchisi bo'lmagan foydalanuvchi uni o'qiganida o'zgartirish
    if (message.sender.id === readerId) {
      // O'z xabarini o'qishga urinish xato hisoblanmaydi, shunchaki o'tkazib yuboriladi
      return; 
    }

    await this.messageRepository.update(
      { id: messageId, read: false },
      { read: true },
    );
  }

  /**
   * Muayyan chatdagi barcha kiruvchi xabarlarni o'qilgan deb belgilash.
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
        senderId: Not(userId), // Faqat boshqa foydalanuvchi yuborgan xabarlar
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
}