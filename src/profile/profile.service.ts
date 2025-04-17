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
  ) {}
  async create(
    createProfileDto: CreateProfileDto,
    user: User,
  ): Promise<Profile> {
    const profile = this.profileRepository.create({
      ...createProfileDto,
      user,
    });
    return await this.profileRepository.save(profile);
  }

  async findAll(): Promise<Profile[]> {
    return await this.profileRepository.find();
  }

  async findOne(id: number): Promise<Profile> {
    console.log(id);
    const profile = await this.profileRepository.findOne({
      where: { id },
      relations: ['products', 'products.comments'],
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
    const profile = await this.findOne(id);
    this.profileRepository.merge(profile, updateProfileDto);
    return await this.profileRepository.save(profile);
  }

  async remove(id: number): Promise<void> {
    const profile = await this.findOne(id);
    await this.profileRepository.remove(profile);
  }

  async findByUser(userId: number): Promise<Profile | any> {
    console.log(userId);
    return await this.profileRepository.findOne({
      where: { user: { id: userId } },
      relations: ['comments'],
    });
  }
}
