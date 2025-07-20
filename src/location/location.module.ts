import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { District } from './entities/district.entity';
import { Region } from './entities/region.entity';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { Product } from './../product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Region, District, Product])],
  providers: [LocationService],
  controllers: [LocationController],
})
export class LocationModule {}
