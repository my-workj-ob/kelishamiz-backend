    
    
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserSearch } from './entities/user-search.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(UserSearch)
    private readonly userSearchRepository: Repository<UserSearch>,
  ) {}

  async saveSearch(user: any, query: string): Promise<UserSearch> {
    const search = this.userSearchRepository.create({
      user: { id: user.userId }, 
      query,
    });
    return await this.userSearchRepository.save(search);
  }

  async getRecentSearches(user: User, limit: number = 10): Promise<string[]> {
    const searches = await this.userSearchRepository.find({
      where: {
        user: {
          id: user.id,
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return [...new Set(searches.map((search) => search.query))];
  }

  async getAllUserSearches(
    userId: number,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ data: string[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const [searches, total] = await this.userSearchRepository.findAndCount({
      where: {
        user: { id: userId },
      },
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });
    return {
      data: searches.map((search) => search.query),
      total,
    };
  }

  async deleteSearch(searchId: number, user: User): Promise<void> {
    await this.userSearchRepository.delete({ id: searchId, user });
  }
}
