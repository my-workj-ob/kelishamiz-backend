import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SearchService } from './../search-filter/search-filter.service';
import { FileService } from './../file/file.service';
import { UploadService } from './../file/uploadService';
import { ProductModule } from './../product/product.module';

// Entities
import { Profile } from './enities/profile.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { Product } from './../product/entities/product.entity';
import { Category } from './../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { User } from './../auth/entities/user.entity';
import { ProductImage } from './../product/entities/Product-Image.entity';
import { FileEntity } from './../file/entities/file.entity';
import { Like } from './../like/entities/like.entity';
import { ProductProperty } from './../product/entities/product-property.entity';
import { ChatRoom } from './../chat/entities/chat-room.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profile,
      UserSearch,
      Product,
      Category,
      Property,
      User,
      ProductImage,
      FileEntity,
      Like,
      ProductProperty,
      ChatRoom,
    ]),
    ProductModule, 
  ],
  controllers: [ProfileController],
  providers: [ProfileService, SearchService, FileService, UploadService],
  exports: [ProfileService],
})
export class ProfileModule {}
