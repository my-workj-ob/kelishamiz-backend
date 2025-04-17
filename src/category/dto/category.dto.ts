import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  name: string;

  @ApiProperty({
    example: '1',
    description: 'Parent category ID',
    required: false,
  })
  @IsOptional()
  parentId?: number; // Agar parent bo‘lsa, shu ID orqali kategoriya bog‘lanadi
}
