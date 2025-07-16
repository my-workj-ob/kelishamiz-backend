import { IsNumber, IsString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PropertyValueDetailDto {
  @ApiProperty({ example: 'Marka', description: 'Property kaliti' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'yyjjhh', description: 'Property qiymati' })
  @IsString()
  value: string;
}

export class ProductPropertyUpdateItemDto {
  @ApiProperty({ example: 2, description: 'Property IDsi' })
  @IsNumber()
  propertyId: number;

  @ApiProperty({ example: 'STRING', description: 'Property turi' })
  @IsString()
  type: string;

  @ApiProperty({
    type: PropertyValueDetailDto,
    description: 'Property qiymati detallari',
  })
  @IsObject()
  @Type(() => PropertyValueDetailDto)
  value: PropertyValueDetailDto;
}
