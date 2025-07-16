import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested, // <--- Qo'shish kerak
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer'; // <--- Qo'shish kerak

// Yangi DTO-larni import qiling
import { ProductPropertyUpdateItemDto } from './product-update.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 'iPhone 14 Pro Max',
    description: 'Mahsulot nomi',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 'Yangi model, 256GB, Midnight',
    description: 'Mahsulot tavsifi',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1450.0, description: 'Mahsulot narxi' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({
    example: 1400.0,
    description: 'Minimal narx (agar bo‘lsa)',
  })
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({
    example: 1500.0,
    description: 'Maksimal narx (agar bo‘lsa)',
  })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ example: 2, description: 'Kategoriya IDsi' })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ example: 5, description: 'Profil IDsi (egasi)' })
  @IsOptional()
  @IsNumber()
  profileId?: number;

  @ApiPropertyOptional({
    example: 'naqd',
    description: 'To‘lov turi (naqd/karta)',
  })
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Valyuta turi (UZS, USD)',
  })
  @IsOptional()
  @IsString()
  currencyType?: string;

  @ApiPropertyOptional({ example: true, description: 'Narxi kelishiladi' })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @ApiPropertyOptional({ example: false, description: 'O‘z mahsuloti' })
  @IsOptional()
  @IsBoolean()
  ownProduct?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description: 'Qaysi rasm asosiy bo‘lishi',
  })
  @IsOptional()
  @IsNumber()
  imageIndex?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Top mahsulot sifatida ajratilsinmi',
  })
  @IsOptional()
  @IsBoolean()
  isTop?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Chiqarilgan (publish) holatimi',
  })
  @IsOptional()
  @IsBoolean()
  isPublish?: boolean;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59Z',
    description: 'Top bo‘lish muddati',
  })
  @IsOptional()
  topExpiresAt?: Date;

  // <<< ASOSIY O'ZGARISH AYNAN SHU YERDA >>>
  @ApiPropertyOptional({
    example:
      '[{"propertyId":2,"type":"STRING","value":{"key":"Marka","value":"yyjjhh"}}]',
    description: 'Mahsulot xususiyatlari (JSON string yoki massiv)',
    type: String, // Swagger uchun string bo'lishi mumkinligini ko'rsatish
  })
  @IsOptional()
  @IsString() // Kelayotgan qiymat string bo'lishi mumkin
  @Transform(({ value }) => {
    // Bu qiymatni avtomatik parse qiladi
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Parse qilishda xato bo'lsa, xato holatini saqlab qolish
        return value;
      }
    }
    return value; // Agar string bo'lmasa, uni o'z holida qoldirish
  })
  @IsArray() // Transformatsiya qilingandan keyin massiv bo'lishi kerak
  @ValidateNested({ each: true }) // Massivdagi har bir elementni validatsiya qilish
  @Type(() => ProductPropertyUpdateItemDto) // Har bir elementni ushbu DTO turiga o'tkazish
  properties?: ProductPropertyUpdateItemDto[]; // <-- Maydon nomini 'properties' ga o'zgartiring
  // <<< ASOSIY O'ZGARISH YAKUNI >>>

  @ApiPropertyOptional({
    example: ['/uploads/image1.jpg', '/uploads/image2.jpg'],
    description: 'Rasmlar URL yoki fayl yo‘llari ro‘yxati, tartib bilan',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  images?: string[];
}
