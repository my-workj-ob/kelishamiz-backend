import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

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
    example: 'Surxondaryo',
    description: 'Tuman',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    required: false,
    example: "Guliston ko'chasi",
    description: 'Manzil',
  })
  @IsOptional()
  @IsString()
  address?: string;
}
