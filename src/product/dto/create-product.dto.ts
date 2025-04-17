import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty({ type: [Number], required: false })
  properties?: { id: number }[];

  @ApiProperty({ type: [String], required: false })
  propertyValues?: string[];

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
}
