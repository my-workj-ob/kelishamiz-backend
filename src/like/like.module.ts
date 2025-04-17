import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './../comments/entities/comments.entity';
import { Like } from './entities/like.entity';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Comment])],
  controllers: [LikeController],
  providers: [LikeService],
  exports: [LikeService], // ❗️ Boshqa joylarda ishlatish uchun
})
export class LikeModule {}
