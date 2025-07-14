import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { User } from './../auth/entities/user.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { SearchService } from './../search-filter/search-filter.service';
import { ProductProperty } from './entities/product-property.entity';
import { Product } from './entities/product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { UploadService } from './../file/uploadService';
import { FileModule } from './../file/file.module';
import { ProductImage } from './entities/Product-Image.entity';
import { UserViewedProduct } from './entities/product-view.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Profile,
      User,
      Category,
      Property,
      UserSearch,
      ProductProperty,
      ProductImage,
      UserViewedProduct,
    ]),
    FileModule,
  ],
  exports: [ProductService],
  controllers: [ProductController],
  providers: [ProductService, SearchService, UploadService],
})
export class ProductModule {}
