/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';

interface VerificationResult {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly temporaryOtps: Record<
    string,
    { code: string; expiresAt: Date; isVerified: boolean } // isVerified holatini qo'shdik
  > = {};
  private readonly otpExpiryTimeMs = 5 * 60 * 1000;
  private readonly saltRounds = 10;

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      phone: user.phone,
      username: user.username,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  async sendOtp(phone: string): Promise<{ otp?: string; message?: string }> {
    const otpCode = await this.otpService.sendOtp(phone);
    const expiresAt = new Date(Date.now() + this.otpExpiryTimeMs);
    this.temporaryOtps[phone] = { code: otpCode, expiresAt, isVerified: false };
    return { otp: otpCode };
  }

  async verifyOtpAndRegister(
    phone: string,
    code: string,
  ): Promise<VerificationResult> {
    const storedOtp = this.temporaryOtps[phone];

    if (
      !storedOtp ||
      storedOtp.code !== code ||
      storedOtp.expiresAt < new Date()
    ) {
      return {
        success: false,
        message: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
      };
    }

    this.temporaryOtps[phone].isVerified = true; // OTP muvaffaqiyatli tekshirildi

    const existingUser = await this.findByPhone(phone);
    if (existingUser && existingUser.password) {
      return {
        success: false,
        message:
          'Bu raqam allaqachon ro‘yxatdan o‘tgan va parol o‘rnatilgan. Iltimos, login qiling.',
      };
    } else if (existingUser) {
      return {
        success: true,
        message: 'OTP tasdiqlandi. Parol o‘rnatishingiz mumkin.',
        user: existingUser, // Parol o'rnatish uchun user ni qaytaramiz
      };
    }

    const newUser = this.userRepo.create({ phone });
    const savedUser = await this.userRepo.save(newUser);

    return {
      success: true,
      message: 'OTP tasdiqlandi. Parol o‘rnatishingiz mumkin.',
      user: savedUser, // Parol o'rnatish uchun user ni qaytaramiz
    };
  }

  async createPassword(
    phone: string,
    password: string,
    confirmPassword: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const storedOtp = this.temporaryOtps[phone];

    if (
      !storedOtp ||
      !storedOtp.isVerified ||
      storedOtp.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Avval telefon raqamingizni tasdiqlang yoki OTP muddati tugagan.',
      );
    }

    if (password !== confirmPassword) {
      throw new BadRequestException('Parollar mos kelishi kerak.');
    }

    const user = await this.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    const hashedPassword = await bcrypt.hash(password, this.saltRounds);
    user.password = hashedPassword;
    await this.userRepo.save(user);

    const tokens = await this.generateTokens(user);

    delete this.temporaryOtps[phone]; // Parol o'rnatilgandan keyin OTP ni o'chiramiz

    return { user, ...tokens };
  }

  async loginWithPhoneAndPassword(
    phone: string,
    password: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const user = await this.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Parol o‘rnatilmagan. Ro‘yxatdan o‘tish yoki parolni tiklash uchun OTP dan foydalaning.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Noto‘g‘ri parol.');
    }

    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  }
}
