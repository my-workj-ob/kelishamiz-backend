import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  name: string;
  @ApiProperty({ example: 'img url' })
  @IsString()
  imageUrl: string;
  @ApiProperty({
    example: '1',
    description: 'Parent category ID',
    required: false,
  })
  @IsOptional()
  parentId?: number;
}
