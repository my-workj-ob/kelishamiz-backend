import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone: string;
}
