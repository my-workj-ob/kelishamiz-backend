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
    origin: ['https://kelishamiz.uz'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
})
export class ChatGateway {
  @WebSocketServer() server: Server;

  private onlineUsers: Map<number, string> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: ProfileService,
  ) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = Number(client.handshake.query.userId);
    if (!userId) {
      client.disconnect();
      return;
    }

    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);
    console.log(`User ${userId} connected: ${client.id}`);

    // Yangi ulangan mijozga mavjud online foydalanuvchilar ro'yxatini yuborish
    client.emit('onlineUsersList', Array.from(this.onlineUsers.keys()));

    // Boshqa foydalanuvchilarga yangi foydalanuvchining onlayn bo'lganligini xabar berish
    client.broadcast.emit('userStatusChange', { userId, isOnline: true });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (userId && this.onlineUsers.get(userId) === client.id) {
      this.onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);

      // Barcha foydalanuvchilarga foydalanuvchining oflayn bo'lganligini xabar berish
      this.server.emit('userStatusChange', { userId, isOnline: false });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { chatRoomId: number; senderId: number; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    console.log('Received message:', data);

    try {
      const savedMessage = await this.chatService.saveMessage(
        data.chatRoomId,
        data.senderId,
        data.message,
      );

      this.server.to(data.chatRoomId.toString()).emit('newMessage', {
        id: savedMessage.id,
        chatRoomId: savedMessage.chatRoomId,
        senderId: savedMessage.senderId,
        senderUsername: savedMessage.sender.username,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt.toISOString(),
      });

      client.emit('messageSent', {
        status: 'success',
        messageId: savedMessage.id,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('messageSent', { status: 'error', message: error.message });
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`Client ${client.id} joining room: ${chatRoomId}`);
    client.join(chatRoomId);

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
      client.emit('roomOnlineUsers', onlineParticipants);
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(`Client ${client.id} leaving room: ${chatRoomId}`);
    client.leave(chatRoomId);
  }

  @SubscribeMessage('setOnlineStatus')
  async handleSetOnlineStatus(
    @MessageBody() userId: number,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // `handleConnection` allaqachon bu vazifani bajaradi.
    // Qo'shimcha status o'rnatishga ehtiyoj yo'q, lekin agar kerak bo'lsa,
    // bu yerda mantiqni ushlab qolishingiz mumkin.
    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);
    console.log(
      `User ${userId} manually set online status. Socket: ${client.id}`,
    );
    this.server.emit('userStatusChange', { userId: userId, isOnline: true });
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket): void {
    const onlineUserIds = Array.from(this.onlineUsers.keys());
    client.emit('onlineUsersList', onlineUserIds);
  }

  @SubscribeMessage('typingStarted')
  handleTypingStarted(
    @MessageBody()
    data: { chatRoomId: string; userId: number; username: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      username: data.username,
      isTyping: true,
    });
  }

  @SubscribeMessage('typingStopped')
  handleTypingStopped(
    @MessageBody() data: { chatRoomId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ): void {
    console.log(
      `User ${data.userId} stopped typing in room ${data.chatRoomId}`,
    );
    client.to(data.chatRoomId).emit('typingIndicator', {
      chatRoomId: data.chatRoomId,
      userId: data.userId,
      isTyping: false,
    });
  }
}
