import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSearch } from './entities/user-search.entity';
import { SearchService } from './search-filter.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSearch])],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
