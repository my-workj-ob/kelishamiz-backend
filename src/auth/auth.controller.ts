/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
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

import { CreateAccountDto } from './dto/create-account.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './fake-otp.service';

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
        location: { type: 'string', example: 'Toshkent' },
        // ... other user properties
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Avtorizatsiya talab qilinadi' })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  async getMe(@Request() req: any) {
    const existUser = await this.authService.findById(req.user.sub);

    const profile = await this.profileRepo.findOne({
      where: {
        userId: req.user.sub,
      },
    });

    if (!existUser) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    const { profile: existingProfile, ...restOfUser } = existUser;
    return {
      profile,
      ...restOfUser,
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
    const code = await this.authService.sendOtp(body.phone);
    return { success: true, message: 'SMS kod yuborildi', code: code.otp };
  }
  @Post('verify-otp')
  @ApiOperation({ summary: 'OTP ni tekshirish' })
  @ApiResponse({
    status: 200,
    description: 'OTP tekshirildi',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          nullable: true,
          example: 'OTP tasdiqlandi.',
        },
      },
    },
    example: {
      success: true,
      message: 'OTP tasdiqlandi.',
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
  async verifyOtp(
    @Body() body: VerifyOtpDto,
  ): Promise<{ success: boolean; message?: string }> {
    return await this.authService.verifyOtp(body.phone, body.code);
  }

  @Post('create-account')
  @ApiOperation({
    summary: 'Yangi akkaunt yaratish (faqat OTP tasdiqlangandan keyin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Akkaunt muvaffaqiyatli yaratildi!',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Akkaunt muvaffaqiyatli yaratildi!',
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
      message: 'Akkaunt muvaffaqiyatli yaratildi!',
      user: {
        id: 1,
        phone: '+998901234567',
        username: 'newuser',
        location: 'Toshkent',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Noto‘g‘ri so‘rov yoki OTP tasdiqlanmagan',
    examples: {
      'application/json': {
        summary: 'OTP tasdiqlanmagan yoki muddati tugagan',
        value: {
          message:
            'Avval telefon raqamingizni tasdiqlang yoki OTP muddati tugagan.',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan',
  })
  @ApiBody({ type: CreateAccountDto })
  async createAccount(@Body() body: CreateAccountDto, @Request() req: any) {
    const { user, accessToken, refreshToken } =
      await this.authService.createAccount(
        body.phone,
        body.username,
        body.location,
      );

    const createProfileDto = { phoneNumber: user.phone };
    await this.profileService.create(createProfileDto, user);

    return {
      message: 'Akkaunt muvaffaqiyatli yaratildi!',
      user,
      accessToken,
      refreshToken,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Telefon raqami orqali tizimga kirish (OTP bilan)' })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli login',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Muvaffaqiyatli login!' },
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
      success: true,
      message: 'Muvaffaqiyatli login!',
      user: {
        id: 1,
        phone: '+998901234567',
        username: 'existinguser',
        location: 'Samarqand',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Noto‘g‘ri so‘rov yoki OTP tasdiqlanmagan',
    examples: {
      'application/json': {
        summary: 'OTP tasdiqlanmagan yoki muddati tugagan',
        value: {
          success: false,
          message: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  @ApiBody({ type: SendOtpDto }) // Login uchun ham OTP so'rash
  async login(@Body() body: SendOtpDto) {
    const existingUser = await this.authService.findByPhone(body.phone);
    if (!existingUser) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    // Login uchun OTP yuboramiz
    const { otp } = await this.authService.sendOtp(body.phone);
    return { success: true, message: 'SMS kod yuborildi.', otp };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login/verify-otp')
  @ApiOperation({ summary: 'Login uchun OTP ni tekshirish va token olish' })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli login',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Muvaffaqiyatli login!' },
        user: { $ref: '#/components/schemas/User' },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInRtycCI6IkpXVCJ9...',
        },
      },
    },
    example: {
      success: true,
      message: 'Muvaffaqiyatli login!',
      user: {
        id: 1,
        phone: '+998901234567',
        username: 'existinguser',
        location: 'Samarqand',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInRtycCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInRtycCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Noto‘g‘ri so‘rov yoki OTP tasdiqlanmagan',
    examples: {
      'application/json': {
        summary: 'OTP tasdiqlanmagan yoki muddati tugagan',
        value: {
          success: false,
          message: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi' })
  @ApiBody({ type: VerifyOtpDto })
  async loginVerifyOtp(@Body() body: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(body.phone, body.code);
    if (!result.success) {
      throw new UnauthorizedException(result.message);
    }

    const loginResult = await this.authService.loginWithOtp(
      body.phone,
      body.code,
    );
    if (!loginResult.success) {
      throw new NotFoundException(loginResult.message);
    }

    return {
      success: true,
      message: 'Muvaffaqiyatli login!',

      accessToken: loginResult.content?.accessToken,
      refreshToken: loginResult.content?.refreshToken,
    };
  }
  @Post('check-phone')
  async checkPhone(@Body('phone') phone: string) {
    return this.authService.checkPhone(phone);
  }
}
