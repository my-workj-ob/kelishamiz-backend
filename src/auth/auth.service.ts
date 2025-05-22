/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../profile/enities/profile.entity';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';
import { Region } from 'src/location/entities/region.entity';
import { District } from 'src/location/entities/district.entity';

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
    @InjectRepository(Profile)
    private profileRepo: Repository<Profile>,

    @InjectRepository(Region)
    private regionRepository: Repository<Region>,
    @InjectRepository(District)
    private districtRepository: Repository<District>,
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
      expiresIn: '12h',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  async sendOtp(phone: string): Promise<{ otp?: string; message?: string }> {
    const otpCode = await this.otpService.sendOtp(phone);
    const expiresAt = new Date(Date.now() + this.otpExpiryTimeMs);
    this.temporaryOtps[phone] = { code: otpCode, expiresAt, isVerified: false };
    return { otp: otpCode, message: 'SMS kod yuborildi.' };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decodedPayload = await this.jwtService.verifyAsync(refreshToken);

      const foundUser = await this.findById(decodedPayload.sub);
      if (!foundUser) {
        throw new NotFoundException('Foydalanuvchi topilmadi.');
      }

      return this.generateTokens(foundUser);
    } catch {
      throw new BadRequestException('Yaroqsiz yoki eskirgan refresh token.');
    }
  }

  async login(phone: string): Promise<{
    success: boolean;
    message: string;
    exists: boolean;
  }> {
    const user = await this.findByPhone(phone);
    await this.sendOtp(phone);
    return {
      success: true,
      message: user
        ? 'SMS kod yuborildi.'
        : "Telefon raqami topilmadi. Ro'yxatdan o'tish uchun davom eting.",
      exists: !!user,
    };
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
      throw new BadRequestException('SMS kod noto‘g‘ri yoki muddati tugagan.');
    }

    this.temporaryOtps[phone].isVerified = true;
    return Promise.resolve({ success: true, message: 'OTP tasdiqlandi.' });
  }

  async createAccount(
    phone: string,
    username: string,
    regionId: number,
    districtId: number,
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
    const region = await this.regionRepository.findOneBy({ id: regionId });
    const district = await this.districtRepository.findOneBy({
      id: districtId,
    });
    const newUser = this.userRepo.create({
      phone,
      username,
      regionId,
      districtId,
    } as Partial<User>);
    const savedUser = await this.userRepo.save(newUser);

    if (!newUser) {
      throw new BadRequestException('User kitishda nomalum xatolik yuz berdi ');
    }

    const existingProfile = await this.profileRepo.findOne({
      where: { user: savedUser },
    });

    if (!existingProfile) {
      const newProfile = this.profileRepo.create({
        user: savedUser,
        phoneNumber: phone,
        fullName: username,
        district,
        region,
      } as Partial<User>);

      await this.profileRepo.save(newProfile);
    } else {
      existingProfile.phoneNumber = phone;
      existingProfile.fullName = username;
      existingProfile.regionId = region?.id;
      existingProfile.districtId = district?.id;

      await this.profileRepo.save(existingProfile);
    }

    const tokens = await this.generateTokens(savedUser);

    delete this.temporaryOtps[phone];

    return { user: savedUser, ...tokens };
  }

  async loginWithOtp(
    phone: string,
    code: string,
  ): Promise<{
    success: boolean;
    message?: string;
    content?: { accessToken: string; refreshToken: string };
  }> {
    const verificationResult = await this.verifyOtp(phone, code);
    if (!verificationResult.success) {
      return verificationResult;
    }

    const existingUser = await this.findByPhone(phone);
    if (!existingUser) {
      throw new NotFoundException('Foydalanuvchi topilmadi.');
    }

    const tokens = await this.generateTokens(existingUser);
    delete this.temporaryOtps[phone]; // Logindan keyin OTP ni o'chiramiz

    return {
      success: true,
      content: tokens,
      message: 'Tizimga muvaffaqiyatli kirildi.',
    };
  }

  async checkPhone(phone: string): Promise<{ exists: boolean }> {
    const user = await this.findByPhone(phone);
    return { exists: !!user };
  }
}
