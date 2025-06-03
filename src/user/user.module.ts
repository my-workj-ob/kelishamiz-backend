// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // TypeORM modulini import qilamiz
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './../auth/entities/user.entity'; // User entityni import qilamiz

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // User entityni ushbu modulda ishlatish uchun
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Agar UserService ni boshqa modullarda ham ishlatmoqchi bo'lsangiz
})
export class UserModule {}
