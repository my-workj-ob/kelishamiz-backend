    
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';

export class CreateBannerDto {
  @ApiProperty({ description: 'Banner sarlavhasi', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Banner tavsifi', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Rasm URL manzili',
    format: 'binary',
    type: 'string',
    required: false,
  })
    
    
  @IsOptional() // Frontendda fayl yuklash mutationi alohida bo'ladi
  @IsString()
  imageUrl?: string; // Bu yerda fayl emas, balki URL bo'lishi kerak

  @ApiProperty({
    description: 'Banner bosilganda yo`naltiriladigan URL',
    required: false,
  })
  @IsOptional()
  @IsString()
    
  linkUrl?: string;

  @ApiProperty({
    description: 'Bannerning ko`rsatilish tartibi',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({
    description: 'Bannerning faolligi',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description:
      'Bannerning saytdagi joylashuvi (e.g., home_hero, category_sidebar)',
    default: 'home_hero',
  })
  @IsNotEmpty()
  @IsString()
  placement: string;
}

