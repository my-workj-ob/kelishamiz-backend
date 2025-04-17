import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Color' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'STRING' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'Electronics' })
  @IsString()
  @IsOptional()
  categoryId: number; // Qo'shimcha ravishda kategoriya ID
}
