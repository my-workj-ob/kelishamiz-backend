import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { SearchService } from './../search-filter/search-filter.service';
import { Profile } from './enities/profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProductService } from './../product/product.service';
import { Product } from './../product/entities/product.entity';
import { Category } from './../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { User } from './../auth/entities/user.entity';
import { FileService } from './../file/file.service';
import { UploadService } from './../file/uploadService';
import { ProductImage } from './../product/entities/Product-Image.entity';
import { FileEntity } from './../file/entities/file.entity';
import { Like } from './../like/entities/like.entity';
import { ProductPropertyDto } from 'src/product/dto/create-product.dto';
import { ProductProperty } from 'src/product/entities/product-property.entity';

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
