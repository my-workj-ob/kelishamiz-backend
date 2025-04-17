/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from './../auth/entities/user.entity';
import { Like } from './../like/entities/like.entity';
import { Product } from './../product/entities/product.entity';
import { Comment } from './entities/comments.entity';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async getComments(
    entityId: number,
    entityType: string,
    userId: number, // Foydalanuvchi ID si
    page = 1,
    limit = 10,
  ) {
    try {
      const [comments, count] = await this.commentRepository.findAndCount({
        where: { entityId, entityType, parentComment: IsNull() },
        relations: [
          'user',
          'user.profile',
          'replies',
          'replies.user',
          'replies.user.profile',
          'replies.likes', // ✅ Replies uchun like-larni qo‘shamiz
          'replies.likes.user', // ✅ Replies uchun like bosgan userlar ham kerak
          'likes',
          'likes.user',
        ],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });

      // Har bir komment va reply-ga `likedByCurrentUser` qo‘shamiz
      const commentsWithLikeStatus = comments.map((comment) => ({
        ...comment,
        likedByCurrentUser: comment.likes.some(
          (like) => like.user.id === userId,
        ),
        replies: comment.replies.map((reply) => ({
          ...reply,
          likedByCurrentUser: reply.likes.some(
            (like) => like.user.id === userId,
          ), // ✅ Replies uchun like bor yoki yo‘qligini tekshiramiz
        })),
      }));

      return {
        comments: commentsWithLikeStatus,
        total: count,
        hasNextPage: count > page * limit,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while fetching comments: ${error.message}`,
      );
    }
  }

  async createComment(
    userPayload: User,
    entityId: number,
    entityType: string,
    content: string,
    parentCommentId?: number | null,
  ) {
    try {
      const userId = (userPayload as any).userId;
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['profile'],
      });

      if (!user) throw new NotFoundException('User not found');

      let parentComment: Comment | null = null;
      if (parentCommentId) {
        parentComment = await this.commentRepository.findOne({
          where: { id: parentCommentId },
          relations: ['user', 'user.profile'],
        });

        if (!parentComment)
          throw new NotFoundException('Parent comment not found');
      }

      const comment = this.commentRepository.create({
        user,
        entityId,
        entityType,
        content,
        likesCount: 0,
        parentComment: parentComment || undefined,
      });

      const savedComment = await this.commentRepository.save(comment);

      // 👉 Agar entityType "product" bo'lsa, commentsCount ni oshiramiz
      if (entityType === 'product') {
        await this.productRepository.increment(
          { id: entityId },
          'commentsCount',
          1,
        );
      }

      return savedComment;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while creating comment: ${error.message}`,
      );
    }
  }

  async deleteComment(commentId: number) {
    try {
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
        relations: ['user'],
      });

      if (!comment) throw new NotFoundException('Comment not found');

      return await this.commentRepository.remove(comment);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while deleting comment: ${error.message}`,
      );
    }
  }

  async likeComment(commentId: number, userId: number) {
    try {
      // Kommentni olish
      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
        relations: ['likes', 'likes.user'],
      });

      if (!comment) throw new NotFoundException('Comment not found');

      // Like bosilganmi?
      const existingLike = await this.likeRepository.findOne({
        where: {
          comment: { id: commentId },
          user: { id: userId },
        },
      });

      let likedByCurrentUser = false;

      if (existingLike) {
        // ❌ Unlike qilish
        await this.likeRepository.remove(existingLike);
        comment.likesCount = Math.max(0, comment.likesCount - 1);
      } else {
        // ✅ Like qo‘shish
        const newLike = this.likeRepository.create({
          user: { id: userId },
          comment,
        });
        await this.likeRepository.save(newLike);
        comment.likesCount += 1;
        likedByCurrentUser = true; // Foydalanuvchi like bosgan
      }

      // Yangi like sonini yangilash
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
