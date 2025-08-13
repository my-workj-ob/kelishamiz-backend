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

  private async fetchToken(): Promise<TokenData> {
    const email = '0GzjPHd6pBn1jH83';
    const password = 'yuldoshovich@mail.ru';

    const loginUrl = 'https://notify.eskiz.uz/api/auth/login';

    const { data } = await firstValueFrom(
      this.httpService.post(loginUrl, qs.stringify({ email, password }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    if (!data?.data?.token) {
      throw new Error('Eskiz.uz API tokenini olishda xatolik yuz berdi.');
    }

    const expiresIn = 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + expiresIn - 60_000;

    return { token: data.data.token, expiresAt };
  }

  private async getToken(): Promise<string> {
    if (!OtpService.tokenData || Date.now() >= OtpService.tokenData.expiresAt) {
      OtpService.tokenData = await this.fetchToken();
    }
    return OtpService.tokenData.token;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Eskiz.uz API orqali OTP yuboradi
   */
  async sendOtp(phone: string): Promise<string> {
    const otp = this.generateOtp();
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (isDevelopment) {
      console.log(`[DEV] OTP: ${otp} -> ${phone}`);
      return otp;
    }

    const token = await this.getToken();
    const smsUrl = 'https://notify.eskiz.uz/api/message/sms/send';

    const payload = {
      mobile_phone: phone,
      message: `Sizning OTP kodingiz: ${otp}`,
      from: otp, // Eskiz.uz da ro'yxatdan o'tgan short code
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
