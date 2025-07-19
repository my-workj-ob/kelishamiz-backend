    
import { Injectable, NotFoundException, Search } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './../auth/entities/user.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './enities/profile.entity';
import { Product } from './../product/entities/product.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { Like } from './../like/entities/like.entity';
import { Comment } from './../comments/entities/comments.entity';
import { ChatRoom } from './../chat/entities/chat-room.entity';

@Injectable()
export class ProfileService {
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
    private readonly searchRepository: Repository<UserSearch>, // agar bor bo‘lsa
    @InjectRepository(ChatRoom)
    private readonly chatRoomParticipantRepository: Repository<ChatRoom>,
  ) {}

  async create(createProfileDto: CreateProfileDto): Promise<Profile> {
    const profile = this.profileRepository.create({
      ...createProfileDto,
    });
    return await this.profileRepository.save(profile);
  }

  async findAll(): Promise<Profile[]> {
    return await this.profileRepository.find({ relations: ['user'] });
  }

  async findOne(id: number): Promise<Profile> {
    const profile = await this.profileRepository.findOne({
      where: { id },
      relations: ['likes'],
    });
    if (!profile) {
      throw new NotFoundException(`Profil ${id} bilan topilmadi`);
    }
    return profile;
  }

  async update(
    id: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Profile> {
    const profile = await this.profileRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException('Profil topilmadi');
    }

    Object.assign(profile, updateProfileDto);
    const updatedProfile = await this.profileRepository.save(profile);

    const { regionId, districtId } = updateProfileDto;
    if (regionId || districtId) {
      if (profile.user?.id) {
        await this.userRepository.update(profile.user.id, {
          ...(regionId && { regionId }),
          ...(districtId && { districtId }),
        });
      }
    }

    return updatedProfile;
  }

    
  async removeUser(userId: number): Promise<void> {
    console.log(userId, 'User ID to remove');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'profile',
        'profile.products',
        'profile.likes',
        'profile.comments',
        'likes',
        'searches',
        'messages',
        'notifications',
        'transactions',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('product_likes_user')
      .where('userId = :userId', { userId })
      .execute();

    
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from('user_viewed_product')
      .where('userId = :userId', { userId })
      .execute();

    
    await this.searchRepository.delete({ user: { id: userId } });

    await this.userRepository.delete(userId);
    
    if (user.profile?.comments?.length) {
      await this.commentRepository.delete(
        user.profile.comments.map((c) => c.id),
      );
    }

    if (user.profile?.likes?.length) {
      await this.likeRepository.delete(user.profile.likes.map((l) => l.id));
    }

    
    if (user.profile?.products?.length) {
      await this.productRepository.delete(
        user.profile.products.map((p) => p.id),
      );
    }

    
    if (user.profile?.id) {
      await this.profileRepository.delete(user.profile.id);
    }

    await this.dataSource.query(
      `DELETE FROM chat_room_participants_user WHERE "userId" = $1`,
      [userId],
    );
    
    await this.userRepository.delete(userId);
  }

  async findByUser(userId: number): Promise<Profile | any> {
    const existUser = await this.profileRepository.findOne({
      where: { user: { id: userId } },
      relations: ['region', 'district', 'user'],
    });

    if (!existUser) {
      throw new NotFoundException(`Foydalanuvchi ${userId} bilan topilmadi`);
    }

    return existUser;
  }
}
