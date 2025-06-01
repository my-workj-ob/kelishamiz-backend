import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({
    example: '+998992584880',
    description: 'Foydalanuvchi telefon raqami',
  })
  @IsNotEmpty()
  @IsString()
  readonly phone: string;

  @ApiProperty({ example: 'username123', description: 'Foydalanuvchi nomi' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  readonly username: string;

  @ApiProperty({
    example: 'regionId (Region Id = 10)',
    description: 'Foydalanuvchi manzili',
  })
  @IsNotEmpty()
  @IsString()
  readonly regionId: number;
  @ApiProperty({
    example: 'districtId (district Id) = 20',
    description: 'Foydalanuvchi manzili',
  })
  @IsNotEmpty()
  @IsString()
  readonly districtId: number;
}
