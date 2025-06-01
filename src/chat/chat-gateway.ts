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

  private onlineUsers: Map<number, string> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: ProfileService, // UserService ni injektatsiya qilish
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
 
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId = client.data.userId;
    if (userId && this.onlineUsers.get(userId) === client.id) {
      this.onlineUsers.delete(userId);
      console.log(
        `User ${userId} disconnected. Online users count: ${this.onlineUsers.size}`,
      );
      this.server.emit('userStatusChange', { userId: userId, isOnline: false }); // Boshqalarga xabar berish
    }
  }

  
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { chatRoomId: string; senderId: number; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    console.log('Received message:', data);

    try {
      const savedMessage = await this.chatService.saveMessage(
        data.chatRoomId,
        data.senderId,
        data.message,
      );

      this.server.to(data.chatRoomId).emit('newMessage', {
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
    client.data.userId = userId; // Socketga userId ni bog'lash
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
    console.log(
      `User ${data.userId} started typing in room ${data.chatRoomId}`,
    );
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
