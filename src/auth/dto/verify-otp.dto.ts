import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+998992584880' })
  @IsPhoneNumber('UZ')
  phone: string;

  @ApiProperty({ example: '8888' })
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
