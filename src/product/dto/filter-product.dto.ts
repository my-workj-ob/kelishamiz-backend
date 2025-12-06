import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
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
  properties?: Record<string, any>; 

  @ApiProperty({
    required: false,
    description: 'Tartiblash maydoni',
    example: 'price',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sahifadagi elementlar soni' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;
  @ApiProperty({ required: false, description: 'Sahifadagi elementlar soni' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number;

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

  @ApiPropertyOptional({ example: 8, description: 'Viloyat IDsi' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  regionId?: number;

  @ValidateIf((o) => o.districtId !== undefined) 
  @IsOptional()
  @IsArray() 
  @IsNumber({}, { each: true })
  @ArrayMaxSize(3) 
  @ArrayMinSize(1) 
  @Type(() => Number) 
  districtId?: number | number[]; 
  @ApiProperty({
    required: false,
    description: "Sahifalashda ko'rsatiladigan elementlar soni",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number; 
}
