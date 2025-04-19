import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({
    example: '+998901234567',
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
    example: 'Toshkent shahar',
    description: 'Foydalanuvchi manzili',
  })
  @IsNotEmpty()
  @IsString()
  readonly location: string;
}
