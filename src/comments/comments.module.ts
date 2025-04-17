import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './../auth/entities/user.entity';
import { Like } from './../like/entities/like.entity';
import { LikeModule } from './../like/like.module';
import { Product } from './../product/entities/product.entity';
import { CommentController } from './comments.controller';
import { CommentService } from './comments.service';
import { Comment } from './entities/comments.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, User, Like, Product]),
    forwardRef(() => LikeModule),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentsModule {}
