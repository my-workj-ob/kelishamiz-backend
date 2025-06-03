// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeORM modulini import qilamiz
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './../auth/entities/user.entity'; // User entityni import qilamiz
import { Profile } from './../profile/enities/profile.entity';
import { Product } from './../product/entities/product.entity';
import { Like } from './../like/entities/like.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Product, Like, UserSearch]), // User entityni ushbu modulda ishlatish uchun
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Agar UserService ni boshqa modullarda ham ishlatmoqchi bo'lsangiz
})
export class UserModule {}
