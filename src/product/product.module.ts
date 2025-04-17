import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Property } from 'src/category/entities/property.entity';
import { Profile } from 'src/profile/enities/profile.entity';
import { Category } from '../category/entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Profile, User, Category, Property]),
  ],
  exports: [ProductService],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
