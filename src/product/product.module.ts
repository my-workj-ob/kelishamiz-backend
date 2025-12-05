import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { UploadService } from './../file/uploadService';
import { FileModule } from './../file/file.module';
import { FileService } from './../file/file.service';
import { SearchService } from './../search-filter/search-filter.service';

// Entities
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/Product-Image.entity';
import { ProductProperty } from './entities/product-property.entity';
import { UserViewedProduct } from './entities/product-view.entity';
import { Category } from './../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import { User } from './../auth/entities/user.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { RedisService } from './redis-service';
import { GeoIpService } from './geoip.service';
import { FileEntity } from './../file/entities/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      ProductProperty,
      UserViewedProduct,
      Category,
      Property,
      Profile,
      User,
      UserSearch,
      FileEntity
    ]),
    FileModule,
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    UploadService,
    FileService,
    SearchService,
    RedisService,
    GeoIpService,
  ],
  exports: [ProductService],
})
export class ProductModule {}
