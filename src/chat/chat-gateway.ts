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

@WebSocketGateway({
  cors: {
    origin: 'https://kelishamiz.uz', // Ishlab chiqarishda frontend URL manziliga
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(@ConnectedSocket() client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
    // Haqiqiy loyihada: foydalanuvchini autentifikatsiya qilish va uning ID sini socketga bog'lash
    // client.handshake.auth.token orqali token kelishi mumkin
    // const userId = verifyToken(client.handshake.auth.token);
    // client.data.userId = userId;
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
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
    this.server
      .to(chatRoomId)
      .emit('userJoined', { userId: client.id, chatRoomId });
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
    this.server
      .to(chatRoomId)
      .emit('userLeft', { userId: client.id, chatRoomId });
  }

  // Boshqa chatga oid eventlar (masalan, typing indicator, read receipts)
}
