import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    example: 123,
    description:
      'Izoh qoldirilayotgan entitining ID raqami (masalan, post yoki video)',
  })
  @IsNotEmpty()
  @IsNumber()
  entityId: number;

  @ApiProperty({
    example: 'post',
    description:
      'Izoh qoldirilayotgan entitining turi (masalan, "post", "video")',
  })
  @IsNotEmpty()
  @IsString()
  entityType: string;

  @ApiProperty({
    example: 'Bu juda foydali maqola ekan!',
    description: 'Izoh mazmuni',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    example: 45,
    description:
      'Agar izoh boshqa izohga javob bo‘lsa, parentCommentId beriladi',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  parentCommentId?: number;

  @IsOptional()
  @IsNumber()
  likes?: number;
}
