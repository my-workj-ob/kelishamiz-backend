    
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './../auth/entities/user.entity';
import { Profile } from './../profile/enities/profile.entity';
import { Product } from './../product/entities/product.entity';
import { Like } from './../like/entities/like.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Product, Like, UserSearch]), 
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], 
})
export class UserModule {}
