import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './../auth/entities/user.entity';
import { UserSearch } from './entities/user-search.entity';

@Injectable()
export class UserSearchRepository extends Repository<UserSearch> {
  constructor(
    @InjectRepository(UserSearch) repository: Repository<UserSearch>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async saveSearch(user: User, query: string): Promise<UserSearch> {
    const search = this.create({ user, query });
    return await this.save(search);
  }

  async getRecentSearches(
    user: User,
    limit: number = 5,
  ): Promise<UserSearch[]> {
    return await this.find({
      where: { user },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAllUserSearches(
    user: User,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<[UserSearch[], number]> {
    const skip = (page - 1) * pageSize;
    return await this.findAndCount({
      where: { user },
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });
  }

  async deleteSearch(id: number, user: User): Promise<void> {
    await this.delete({ id, user });
  }
}
