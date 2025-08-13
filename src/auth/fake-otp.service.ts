import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qs from 'qs'; // For x-www-form-urlencoded
import { firstValueFrom } from 'rxjs';

interface TokenData {
  token: string;
  expiresAt: number; // timestamp in milliseconds
}

@Injectable()
export class OtpService {
  private tokenData: TokenData | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Eskiz.uz API'si uchun yangi token oladi.
   * Tokenning amal qilish muddati 24 soat, lekin xavfsizlik uchun 1 daqiqa oldin yangilanadi.
   * @returns Token va uning tugash vaqti.
   */
  private async fetchToken(): Promise<TokenData> {
    const email = this.configService.get<string>('ESKIZ_EMAIL');
    const password = this.configService.get<string>('ESKIZ_PASSWORD');

    const loginUrl = 'https://notify.eskiz.uz/api/auth/login';

    const { data } = await firstValueFrom(
      this.httpService.post(loginUrl, qs.stringify({ email, password }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );
    if (!data || !data?.data || !data?.data?.token) {
      throw new Error('Eskiz.uz API tokenini olishda xatolik yuz berdi.');
    }

    console.log(`Eskiz.uz API tokeni muvaffaqiyatli olindi: ${data}`);

    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const expiresAt = Date.now() + expiresIn - 60_000; // 1 minut oldin expire bo‘ladi

    console.log(
      `Eskiz.uz API tokeni olindi. Token tugash vaqti: ${new Date(expiresAt).toLocaleString()}`,
    );

    return {
      token: data.data.token,
      expiresAt: expiresAt,
    };
  }

  /**
   * Eskiz.uz API'si uchun token qaytaradi. Agar token mavjud bo'lmasa yoki muddati tugagan bo'lsa, yangisini oladi.
   * @returns Eskiz.uz API tokeni.
   */
  private async getToken(): Promise<string> {
    if (!this.tokenData || Date.now() >= this.tokenData.expiresAt) {
      console.log(
        'Eskiz.uz API tokeni yangilanmoqda yoki birinchi marta olinmoqda...',
      );
      this.tokenData = await this.fetchToken();
    }
    return this.tokenData.token;
  }

  /**
   * 6 xonali tasodifiy OTP kodi yaratadi.
   * @returns Yaratilgan OTP kodi.
   */
  generateOtp(): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.debug(`Generated OTP: ${otp}`); // Mana shu log chiqyapti
    return otp;
  }

  /**
   * Berilgan telefon raqamiga OTP kodini yuboradi.
   * Rivojlanish muhitida (development mode) SMS yuborish simulyatsiya qilinadi.
   * @param phone OTP yuboriladigan telefon raqami.
   * @returns Yuborilgan OTP kodi.
   */
  async sendOtp(phone: string): Promise<string> {
    const otpCode = this.generateOtp();
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (isDevelopment) {
      console.log(`[RIVOJLANISH REJIMI] OTP kodi: ${otpCode} -> ${phone}`); // Agar DEV mode bo'lsa, bu chiqyapti
      return otpCode;
    }

    console.log(
      `OTP ${otpCode} raqamiga yuborilmoqda (simulyatsiya): ${phone}`, // Va mana bu log
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.debug(`OTP yuborildi (simulyatsiya) ${phone} raqamiga: ${otpCode}`); // Va bu log
    return otpCode;
  }
}
