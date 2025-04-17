import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsPhoneNumber } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '+998901234567' })
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  readonly phone: string;

  @ApiProperty({ example: '1' })
  @IsOptional()
  readonly password?: string;
}
