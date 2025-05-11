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
import { UserSearch } from './search-filter/entities/user-search.entity';
import { SearchFilterController } from './search-filter/search-filter.controller';
import { SearchModule } from './search-filter/search-filter.module';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      entities: [Category, Product, User, FileEntity, Comment, UserSearch],
      synchronize: true,
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: (await import('cache-manager-redis-store')).default,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: 600,
      }),
    }),
    AuthModule,
    CategoryModule,
    PropertyModule,
    ProductModule,
    FileModule,
    ProfileModule,
    CommentsModule,
    LocationModule,
    SearchModule,
  ],

  controllers: [
    PropertyController,
    CategoryController,
    FileController,
    SearchFilterController,
  ],
  providers: [AppService],
})
export class AppModule {}
