// src/products/dto/product.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  isNumber,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Column } from 'typeorm';

// DTO da:
// ProductPropertyValueDto ni birinchi o'rinda e'lon qilish
export class ProductPropertyValueDto {
  @ApiProperty({ example: 'Eshiklar soni', description: 'Xususiyat nomi' })
  @IsString()
  key: string;

  @ApiProperty({ example: '2', description: 'Xususiyat qiymati' })
  @IsString()
  value: string;
}

// Keyin ProductPropertyDto ni e'lon qilish
export class ProductPropertyDto {
  @ApiProperty({ example: 1, description: 'Xususiyat IDsi' })
  @IsNotEmpty()
  @IsNumber()
  propertyId: number;

  @ApiProperty({ example: 'STRING', description: 'Xususiyat turi' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    example: [{ key: 'Eshiklar soni', value: '2' }],
    description: 'Xususiyat nomi va qiymatlari',
    isArray: true,
  })
  @ValidateNested({ each: true })
  @Type(() => ProductPropertyValueDto)
  value: ProductPropertyValueDto[];
}

export class ProductImageDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Mahsulot rasmi',
  })
  @IsOptional()
  file?: Express.Multer.File;

  @ApiProperty({ example: false, description: 'Asosiy rasm ekanligi' })
  @IsNotEmpty()
  @IsBoolean()
  isMainImage: boolean;

  url?: string;
}

export class ProductDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  categoryId: number;

  @ApiProperty({ type: [ProductImageDto], description: 'Mahsulot rasmlari' })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[]; // `mainImage` o'rniga rasmlar massivi

  @ApiProperty({ type: [ProductPropertyDto], required: false })
  @ValidateNested({ each: true })
  @Type(() => ProductPropertyDto)
  properties?: ProductPropertyDto[];

  @ApiProperty({ example: 'Pullik', description: "To'lov turi" })
  @IsNotEmpty()
  @IsString()
  paymentType: string;

  @ApiProperty({ example: 'UZS', description: 'Valyuta turi' })
  @IsNotEmpty()
  @IsString()
  currencyType: string;

  @ApiProperty({ example: false, description: 'Kelishish mumkinligi' })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @ApiProperty({ example: false, description: 'publishga chiqishi ' })
  @IsOptional()
  @IsBoolean()
  isPublish?: boolean;

  @ApiProperty({ example: 1, description: 'main image' })
  @IsOptional()
  @IsNumber()
  imageIndex: number;

  @ApiProperty({ example: 1, description: 'Viloyat IDsi' })
  regionId: number;

  @ApiProperty({ example: 5, description: 'Tuman IDsi' })
  districtId: number;
}

export class TopProductDto {
  @ApiProperty({ example: true, description: 'Topga chiqarilganmi' })
  @IsOptional()
  @IsBoolean()
  isTop?: boolean;

  @ApiProperty({ example: true, description: 'saytga  chiqarish' })
  @IsOptional()
  @IsBoolean()
  isPublish?: boolean;

  @ApiProperty({
    example: '2025-06-10T00:00:00Z',
    description: 'Top holatining tugash vaqti',
  })
  @IsOptional()
  @IsDateString()
  topExpiresAt?: string;
}
export class PublishProductDto {
  @IsBoolean()
  isPublish: boolean;
}
