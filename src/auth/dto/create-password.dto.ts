/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsMatchingPassword' })
export class IsMatchingPassword implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as CreatePasswordDto;
    return object?.password === value;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Parollar mos kelishi kerak.';
  }
}

/**
 * Data Transfer Object (DTO) for creating a password.
 */
export class CreatePasswordDto {
  /**
   * The phone number of the user.
   * This field is required and must be a string.
   */
  @ApiProperty({
    description: 'The phone number of the user.',
    example: '+998901234567',
  })
  @IsNotEmpty()
  @IsString()
  readonly phone: string;

  /**
   * The password of the user.
   * This field is required, must be a string, and must have a minimum length of 6 characters.
   * A custom validation message is provided for passwords shorter than 6 characters.
   */
  @ApiProperty({
    description:
      'The password of the user. Must be at least 6 characters long.',
    example: 'password123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, {
    message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.',
  })
  readonly password: string;

  /**
   * The confirmation password of the user.
   * This field is required, must be a string, and must have a minimum length of 6 characters.
   * It is only validated if the `password` field is present and must match the `password` field.
   */
  @ApiProperty({
    description: 'The confirmation password. Must match the password.',
    example: 'password123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @ValidateIf((o) => o.password)
  @Validate(IsMatchingPassword)
  readonly confirmPassword: string;
}
