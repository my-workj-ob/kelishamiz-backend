import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PropertyType } from '../entities/property.entity';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Color' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'STRING' })
  @IsString()
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsOptional()
  categoryId: number; // Qo'shimcha ravishda kategoriya ID

  @ApiProperty({ example: 'For property Select ' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}
