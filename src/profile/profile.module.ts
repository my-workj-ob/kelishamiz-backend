import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { SearchService } from './../search-filter/search-filter.service';
import { Profile } from './enities/profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProductService } from 'src/product/product.service';
import { Product } from 'src/product/entities/product.entity';
import { Category } from 'src/category/entities/category.entity';
import { Property } from 'src/category/entities/property.entity';
import { User } from 'src/auth/entities/user.entity';
import { FileService } from 'src/file/file.service';
import { UploadService } from 'src/file/uploadService';
import { ProductImage } from 'src/product/entities/Product-Image.entity';
import { FileEntity } from 'src/file/entities/file.entity';
import { Like } from 'src/like/entities/like.entity';

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
    ]),
  ],
  providers: [
    ProfileService,
    SearchService,
    ProductService,
    FileService,
    UploadService,
  ],
  controllers: [ProfileController],
  exports: [ProfileService], // Agar boshqa modullarga ham kerak bo'lsa
})
export class ProfileModule {}
