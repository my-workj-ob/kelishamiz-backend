// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeORM modulini import qiling
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { Message } from './entities/message.entity';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { ChatGateway } from './chat-gateway';
// Entity-laringizni import qiling

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, Message, User, Product]), // Repository-larni ta'minlaydi
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
