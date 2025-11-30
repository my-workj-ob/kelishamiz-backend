import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { Security } from './entities/security.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Security])],
  controllers: [SecurityController],
  providers: [SecurityService],
})
export class SecurityModule {}
