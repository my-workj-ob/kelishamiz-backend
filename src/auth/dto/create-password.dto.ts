    
    
    
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

export class CreatePasswordDto {
  @ApiProperty({
    description: 'The phone number of the user.',
    example: '+998901234567',
  })
  @IsNotEmpty()
  @IsString()
  readonly phone: string;

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
