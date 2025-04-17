import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty({ example: '8888' })
  @IsNotEmpty()
  @Length(4, 4)
  code: string;
}
