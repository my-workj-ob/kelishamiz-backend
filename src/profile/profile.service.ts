/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
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
  ) {}

  async create(createProfileDto: CreateProfileDto): Promise<Profile> {
    const profile = this.profileRepository.create({
      ...createProfileDto,
    });
    return await this.profileRepository.save(profile);
  }

  async findAll(): Promise<Profile[]> {
    return await this.profileRepository.find();
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

  // user.service.ts
  async removeUser(id: number): Promise<void> {
    console.log('Deleting user with ID:', id); // 👈 qo‘shing
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
      .from('product_likes_user') // Many-to-Many join table name
      .where('userId = :userId', { userId: id })
      .execute();

    // 3. Remove searches (agar bogʻlangan bo‘lsa)
    await this.searchRepository.delete({ user: { id } });

    // 4. Remove profile’s products
    if (user.profile?.products?.length) {
      const productIds = user.profile.products.map((p) => p.id);
      await this.productRepository.delete(productIds);
    }

    // 5. Remove profile's comments and likes
    if (user.profile?.comments?.length) {
      const commentIds = user.profile.comments.map((c) => c.id);
      await this.commentRepository.delete(commentIds);
    }

    if (user.profile?.likes?.length) {
      const likeIds = user.profile.likes.map((l) => l.id);
      await this.likeRepository.delete(likeIds);
    }

    if (user.profile) {
      if (user.profile?.id !== undefined) {
        console.log(user.profile);
        await this.profileRepository.delete(user.profile.id);
      }
    }

    await this.userRepository.delete(id);
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
