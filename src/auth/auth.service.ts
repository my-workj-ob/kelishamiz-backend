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
  // OTP muddati 1 daqiqa (1 * 60 * 1000 ms)
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

  /**
   * Telefon raqam orqali foydalanuvchini topadi.
   * @param phone Foydalanuvchi telefon raqami.
   * @returns Topilgan foydalanuvchi obyekti yoki null.
   */
  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  /**
   * ID orqali foydalanuvchini topadi.
   * @param id Foydalanuvchi IDsi.
   * @returns Topilgan foydalanuvchi obyekti yoki null.
   */
  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  /**
   * Foydalanuvchi uchun access va refresh tokenlarini yaratadi.
   * @param user Tokenlar yaratiladigan foydalanuvchi obyekti.
   * @returns Access va refresh tokenlarini o'z ichiga olgan obyekt.
   */
  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      phone: user.phone,
      username: user.username,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '12h', // Access token 12 soatdan keyin tugaydi
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '30d', // Refresh token 30 kundan keyin tugaydi
    });
    return { accessToken, refreshToken };
  }

  /**
   * Berilgan telefon raqamiga OTP (bir martalik parol) yuboradi.
   * @param phone OTP yuboriladigan telefon raqami.
   * @returns Yuborilgan OTP kodi va xabar.
   */
  async sendOtp(
    phone: string,
  ): Promise<{ otp?: string; message?: string; expiredTime?: number }> {
    const otpCode = await this.otpService.sendOtp(phone);
    const expiresAt = new Date(Date.now() + this.otpExpiryTimeMs);
    this.temporaryOtps[phone] = { code: otpCode, expiresAt, isVerified: false };

    // OTP tugash vaqtini daqiqalarda hisoblaymiz (butun son)
    const expiresInMinutes = Math.ceil(this.otpExpiryTimeMs / (1000 * 60)); // Millisekundlarni daqiqaga aylantiramiz

    return {
      otp: otpCode,
      message: 'SMS kod yuborildi.',
      expiredTime: expiresInMinutes,
    };
  }

  /**
   * Refresh token yordamida yangi access va refresh tokenlarini yaratadi.
   * @param refreshToken Yangilash uchun ishlatiladigan refresh token.
   * @returns Yangi access va refresh tokenlarini o'z ichiga olgan obyekt.
   * @throws BadRequestException Agar refresh token yaroqsiz yoki eskirgan bo'lsa.
   * @throws NotFoundException Agar foydalanuvchi topilmasa.
   */
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

  /**
   * Foydalanuvchini tizimga kirish jarayonini boshlaydi (OTP yuborish).
   * @param phone Tizimga kirish uchun telefon raqami.
   * @returns Jarayon muvaffaqiyati, xabar va foydalanuvchi mavjudligi holati.
   */
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

  /**
   * Berilgan telefon raqami va kodni tekshirish orqali OTPni tasdiqlaydi.
   * @param phone Tasdiqlanadigan telefon raqami.
   * @param code Foydalanuvchi kiritgan OTP kodi.
   * @returns Tasdiqlash muvaffaqiyati va xabar.
   * @throws BadRequestException Agar OTP topilmasa, noto'g'ri bo'lsa yoki muddati tugagan bo'lsa.
   */
  verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ success: boolean; message?: string }> {
    const storedOtp = this.temporaryOtps[phone];
    const now = new Date();

    // Konsolga tekshirilayotgan OTP ma'lumotlarini chiqarish
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

  /**
   * Yangi foydalanuvchi hisobini yaratadi.
   * @param phone Foydalanuvchi telefon raqami.
   * @param username Foydalanuvchi nomi.
   * @param regionId Foydalanuvchi hududi IDsi.
   * @param districtId Foydalanuvchi tumani IDsi.
   * @returns Yaratilgan foydalanuvchi obyekti va tokenlar.
   * @throws BadRequestException Agar OTP tasdiqlanmagan bo'lsa, muddati tugagan bo'lsa yoki foydalanuvchi saqlashda xatolik yuz bersa.
   * @throws ConflictException Agar telefon raqami allaqachon ro'yxatdan o'tgan bo'lsa.
   */
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

    // Profilni tekshirish va yaratish/yangilash
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
        role: savedUser.role, // Foydalanuvchi roli
      } as Partial<Profile>); // `as Partial<Profile>` is used here because `region` and `district` might be null/undefined if not found.

      await this.profileRepo.save(newProfile);
    } else {
      existingProfile.phoneNumber = phone;
      existingProfile.fullName = username;
      existingProfile.region = region ?? undefined; // If region is null, set to undefined to avoid TypeORM issues with null relations
      existingProfile.district = district ?? undefined; // If district is null, set to undefined
      if (existingProfile.user) {
        existingProfile.user.role = savedUser.role ?? undefined; // ✅ to‘g‘rilandi
      }

      await this.profileRepo.save(existingProfile);
    }

    const tokens = await this.generateTokens(savedUser);

    // Hisob yaratilgandan so'ng va tokenlar berilgandan so'ng OTPni o'chiramiz
    delete this.temporaryOtps[phone];

    return { user: savedUser, ...tokens };
  }

  /**
   * OTP yordamida foydalanuvchini tizimga kiritadi.
   * @param phone Tizimga kirish uchun telefon raqami.
   * @param code Tasdiqlash uchun OTP kodi.
   * @returns Tizimga kirish muvaffaqiyati, xabar va tokenlar.
   * @throws NotFoundException Agar foydalanuvchi topilmasa.
   */
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
    // Logindan keyin OTP ni o'chiramiz
    delete this.temporaryOtps[phone];

    return {
      success: true,
      content: tokens,
      message: 'Tizimga muvaffaqiyatli kirildi.',
    };
  }

  /**
   * Telefon raqamining tizimda mavjudligini tekshiradi.
   * @param phone Tekshiriladigan telefon raqami.
   * @returns Telefon raqami mavjudligi holati.
   */
  async checkPhone(phone: string): Promise<{ exists: boolean }> {
    const user = await this.findByPhone(phone);
    return { exists: !!user };
  }
}
