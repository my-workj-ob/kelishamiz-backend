import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './enities/profile.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([Profile])],
  providers: [ProfileService],
  controllers: [ProfileController],
  exports: [ProfileService], // Agar boshqa modullarga ham kerak bo'lsa
})
export class ProfileModule {}
