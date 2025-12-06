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
import { User, UserRole } from './entities/user.entity';
import { OtpService } from './fake-otp.service';
import { Region } from './../location/entities/region.entity';
import { District } from './../location/entities/district.entity';

@Injectable()
export class AuthService {
  private readonly temporaryOtps: Record<
    string,
    { code: string; expiresAt: Date; isVerified: boolean }
  > = {};

  private readonly otpExpiryTimeMs = 1 * 60 * 1000;
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
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '12h', 
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  async sendOtp(
    phone: string,
  ): Promise<{ otp?: string; message?: string; expiredTime?: number }> {
    const otpCode = await this.otpService.sendOtp(phone);
    const expiresAt = new Date(Date.now() + this.otpExpiryTimeMs);
    this.temporaryOtps[phone] = { code: otpCode, expiresAt, isVerified: false };

    const expiresInMinutes = Math.ceil(this.otpExpiryTimeMs / (1000 * 60));

    return {
      otp: otpCode,
      message: 'SMS kod yuborildi.',
      expiredTime: expiresInMinutes,
    };
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
    const now = new Date();

    console.log(`Tekshirilmoqda: Telefon: ${phone}`);
    console.log(`Kiritilgan OTP kodi: ${code}`);
    if (storedOtp) {
      console.log(`Saqlangan OTP kodi: ${storedOtp.code}`);
      console.log(
        `Saqlangan OTP tugash vaqti: ${storedOtp.expiresAt.toLocaleString()}`,
      );
    } else {
      console.log('Bu telefon raqami uchun saqlangan OTP topilmadi.');
    }
    console.log(`Hozirgi vaqt: ${now.toLocaleString()}`);

    if (!storedOtp) {
      throw new BadRequestException('SMS kod topilmadi.');
    }

    if (storedOtp.code !== code) {
      throw new BadRequestException('SMS kod noto‘g‘ri.');
    }

    if (storedOtp.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException('SMS kod muddati tugagan.');
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
      role: UserRole.USER,
    });

    const savedUser = await this.userRepo.save(newUser);

    if (!savedUser) {
      throw new BadRequestException('User saqlashda xatolik yuz berdi.');
    }

    const existingProfile = await this.profileRepo.findOne({
      where: { user: { id: savedUser.id } },
    });

    if (!existingProfile) {
      const newProfile = this.profileRepo.create({
        userId: savedUser.id,
        user: savedUser,
        phoneNumber: phone,
        fullName: username,
        region,
        district,
        role: savedUser.role, 
      } as Partial<Profile>); 

      await this.profileRepo.save(newProfile);
    } else {
      existingProfile.phoneNumber = phone;
      existingProfile.fullName = username;
      existingProfile.region = region ?? undefined; 
      existingProfile.district = district ?? undefined; 
      if (existingProfile.user) {
        existingProfile.user.role = savedUser.role ?? undefined; 
      }

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

    delete this.temporaryOtps[phone];

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
