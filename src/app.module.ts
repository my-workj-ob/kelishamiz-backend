import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
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
import { Product } from './product/entities/product.entity';
import { ProductModule } from './product/product.module';
import { ProfileModule } from './profile/profile.module';
import { PropertyController } from './property/property.controller';
import { PropertyModule } from './property/property.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [Category, Product, User, FileEntity, Comment],
      synchronize: true, // faqat development uchun true
    }),
    AuthModule,
    CategoryModule,
    PropertyModule,
    ProductModule,
    FileModule,
    ProfileModule,
    CommentsModule,
  ],

  controllers: [
    AppController,
    PropertyController,
    CategoryController,
    FileController,
  ],
  providers: [AppService],
})
export class AppModule {}
