import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from './../auth/entities/user.entity';
import { Profile } from './../profile/enities/profile.entity';
import { Product } from './../product/entities/product.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { Like } from './../like/entities/like.entity';
import { Comment } from 'src/comments/entities/comments.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(User)
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Profile)
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Like) private readonly likeRepository: Repository<Like>,
    @InjectRepository(UserSearch)
    private readonly searchRepository: Repository<UserSearch>,
  ) {}

  async updateUserRole(userId: number, newRole: UserRole): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.role = newRole;
    return this.userRepository.save(user);
  }

  async findUserById(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async findAllUsers(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const [users, total] = await this.userRepository.findAndCount({
      skip: skip,
      take: pageSize,
      select: ['id', 'phone', 'username', 'role', 'regionId', 'districtId'],
    });

    const usersWithoutPassword: Partial<User>[] = users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });

    return { users: usersWithoutPassword, total };
  }

  async updateToken(userId: number, token: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    user.token = token;
    return this.userRepository.save(user);
  }

 
  async deleteUser(id: number): Promise<void> {
    console.log('Deleting user with ID:', id);

    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'profile',
        'profile.products',
        'profile.likes',
        'profile.comments',
        'likes',
        'searches',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('product_likes_user')
      .where('userId = :userId', { userId: id })
      .execute();

    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('chat_room_participants_user')
      .where('userId = :userId', { userId: id })
      .execute();

    await this.searchRepository.delete({ user: { id } });

    if (user.profile?.products?.length) {
      const productIds = user.profile.products.map((p) => p.id);
      await this.productRepository.delete(productIds);
    }

    if (user.profile?.comments?.length) {
      const commentIds = user.profile.comments.map((c) => c.id);
      await this.commentRepository.delete(commentIds);
    }

    if (user.profile?.likes?.length) {
      const likeIds = user.profile.likes.map((l) => l.id);
      await this.likeRepository.delete(likeIds);
    }

    if (user.profile?.id !== undefined) {
      await this.profileRepository.delete(user.profile.id);
    }

    await this.userRepository.delete(id);
  }
}
