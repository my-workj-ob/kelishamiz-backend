import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'The phone number to which the OTP will be sent.',
    example: '+998901234567',
  })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi kerak.' })
  @IsString({ message: 'Telefon raqami satr bo‘lishi kerak.' })
  @Matches(/^\+998\d{9}$/, {
    message:
      'Telefon raqami +998 bilan boshlanishi va 12 ta belgidan iborat bo‘lishi kerak.',
  })
  readonly phone: string;
  readonly expiredTime: string;
}
