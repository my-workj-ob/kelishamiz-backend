// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ProfileService } from './../profile/profile.service';

@WebSocketGateway({
  cors: {
    origin: ['https://kelishamiz.uz', 'http://localhost:5173'], // Ishlab chiqarish va rivojlanish uchun URL manzillari
    credentials: true,
    transports: ['websocket', 'polling'],
  },
})
export class ChatGateway {
  @WebSocketServer() server: Server;

  // Online foydalanuvchilarni saqlash uchun Map
  // userId -> SocketId (bir foydalanuvchi bir nechta joydan ulanishi mumkin bo'lsa, bu Map<number, Set<string>> bo'lishi mumkin)
  private onlineUsers: Map<number, string> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: ProfileService, // UserService ni injektatsiya qilish
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
    // Haqiqiy loyihada: foydalanuvchini autentifikatsiya qilish va uning ID sini socketga bog'lash
    // Bu yerda foydalanuvchi IDsi clientga qanday bog'lanishini taxmin qilamiz.
    // Masalan, JWT tokenni tekshirish orqali:
    // const token = client.handshake.auth.token;
    // if (token) {
    //   try {
    //     const user = await this.userService.verifyToken(token); // Tokenni tekshiradigan metod
    //     client.data.userId = user.id;
    //     this.onlineUsers.set(user.id, client.id); // Foydalanuvchini online deb belgilash
    //     console.log(`User ${user.id} connected with socket ${client.id}`);
    //     this.server.emit('userStatusChange', { userId: user.id, isOnline: true }); // Boshqalarga xabar berish
    //   } catch (error) {
    //     console.error('Token verification failed:', error);
    //     client.disconnect(true); // Tasdiqlanmagan foydalanuvchini uzish
    //   }
    // } else {
    //   client.disconnect(true); // Token yo'q bo'lsa, uzish
    // }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Foydalanuvchi IDsi socket.data.userId da saqlangan deb faraz qilamiz
    const userId = client.data.userId;
    if (userId && this.onlineUsers.get(userId) === client.id) {
      this.onlineUsers.delete(userId);
      console.log(
        `User ${userId} disconnected. Online users count: ${this.onlineUsers.size}`,
      );
      this.server.emit('userStatusChange', { userId: userId, isOnline: false }); // Boshqalarga xabar berish
    }
  }

  /**
   * Klientdan 'sendMessage' eventi kelganda.
   * Xabarni saqlaydi va chat xonasidagi barcha foydalanuvchilarga yuboradi.
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { chatRoomId: string; senderId: number; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    console.log('Received message:', data);

    try {
      // Xabarni ma'lumotlar bazasiga saqlash
      const savedMessage = await this.chatService.saveMessage(
        data.chatRoomId,
        data.senderId,
        data.message,
      );

      // Xabarni chat xonasidagi barcha klientlarga yuborish
      this.server.to(data.chatRoomId).emit('newMessage', {
        id: savedMessage.id,
        chatRoomId: savedMessage.chatRoomId,
        senderId: savedMessage.senderId,
        senderUsername: savedMessage.sender.username, // Yuboruvchi username
        content: savedMessage.content,
        createdAt: savedMessage.createdAt.toISOString(), // Frontend uchun ISO formatda
      });

      // Yuboruvchiga xabar yuborilgani haqida tasdiqlash
      client.emit('messageSent', {
        status: 'success',
        messageId: savedMessage.id,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('messageSent', { status: 'error', message: error.message });
    }
  }

  /**
   * Klient chat xonasiga qo'shilmoqchi bo'lganda.
   * Socketni shu xonaga bog'laydi.
   */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`Client ${client.id} joining room: ${chatRoomId}`);
    client.join(chatRoomId);
    // Xonaga qo'shilgani haqida xabardor qilish (opsional)
    // this.server.to(chatRoomId).emit('userJoined', { userId: client.data.userId, chatRoomId });

    // Foydalanuvchi chat xonasiga qo'shilganda, boshqa foydalanuvchilarning online holatini yuborish
    const participantsInRoom =
      this.server.sockets.adapter.rooms.get(chatRoomId);
    if (participantsInRoom) {
      const onlineParticipants = Array.from(participantsInRoom)
        .map((socketId) => {
          const s = this.server.sockets.sockets.get(socketId);
          return s?.data.userId;
        })
        .filter((id) => id && this.onlineUsers.has(id))
        .map((id) => ({ userId: id, isOnline: true }));
      client.emit('roomOnlineUsers', onlineParticipants); // Faqat yangi qo'shilgan klientga yuborish
    }
  }

  /**
   * Klient chat xonasidan chiqmoqchi bo'lganda.
   */
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`Client ${client.id} leaving room: ${chatRoomId}`);
    client.leave(chatRoomId);
    // this.server.to(chatRoomId).emit('userLeft', { userId: client.data.userId, chatRoomId });
  }

  // --- Online/Offline holati funksiyalari ---

  /**
   * Foydalanuvchi o'zining online holatini o'rnatishi uchun.
   * Bu metod JWT token orqali foydalanuvchi IDsi avtomatik o'rnatilmagan bo'lsa foydali.
   */
  @SubscribeMessage('setOnlineStatus')
  async handleSetOnlineStatus(
    @MessageBody() userId: number,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    client.data.userId = userId; // Socketga userId ni bog'lash
    this.onlineUsers.set(userId, client.id);
    console.log(
      `User ${userId} manually set online status. Socket: ${client.id}`,
    );
    this.server.emit('userStatusChange', { userId: userId, isOnline: true }); // Boshqalarga xabar berish
  }

  /**
   * Barcha online foydalanuvchilar ro'yxatini qaytaradi.
   * Bu asosan test yoki ma'lumot olish uchun.
   */
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket): void {
    const onlineUserIds = Array.from(this.onlineUsers.keys());
    client.emit('onlineUsersList', onlineUserIds);
  }

  // --- Yozish holati (Typing Indicator) funksiyalari ---

  /**
   * Foydalanuvchi chat xonasida yozishni boshlaganda.
   * Xabarni o'sha chat xonasidagi boshqa foydalanuvchilarga yuboradi.
   */
  @SubscribeMessage('typingStarted')
  handleTypingStarted(
    @MessageBody()
    data: { chatRoomId: string; userId: number; username: string },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(
      `User ${data.userId} started typing in room ${data.chatRoomId}`,
    );
    // Yozuvchi foydalanuvchidan tashqari barchaga yuborish
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      username: data.username,
      isTyping: true,
    });
  }

  /**
   * Foydalanuvchi chat xonasida yozishni tugatganda.
   * Xabarni o'sha chat xonasidagi boshqa foydalanuvchilarga yuboradi.
   */
  @SubscribeMessage('typingStopped')
  handleTypingStopped(
    @MessageBody() data: { chatRoomId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(
      `User ${data.userId} stopped typing in room ${data.chatRoomId}`,
    );
    // Yozuvchi foydalanuvchidan tashqari barchaga yuborish
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      isTyping: false,
    });
  }
}
