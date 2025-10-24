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
    origin: ['https://kelishamiz.uz', 'http://localhost:5173'],
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
  ) { }


  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = Number(client.handshake.query.userId);

    if (!userId) {
      client.disconnect();
      return;
    }

    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);

    console.log(`User ${userId} connected: ${client.id}`);

    client.emit('onlineUsersList', Array.from(this.onlineUsers.keys()));
    client.broadcast.emit('userStatusChange', { userId, isOnline: true });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (userId && this.onlineUsers.get(userId) === client.id) {
      this.onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
      this.server.emit('userStatusChange', { userId, isOnline: false });
    }
  }

  @SubscribeMessage('readMessage')
  async handleReadMessage(
    @MessageBody()
    data: { chatRoomId: number; messageId: string; readerId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      await this.chatService.markMessageAsRead(data.messageId, data.readerId);

      const message = await this.chatService.getMessageById(data.messageId);

      if (message) {
        const senderSocketId = this.onlineUsers.get(message.sender.id);
        if (senderSocketId) {
          this.server.to(senderSocketId).emit('messageRead', {
            messageId: data.messageId,
            chatRoomId: data.chatRoomId,
            readerId: data.readerId,
          });
        }
      }
    } catch (error) {
      console.error('Error handling readMessage event:', error);
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
        read: savedMessage.read,
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
      await this.chatService.markMessagesAsRead(Number(chatRoomId), userId);

      const unreadCount = await this.chatService.getUnreadMessageCount(userId);
      client.emit('unreadCountUpdate', { unreadCount });
      console.log(
        `User ${userId} total unread count updated to: ${unreadCount}`,
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }

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
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() chatRoomId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(chatRoomId);
  }

  @SubscribeMessage('setOnlineStatus')
  handleSetOnlineStatus(
    @MessageBody() userId: number,
    @ConnectedSocket() client: Socket,
  ): void {
    client.data.userId = userId;
    this.onlineUsers.set(userId, client.id);


    this.server.emit('userStatusChange', { userId, isOnline: true });
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket): void {
    client.emit('onlineUsersList', Array.from(this.onlineUsers.keys()));
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

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.chatService.softDeleteMessage(data.messageId, data.userId);

      const message = await this.chatService.getMessageById(data.messageId);

      if (message && message.chatRoom) {
        this.server
          .to(message.chatRoom.id.toString())
          .emit('messageDeleted', { messageId: data.messageId });
      }

      client.emit('messageDeleteStatus', {
        status: 'success',
        message: 'Xabar muvaffaqiyatli oʻchirildi.',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      client.emit('messageDeleteStatus', {
        status: 'error',
        message: 'Xabar oʻchirilmadi: ',
      });
    }
  }



  @SubscribeMessage('deleteChatRoom')
  async handleDeleteChatRoom(
    @MessageBody() data: { chatRoomId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const chatRoom = await this.chatService.getChatRoomById(data.chatRoomId);
      const participantUserIds: number[] = chatRoom
        ? chatRoom.participants.map(p => p.id)
        : [];

      await this.chatService.softDeleteChatRoom(data.chatRoomId, data.userId);


      this.server
        .to(data.chatRoomId.toString())
        .emit('chatRoomDeleted', { chatRoomId: data.chatRoomId });

      participantUserIds.forEach(pId => {
        if (pId !== data.userId) {
          const participantSocketId = this.onlineUsers.get(pId);
          if (participantSocketId) {
            this.server.to(participantSocketId).emit('chatRoomDeletedForUser', {
              chatRoomId: data.chatRoomId,
              deletedByUserId: data.userId
            });
          }
        }
      });


      client.emit('chatRoomDeleteStatus', {
        status: 'success',
        message: 'Chat xonasi muvaffaqiyatli oʻchirildi.',
      });
    } catch (error) {
      console.error('Error deleting chat room:', error);
      client.emit('chatRoomDeleteStatus', {
        status: 'error',
        message: error.message || 'Xato yuz berdi.',
      });
    }
  }

}
