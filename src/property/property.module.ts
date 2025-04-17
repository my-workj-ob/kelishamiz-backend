import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Category])],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
