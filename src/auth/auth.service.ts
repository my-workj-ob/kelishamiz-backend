/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';

@Injectable()
export class AuthService {
  private readonly temporaryOtps: Record<
    string,
    { code: string; expiresAt: Date; isVerified: boolean }
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

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
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

  verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ success: boolean; message?: string }> {
    const storedOtp = this.temporaryOtps[phone];

    if (
      !storedOtp ||
      storedOtp.code !== code ||
      storedOtp.expiresAt < new Date()
    ) {
      return Promise.resolve({
        success: false,
        message: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
      });
    }

    this.temporaryOtps[phone].isVerified = true;
    return Promise.resolve({ success: true, message: 'OTP tasdiqlandi.' });
  }

  async createAccount(
    phone: string,
    username: string,
    location: string,
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

    const existingUser = await this.findByPhone(phone);
    if (existingUser) {
      throw new ConflictException(
        'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan.',
      );
    }

    const newUser = this.userRepo.create({ phone, username, location });
    const savedUser = await this.userRepo.save(newUser);

    const tokens = await this.generateTokens(savedUser);

    delete this.temporaryOtps[phone];

    return { user: savedUser, ...tokens };
  }

  async loginWithOtp(phone: string): Promise<{
    [x: string]: any;
    success: boolean;
    message?: string;
    user?: User;
  }> {
    const storedOtp = this.temporaryOtps[phone];

    if (
      !storedOtp ||
      !storedOtp.isVerified ||
      storedOtp.expiresAt < new Date()
    ) {
      return {
        success: false,
        message: 'SMS kod noto‘g‘ri yoki muddati tugagan.',
      };
    }

    const existingUser = await this.findByPhone(phone);
    if (!existingUser) {
      return { success: false, message: 'Foydalanuvchi topilmadi.' };
    }

    const tokens = await this.generateTokens(existingUser);
    delete this.temporaryOtps[phone]; // Logindan keyin OTP ni o'chiramiz

    return { success: true, user: existingUser, ...tokens };
  }
}
