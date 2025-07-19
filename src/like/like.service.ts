import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './../comments/entities/comments.entity';
import { Like } from './entities/like.entity';

@Injectable()
export class LikeService {
  constructor(
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
  ) {}

  async toggleLike(commentId: number, userId: number) {
    try {
    
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
        relations: ['likes', 'likes.user'],
      });

      if (!comment) throw new NotFoundException('Comment not found');

    
      const existingLike = await this.likeRepository.findOne({
        where: {
          comment: { id: commentId },
          user: { id: userId },
        },
      });

      let likedByCurrentUser = false;

      if (existingLike) {
    
        await this.likeRepository.remove(existingLike);
        comment.likesCount = Math.max(0, comment.likesCount - 1);
      } else {
    
        const newLike = this.likeRepository.create({
          user: { id: userId },
          comment,
        });
        await this.likeRepository.save(newLike);
        comment.likesCount += 1;
        likedByCurrentUser = true; // Foydalanuvchi like bosgan
      }

    
      await this.commentRepository.update(commentId, {
        likesCount: comment.likesCount,
      });

      return {
        message: existingLike ? 'Like removed' : 'Liked',
        likes: comment.likesCount,
        likedByCurrentUser, // ✅ Frontendga qaytaramiz
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while toggling like: ${error}`,
      );
    }
  }
}
