import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSearch } from './../search-filter/entities/user-search.entity';
import { SearchService } from './../search-filter/search-filter.service';
import { Profile } from './enities/profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, UserSearch])],
  providers: [ProfileService, SearchService],
  controllers: [ProfileController],
  exports: [ProfileService], // Agar boshqa modullarga ham kerak bo'lsa
})
export class ProfileModule {}
