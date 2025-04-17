import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { CategoryController } from './category/category.controller';
import { CategoryModule } from './category/category.module';
import { Category } from './category/entities/category.entity';
import { CommentsModule } from './comments/comments.module';
import { Comment } from './comments/entities/comments.entity';
import { FileEntity } from './file/entities/file.entity';
import { FileController } from './file/file.controller';
import { FileModule } from './file/file.module';
import { LocationModule } from './location/location.module';
import { Product } from './product/entities/product.entity';
import { ProductModule } from './product/product.module';
import { ProfileModule } from './profile/profile.module';
import { PropertyController } from './property/property.controller';
import { PropertyModule } from './property/property.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      entities: [Category, Product, User, FileEntity, Comment],
      synchronize: true,
    }),
    AuthModule,
    CategoryModule,
    PropertyModule,
    ProductModule,
    FileModule,
    ProfileModule,
    CommentsModule,
    LocationModule,
  ],

  controllers: [PropertyController, CategoryController, FileController],
  providers: [AppService],
})
export class AppModule {}
