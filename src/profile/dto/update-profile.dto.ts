import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    required: false,
    example: 'Imomova Mohizoda',
    description: "To'liq ismi",
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    required: false,
    example: 'imomovamohizoda@gmail.com',
    description: 'E-mail',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    required: false,
    example: '+998900158502',
    description: 'Telefon raqami',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    required: false,
    example: "Guliston ko'chasi, 12-uy",
    description: 'Manzil',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    required: false,
    example: 10,
    description: 'Region ID (viloyat IDsi)',
  })
  @IsOptional()
  @IsNumber()
  regionId?: number;

  @ApiProperty({
    required: false,
    example: 35,
    description: 'District ID (tuman IDsi)',
  })
  @IsOptional()
  @IsNumber()
  districtId?: number;

  @ApiProperty({ required: false, example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string; // profil rasmi URL
}
