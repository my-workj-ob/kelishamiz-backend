// src/products/dto/product.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ProductPropertyValueDto {
  @ApiProperty({ example: 'Rangi', description: 'Xususiyat nomi' })
  @IsNotEmpty()
  @IsString()
  key: string;
  @ApiProperty({ example: 'Qizil', description: 'Xususiyat qiymati' })
  @IsNotEmpty()
  @IsString()
  value: string;
}

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
    type: ProductPropertyValueDto,
    description: 'Xususiyatning nomi va qiymati',
  })
  @ValidateNested()
  @Type(() => ProductPropertyValueDto)
  value: Record<string, string>;
}

export class ProductImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Mahsulot rasmi' })
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
  @ApiProperty()
  location: string;

  @ApiProperty({ type: [ProductImageDto], description: 'Mahsulot rasmlari' })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[]; // `mainImage` o'rniga rasmlar massivi

  @ApiProperty({ required: false })
  // images?: string[]; // Buni olib tashlang

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

  @ApiProperty({ example: 1, description: 'Viloyat IDsi' })
  regionId: number;

  @ApiProperty({ example: 5, description: 'Tuman IDsi' })
  districtId: number;
}