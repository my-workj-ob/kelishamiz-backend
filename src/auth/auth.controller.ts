/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../profile/enities/profile.entity';
import { ProfileService } from '../profile/profile.service';
import { AuthService } from './auth.service';
import { CreatePasswordDto } from './dto/create-password.dto';
import { LoginWithPhoneAndPasswordDto } from './dto/login-with-phone-and-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';

interface VerificationResult {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly profileService: ProfileService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({
    summary: "Avtorizatsiyalangan foydalanuvchi haqida ma'lumot olish",
  })
  @ApiResponse({
    status: 200,
    description: "Foydalanuvchi profili va ma'lumotlari",
    schema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          nullable: true,
          example: {
            id: 1,
            phoneNumber: '+998901234567' /* ... other profile fields */,
          },
        },
        id: { type: 'number', example: 1 },
        phone: { type: 'string', example: '+998901234567' },
        username: { type: 'string', example: 'user123' },
        // ... other user properties
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Avtorizatsiya talab qilinadi' })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async getMe(@Request() req: any) {
    const existUser = req.user;

    const profile = await this.profileRepo.findOne({
      where: {
        userId: req.user.userId,
      },
    });

    if (!existUser) {
      throw new NotFoundException('user');
    }
    return {
      profile,
      ...existUser,
    };
  }
  @UseInterceptors()
  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  @ApiOperation({ summary: 'Telefon raqamga OTP jo‘natish' })
  @ApiResponse({
    status: 200,
    description: 'SMS kod yuborildi',
  })
  @ApiResponse({
    status: 409,
    description: 'Telefon raqam allaqachon ro‘yxatdan o‘tgan',
  })
  @ApiBody({ type: SendOtpDto })
  async sendOtp(@Body() body: SendOtpDto) {
    const existingUser = await this.authService.findByPhone(body.phone);
    if (existingUser) {
      throw new ConflictException(
        'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan.',
      );
    }

    const code = await this.authService.sendOtp(body.phone);
    return { success: true, message: 'SMS kod yuborildi', code: code.otp };
  }
  @Post('verify-otp')
  @ApiOperation({ summary: 'OTP ni tekshirish' })
  @ApiResponse({
    status: 200,
    description: 'OTP tekshirildi, parol o‘rnatishingiz mumkin',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          nullable: true,
          example: 'OTP tasdiqlandi. Parol o‘rnatishingiz mumkin.',
        },
        user: { $ref: '#/components/schemas/User', nullable: true },
        accessToken: {
          type: 'string',
          nullable: true,
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          nullable: true,
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
    example: {
      success: true,
      message: 'OTP tasdiqlandi. Parol o‘rnatishingiz mumkin.',
      user: { id: 1, phone: '+998901234567', username: null },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({ status: 400, description: 'Noto‘g‘ri so‘rov' })
  @ApiResponse({
    status: 401,
    description: 'SMS kod noto‘g‘ri yoki muddati tugagan',
    examples: {
      'application/json': {
        summary: 'Noto‘g‘ri yoki muddati tugagan SMS kod',
        value: {
          success: false,
          error: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Bu raqam allaqachon ro‘yxatdan o‘tgan va parol o‘rnatilgan',
    examples: {
      'application/json': {
        summary: 'Bu raqam allaqachon ro‘yxatdan o‘tgan',
        value: {
          success: false,
          message:
            'Bu raqam allaqachon ro‘yxatdan o‘tgan va parol o‘rnatilgan. Iltimos, login qiling.',
        },
      },
    },
  })
  async verifyOtp(@Body() body: VerifyOtpDto): Promise<VerificationResult> {
    return await this.authService.verifyOtpAndRegister(body.phone, body.code);
  }

  @Post('create-password')
  @ApiOperation({
    summary:
      'Yangi parol yaratish va profil yaratish (faqat OTP tasdiqlangandan keyin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Parol muvaffaqiyatli o‘rnatildi!',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Parol muvaffaqiyatli o‘rnatildi!',
        },
        user: { $ref: '#/components/schemas/User' },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
    example: {
      message: 'Parol muvaffaqiyatli o‘rnatildi!',
      user: {
        id: 1,
        phone: '+998901234567',
        username: null,
        password: 'hashedPassword',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Noto‘g‘ri so‘rov, parollar mos kelmadi yoki OTP tasdiqlanmagan',
    examples: {
      'application/json': {
        summary: 'Parollar mos kelishi kerak',
        value: { message: 'Parollar mos kelishi kerak.' },
      },
      'application/json_2': {
        summary: 'OTP tasdiqlanmagan yoki muddati tugagan',
        value: {
          message:
            'Avval telefon raqamingizni tasdiqlang yoki OTP muddati tugagan.',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  @ApiBody({ type: CreatePasswordDto })
  async createPassword(@Body() body: CreatePasswordDto, @Request() req: any) {
    const { user, accessToken, refreshToken } =
      await this.authService.createPassword(
        body.phone,
        body.password,
        body.confirmPassword,
      );

    const existingProfile = await this.profileRepo.findOne({
      where: { userId: user.id },
    });
    if (!existingProfile) {
      const createProfileDto = { phoneNumber: user.phone };
      await this.profileService.create(createProfileDto, user);
    }

    return {
      message: 'Parol muvaffaqiyatli o‘rnatildi!',
      user,
      accessToken,
      refreshToken,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Telefon raqami va parol orqali tizimga kirish' })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli login',
    schema: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
    example: {
      user: {
        id: 1,
        phone: '+998901234567',
        username: 'user123',
        password: 'hashedPassword',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Noto‘g‘ri so‘rov, parol noto‘g‘ri yoki parol o‘rnatilmagan',
    examples: {
      'application/json': {
        summary: 'Noto‘g‘ri parol',
        value: { message: 'Noto‘g‘ri parol.' },
      },
      'application/json_2': {
        summary: 'Parol o‘rnatilmagan',
        value: {
          message:
            'Parol o‘rnatilmagan. Ro‘yxatdan o‘tish yoki parolni tiklash uchun OTP dan foydalaning.',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Telefon raqami topilmadi' })
  @ApiBody({ type: LoginWithPhoneAndPasswordDto })
  async login(@Body() body: LoginWithPhoneAndPasswordDto) {
    try {
      const { user, accessToken, refreshToken } =
        await this.authService.loginWithPhoneAndPassword(
          body.phone,
          body.password,
        );
      return { user, accessToken, refreshToken };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Telefon raqami topilmadi.');
      } else if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw error;
    }
  }
}
