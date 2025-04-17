import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Data Transfer Object (DTO) for sending an OTP (One-Time Password).
 *
 * This class is used to validate the phone number provided by the user
 * when requesting an OTP. It ensures that the phone number is not empty,
 * is a string, and matches the required format.
 *
 * @property phone - The phone number to which the OTP will be sent.
 *   - Must not be empty.
 *   - Must be a string.
 *   - Must match the format: starts with +998 and contains 12 characters.
 *
 * @example
 * {
 *   "phone": "+998901234567"
 * }
 */
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
}
