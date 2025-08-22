import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoryController } from './category/category.controller';
import { CategoryModule } from './category/category.module';
import { CommentsModule } from './comments/comments.module';
import { FileController } from './file/file.controller';
import { FileModule } from './file/file.module';
import { LocationModule } from './location/location.module';
import { ProductModule } from './product/product.module';
import { ProfileModule } from './profile/profile.module';
import { PropertyController } from './property/property.controller';
import { PropertyModule } from './property/property.module';
// import { UserSearch } from './search-filter/entities/user-search.entity';
import { SearchFilterController } from './search-filter/search-filter.controller';
import { SearchModule } from './search-filter/search-filter.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { BannerModule } from './banner/banner.module';
import { PaymeModule } from './payme/payme.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
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

    // TypeOrmModule.forRoot({
    //   type: 'postgres',
    //   host: 'localhost', // yoki 127.0.0.1
    //   port: 5432,
    //   username: 'postgres', // bu sizning lokal PostgreSQL foydalanuvchingiz
    //   password: '0000', // bu yerga sizning lokal postgres parolingiz
    //   database: 'kelishamiz', // bu yerga lokal bazangiz nomini yozing
    //   synchronize: true, // true faqat dev uchun, prod-da false bo'lishi kerak
    //   autoLoadEntities: true,
    // }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
      autoLoadEntities: true,
    }),
    // s

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
    ChatModule,
    NotificationModule,
    UserModule,
    BannerModule,
    PaymeModule,
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
