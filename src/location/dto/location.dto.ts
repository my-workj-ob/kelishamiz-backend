import { ApiProperty } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({
    description: 'The name of the location',
    example: 'New York',
  })
  name: string;

  @ApiProperty({
    description: 'The latitude of the location',
    example: 40.7128,
  })
  latitude: number;

  @ApiProperty({
    description: 'The longitude of the location',
    example: -74.006,
  })
  longitude: number;

  @ApiProperty({
    description: 'The description of the location',
    example: 'A major city in the United States.',
    required: false,
  })
  description?: string;
}

    

export class CreateRegionDto {
  @ApiProperty({ example: 'Toshkent', description: 'Viloyat nomi' })
  name: string;
}
    

export class CreateDistrictDto {
  @ApiProperty({ example: 'Chilonzor', description: 'Tuman nomi' })
  name: string;

  @ApiProperty({ example: 1, description: 'Tegishli viloyat IDsi' })
  regionId: number;
}
