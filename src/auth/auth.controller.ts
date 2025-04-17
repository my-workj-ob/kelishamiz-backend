/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './../profile/dto/create-profile.dto';
import { ProfileService } from './../profile/profile.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly profileService: ProfileService,
  ) {}
  // Faqat OTP yuborish (register oldidan)
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: any) {
    const existUser = req.user;

    const profile = await this.userRepo.findOne({
      where: { id: req.sub },
      relations: ['profile', 'comments', 'likes'],
    });
    console.log(profile);

    if (!existUser) {
      throw new NotFoundException('user');
    }
    return {
      profile,
      ...existUser,
    };
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Telefon raqamga OTP jo‘natish (fake)' })
  async sendOtp(@Body() body: RegisterDto) {
    // Optional: Check if the phone number exists if needed for your logic
    const userExists = await this.authService.findByPhone(body.phone);
    if (userExists) {
      // Handle existing user scenario (e.g., inform user or start forgot password)
      return { message: 'Bu raqam allaqachon ro‘yxatdan o‘tgan.' };
    }
    const otp = this.otpService.sendOtp(body.phone);
    return { message: 'OTP yuborildi', code: otp };
  }

  // OTP ni tekshirish va ro‘yxatdan o‘tish
  @Post('verify')
  @ApiOperation({ summary: 'OTP orqali ro‘yxatdan o‘tish' })
  async verify(@Body() body: VerifyOtpDto) {
    const isValid = this.otpService.verifyOtp(body.phone, body.code);
    if (!isValid) throw new UnauthorizedException('OTP noto‘g‘ri');
    const { user, accessToken, refreshToken } = await this.authService.register(
      body.phone,
    );

    if (user && accessToken && refreshToken) {
      // Profil yaratish
      const createProfileDto: CreateProfileDto = {
        phoneNumber: body.phone, // Telefon raqamini profilga avtomatik kiritish
        // Boshqa profil ma'lumotlarini ham qo'shishingiz mumkin
      };
      await this.profileService.create(createProfileDto, user);
    }

    return {
      message: 'Ro‘yxatdan o‘tish muvaffaqiyatli!',
      user,
      accessToken,
      refreshToken,
    };
  }

  @Post('register')
  @ApiOperation({
    summary: 'Foydalanuvchini ro‘yxatdan o‘tkazish (bypasses OTP)',
  })
  async register(@Body() body: RegisterDto) {
    const { user, accessToken, refreshToken } = await this.authService.register(
      body.phone,
    );
    return { user, accessToken, refreshToken };
  }

  @Post('login')
  @ApiOperation({ summary: 'Telefon raqami orqali tizimga kirish' })
  async login(@Body() body: LoginDto) {
    try {
      const { user, accessToken, refreshToken } =
        await this.authService.loginWithPhone(body.phone);
      return { user, accessToken, refreshToken };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Telefon raqami topilmadi.');
      }
      throw error;
    }
  }
}
