import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class GetProductsDto {
  @ApiProperty({
    required: false,
    description: "Kategoriya IDsi bo'yicha filtrlash",
  })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @ApiProperty({
    required: false,
    description: "Narx diapazoni boshlang'ich qiymati",
  })
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @ApiProperty({
    required: false,
    description: 'Narx diapazoni yakuniy qiymati',
  })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @ApiProperty({ required: false, description: 'Mahsulot nomida qidirish' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    description: "Faqat o'z mahsulotlarini ko'rish",
  })
  @IsOptional()
  @IsBoolean()
  ownProduct?: boolean;

  @ApiProperty({
    required: false,
    description: "Xususiyatlar bo'yicha filtrlash (nomi: qiymati)",
    example: { Color: 'Qora', Memory: '128 GB' },
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @ApiProperty({
    required: false,
    description: "Sahifalash uchun o'tkazib yuborish",
  })
  @IsOptional()
  @IsNumber()
  skip?: number;

  @ApiProperty({ required: false, description: 'Sahifadagi elementlar soni' })
  @IsOptional()
  @IsNumber()
  take?: number;

  @ApiProperty({
    required: false,
    description: 'Tartiblash maydoni',
    example: 'price',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    required: false,
    description: 'Tartiblash tartibi (ASC yoki DESC)',
    example: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiProperty({
    required: false,
    description: "To'lov turi bo'yicha filtrlash",
    example: 'Pullik',
  })
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiProperty({
    required: false,
    description: "Valyuta turi bo'yicha filtrlash",
    example: 'UZS',
  })
  @IsOptional()
  @IsString()
  currencyType?: string;

  @ApiProperty({
    required: false,
    description: "Kelishish mumkinligi bo'yicha filtrlash",
  })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;
}
