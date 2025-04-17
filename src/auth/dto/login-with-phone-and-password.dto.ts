import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginWithPhoneAndPasswordDto {
  @ApiProperty({
    description:
      'Telefon raqami +998 bilan boshlanishi va 12 ta belgidan iborat bo‘lishi kerak.',
    example: '+998901234567',
  })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi kerak.' })
  @IsString({ message: 'Telefon raqami satr bo‘lishi kerak.' })
  @Matches(/^\+998\d{9}$/, {
    message:
      'Telefon raqami +998 bilan boshlanishi va 12 ta belgidan iborat bo‘lishi kerak.',
  })
  readonly phone: string;

  @ApiProperty({
    description: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.',
    example: 'mysecurepassword',
  })
  @IsNotEmpty({ message: 'Parol kiritilishi kerak.' })
  @IsString({ message: 'Parol satr bo‘lishi kerak.' })
  @MinLength(6, {
    message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.',
  })
  readonly password: string;
}
