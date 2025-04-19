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

  @ApiProperty()
  mainImage: string;

  @ApiProperty({ required: false })
  images?: string[];

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
