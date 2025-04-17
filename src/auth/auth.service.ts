import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service'; // Import your OTP service

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
    { code: string; expiresAt: Date }
  > = {}; // In-memory storage for OTPs (replace with a database in production)
  private readonly otpExpiryTimeMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private readonly otpService: OtpService, // Inject your OTP service
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

  async sendOtp(phone: string): Promise<void> {
    const otpCode = await this.otpService.sendOtp(phone); // Assuming this returns a Promise with the generated OTP
    const expiresAt = new Date(Date.now() + this.otpExpiryTimeMs);
    this.temporaryOtps[phone] = { code: otpCode, expiresAt };
    // In a real application, you would also send the SMS here
    console.log(`Simulated OTP sent to ${phone}: ${otpCode}`);
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

    const existingUser = await this.findByPhone(phone);
    if (existingUser) {
      return {
        success: false,
        message: 'Bu raqam allaqachon ro‘yxatdan o‘tgan.',
      };
    }

    const newUser = this.userRepo.create({ phone });
    const savedUser = await this.userRepo.save(newUser);
    const tokens = await this.generateTokens(savedUser);

    delete this.temporaryOtps[phone]; // Remove the used OTP

    return {
      success: true,
      user: savedUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async register(phone: string) {
    let user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      user = this.userRepo.create({ phone });
      await this.userRepo.save(user);
    }
    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  }

  async loginWithPhone(phone: string) {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  }
}
