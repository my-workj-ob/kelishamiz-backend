import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qs from 'qs';
import { firstValueFrom } from 'rxjs';

interface TokenData {
  token: string;
  expiresAt: number;
}

@Injectable()
export class OtpService {
  private static tokenData: TokenData | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Eskiz API dan yangi token olish
   */
  private async fetchToken(): Promise<TokenData> {
    const email = 'yuldoshovich@mail.ru';
    const password = '0GzjPHd6pBn1jH83';

    if (!email || !password) {
      throw new Error('ESKIZ_EMAIL yoki ESKIZ_PASSWORD .env da topilmadi');
    }

    const loginUrl = 'https://notify.eskiz.uz/api/auth/login';

    const { data } = await firstValueFrom(
      this.httpService.post(loginUrl, qs.stringify({ email, password }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    if (!data?.data?.token) {
      throw new Error('Eskiz.uz API tokenini olishda xatolik yuz berdi.');
    }

    // Token muddati (24 soat - 1 daqiqa)
    const expiresIn = 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + expiresIn - 60_000;

    return { token: data.data.token, expiresAt };
  }

  /**
   * Token olish yoki yangilash
   */
  private async getToken(): Promise<string> {
    if (!OtpService.tokenData || Date.now() >= OtpService.tokenData.expiresAt) {
      OtpService.tokenData = await this.fetchToken();
    }
    return OtpService.tokenData.token;
  }

  /**
   * Tasodifiy 6 xonali OTP yaratish
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(phone: string): Promise<string> {
    const otp = this.generateOtp();

    const isDevelopment = false;

    if (isDevelopment) {
      console.log(`[DEV] OTP: ${otp} -> ${phone}`);
      return otp;
    }

    const email = 'yuldoshovich@mail.ru';
    const password = 'LybZx7ZSH6Uavso90lwRKZagdc5DDvBVKlfFNmi4';

    const loginUrl = 'https://notify.eskiz.uz/api/auth/login';
    const { data: loginData } = await firstValueFrom(
      this.httpService.post(
        loginUrl,
        new URLSearchParams({ email, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    if (!loginData?.data?.token) {
      throw new Error('Eskiz tokenini olishda xatolik yuz berdi.');
    }

    const token = loginData.data.token;

    const smsUrl = 'https://notify.eskiz.uz/api/message/sms/send';
    const payload = {
      mobile_phone: phone,
      message: `Kelishamiz.uz saytiga ro‘yxatdan o‘tish uchun tasdiqlash kodi: ${otp}`,
      from: '4546',
    };

    await firstValueFrom(
      this.httpService.post(smsUrl, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    console.log(`OTP ${otp} raqamiga yuborildi: ${phone}`);
    return otp;
  }
}
