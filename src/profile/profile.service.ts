/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './../auth/entities/user.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './enities/profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'profile',
        'profile.products',
        'region',
        'district',
        'likes',
        'viewedProducts',
        'searches',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user); // bu orqali profile ham, product ham o‘chadi
  }

  async findByUser(userId: number): Promise<Profile | any> {
    return await this.profileRepository.findOne({
      where: { user: { id: userId } },
      relations: ['region', 'district'],
    });
  }
}
