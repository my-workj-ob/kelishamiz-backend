// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection, // Qo'shildi
  OnGatewayDisconnect, // Qo'shildi
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ProfileService } from './../profile/profile.service'; // userService sifatida ishlatiladi

// Interfeyslarni aniqlash (Typescript uchun yaxshi amaliyot)
interface MessagePayload {
  chatRoomId: number;
  messageId: string;
  readerId: number;
}

interface TypingPayload {
  chatRoomId: string;
  userId: number;
  username?: string;
}

@WebSocketGateway({
  cors: {
    origin: ['https://kelishamiz.uz', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect { // Interfeyslar qo'shildi
  @WebSocketServer() server: Server;

  // Foydalanuvchi ID si (number) va Socket ID si (string)
  private onlineUsers: Map<number, string> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: ProfileService, // ProfileService (foydalanuvchi ma'lumotlari uchun)
  ) {}

  // --- 1. Ulanish va Uzilish Logikasi (Mijoz ulanishi va uzilishi) ---

  /** Mijoz ulanishi */
  handleConnection(@ConnectedSocket() client: Socket) {
    // userId ni so'rov parametrlaridan olish
    const userId = Number(client.handshake.query.userId);

    if (!userId || isNaN(userId)) {
      console.log('Connection rejected: Invalid or missing userId');
      client.disconnect();
      return;
    }

    // Soket ma'lumotlariga userId ni saqlash
    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);

    console.log(`User ${userId} connected: ${client.id}`);

    // Faqat o'ziga onlayn foydalanuvchilar ro'yxatini yuborish
    client.emit('onlineUsersList', Array.from(this.onlineUsers.keys()));
    // Boshqalarga status o'zgarganini xabar qilish
    client.broadcast.emit('userStatusChange', { userId, isOnline: true });
  }

  /** Mijoz uzilishi */
  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (userId && this.onlineUsers.get(userId) === client.id) {
      this.onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
      // Barchaga status o'zgarganini xabar qilish
      this.server.emit('userStatusChange', { userId, isOnline: false });
    }
  }

  // --- 2. Chat Xonasiga Kirish/Chiqish ---

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId) {
      console.log('User ID not found in client data.');
      return;
    }

    console.log(
      `Client ${client.id} (User: ${userId}) joining room: ${chatRoomId}`,
    );
    client.join(chatRoomId);

    try {
      // Yangi xonaga kirganda o'qilmagan xabarlarni o'qilgan deb belgilash
      await this.chatService.markMessagesAsRead(Number(chatRoomId), userId);

      // O'qilmagan xabarlar umumiy sonini yangilash
      const unreadCount = await this.chatService.getUnreadMessageCount(userId);
      client.emit('unreadCountUpdate', { unreadCount });
      
      // Xona ishtirokchilariga onlayn foydalanuvchilar haqida ma'lumot yuborish (mavjud kod)
      const participantsInRoom =
        this.server.sockets?.adapter?.rooms.get(chatRoomId);

      if (participantsInRoom) {
        const onlineParticipants = Array.from(participantsInRoom)
          .map((socketId) => {
            const socket = this.server.sockets.sockets.get(socketId);
            return socket?.data?.userId as number | undefined;
          })
          .filter((id) => id && this.onlineUsers.has(id))
          .map((id) => ({ userId: id, isOnline: true }));

        client.emit('roomOnlineUsers', onlineParticipants);
      }
    } catch (error) {
      console.error('Error during joinRoom process:', error);
    }
  }

  /** Xonadan chiqish */
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`Client ${client.id} leaving room: ${chatRoomId}`);
    client.leave(chatRoomId);
  }

  // --- 3. Xabarlashuv Funksiyalari ---

  /** Xabar yuborish */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { chatRoomId: number; senderId: number; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    console.log('Received message:', data);

    try {
      // 1. Xabarni DB ga saqlash
      const savedMessage = await this.chatService.saveMessage(
        data.chatRoomId,
        data.senderId,
        data.message,
      );

      // 2. Xona ishtirokchilariga yangi xabar kelganini xabar qilish
      this.server.to(data.chatRoomId.toString()).emit('newMessage', {
        id: savedMessage.id,
        chatRoomId: savedMessage.chatRoomId,
        senderId: savedMessage.senderId,
        senderUsername: savedMessage.sender.username,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt.toISOString(),
        read: savedMessage.read,
      });

      // 3. Yuboruvchiga muvaffaqiyat statusini yuborish
      client.emit('messageSent', {
        status: 'success',
        messageId: savedMessage.id,
      });

      // 4. Chatning boshqa ishtirokchilariga **Xabarlar ro'yxatini yangilash** xabarini yuborish (qo'shimcha logikaga muvofiq)
      const chatRoom = await this.chatService.getChatRoomParticipants(data.chatRoomId);
      if (chatRoom) {
        chatRoom.participants.forEach(participant => {
          if (participant.id !== data.senderId) {
            const receiverSocketId = this.onlineUsers.get(participant.id);
            if (receiverSocketId) {
              // FAQAT xabarlar ro'yxatini yangilash xabari
              this.server.to(receiverSocketId).emit('refreshMessageList', { chatRoomId: data.chatRoomId });
            }
          }
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('messageSent', { status: 'error', message: error.message });
    }
  }

  /** Xabar o'qildi */
  @SubscribeMessage('readMessage')
  async handleReadMessage(
    @MessageBody()
    data: MessagePayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      // 1. O'qilganlik holatini o'zgartirish
      await this.chatService.markMessageAsRead(data.messageId, data.readerId);

      // 2. Xabar haqida ma'lumot olish
      const message = await this.chatService.getMessageById(data.messageId);

      if (message && message.sender) {
        // 3. Xabarning yuboruvchisiga xabar o'qilgani haqida ma'lumot yuborish
        const senderSocketId = this.onlineUsers.get(message.sender.id);
        if (senderSocketId) {
          // Xabar o'qilgani haqidagi bildirishnoma
          this.server.to(senderSocketId).emit('messageRead', {
            messageId: data.messageId,
            chatRoomId: data.chatRoomId,
            readerId: data.readerId,
          });
          
          // Ulanish 3: Xabar o'qilganda, yuboruvchiga **Xabarlar ro'yxatini yangilash** xabarini yuborish.
          this.server.to(senderSocketId).emit('refreshMessageList', { chatRoomId: data.chatRoomId });
          
        }
      }
    } catch (error) {
      console.error('Error handling readMessage event:', error);
    }
  }

  /** Foydalanuvchi yozishni boshladi */
  @SubscribeMessage('typingStarted')
  handleTypingStarted(@MessageBody() data: TypingPayload, @ConnectedSocket() client: Socket): void {
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      username: data.username,
      isTyping: true,
    });
  }

  /** Foydalanuvchi yozishni to‘xtatdi */
  @SubscribeMessage('typingStopped')
  handleTypingStopped(@MessageBody() data: { chatRoomId: string; userId: number }, @ConnectedSocket() client: Socket): void {
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      isTyping: false,
    });
  }

  // --- 4. O'chirish Funksiyalari (Talablarga asoslangan) ---

  /** Xabarni o'chirish */
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // 1. Xabarni yumshoq o'chirish (Soft Delete)
      await this.chatService.softDeleteMessage(data.messageId, data.userId);

      // 2. O'chirilgan xabar ma'lumotlarini olish
      const message = await this.chatService.getDeletedMessageById(data.messageId);

      if (message && message.chatRoom && message.sender) {
        const chatRoomId = message.chatRoom.id;

        // 3. Xabar o'chirilgani haqida xona ishtirokchilariga ma'lumot yuborish
        this.server
          .to(chatRoomId.toString())
          .emit('messageDeleted', { messageId: data.messageId });
        
        // 4. Ulanish 2: Chatning boshqa ishtirokchilariga **Xabarlar ro'yxatini yangilash** xabarini yuborish
        const chatRoom = await this.chatService.getChatRoomParticipants(chatRoomId);
        if (chatRoom) {
            chatRoom.participants.forEach(participant => {
                if (participant.id !== data.userId) { // O'chirgan foydalanuvchidan tashqari
                    const receiverSocketId = this.onlineUsers.get(participant.id);
                    if (receiverSocketId) {
                        this.server.to(receiverSocketId).emit('refreshMessageList', { chatRoomId });
                    }
                }
            });
        }
      }

      client.emit('messageDeleteStatus', {
        status: 'success',
        message: 'Xabar muvaffaqiyatli oʻchirildi.',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      client.emit('messageDeleteStatus', {
        status: 'error',
        message: 'Xabar oʻchirilmadi: ' + error.message,
      });
    }
  }

  /** Chat xonasini o'chirish */
  @SubscribeMessage('deleteChatRoom')
  async handleDeleteChatRoom(
    @MessageBody() data: { chatRoomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // 1. O'chiriladigan chat ishtirokchilarini olish
      const chatRoom = await this.chatService.getChatRoomParticipants(data.chatRoomId);
      
      // 2. Chat xonasini yumshoq o'chirish
      await this.chatService.softDeleteChatRoom(data.chatRoomId, data.userId);

      // 3. Xonadan hamma foydalanuvchilarni chiqarish (ixtiyoriy, lekin yaxshi amaliyot)
      this.server.to(data.chatRoomId.toString()).socketsLeave(data.chatRoomId.toString());

      // 4. O'chirilish haqida xona ishtirokchilariga xabar berish
      this.server
        .to(data.chatRoomId.toString())
        .emit('chatRoomDeleted', { chatRoomId: data.chatRoomId });

      // 5. Ulanish 1: Chat ishtirokchilariga **Chatlar ro'yxatini yangilash** xabarini yuborish
      if (chatRoom && chatRoom.participants) {
        chatRoom.participants.forEach(participant => {
          
          if (participant.id !== data.userId) { 
            const receiverSocketId = this.onlineUsers.get(participant.id);
            if (receiverSocketId) {
              this.server.to(receiverSocketId).emit('refreshChatList'); // Faqat chat ro'yxatini yangilash
            }
          }
        });
      }

      client.emit('chatRoomDeleteStatus', {
        status: 'success',
        message: 'Chat xonasi muvaffaqiyatli oʻchirildi.',
      });
    } catch (error) {
      console.error('Error deleting chat room:', error);
      client.emit('chatRoomDeleteStatus', {
        status: 'error',
        message: 'Xato: ' + error.message,
      });
    }
  }
}