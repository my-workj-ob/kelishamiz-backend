    
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeORM modulini import qiling
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { Message } from './entities/message.entity';
import { User } from './../auth/entities/user.entity';
import { Product } from './../product/entities/product.entity';
import { ChatGateway } from './chat-gateway';
import { ProfileService } from './../profile/profile.service';
import { Profile } from './../profile/enities/profile.entity';
import { Like } from './../like/entities/like.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
    

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      Message,
      User,
      Product,
      Profile,
      Like,
      UserSearch,
    ]), // Repository-larni ta'minlaydi
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ProfileService],
})
export class ChatModule {}
