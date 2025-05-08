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
  ) { }

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

    // Eskiz token odatda 1 kun (86400 sekund) amal qiladi
    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    return {
      token: data.data.token,
      expiresAt: Date.now() + expiresIn - 60_000, // 1 minut oldin expire bo‘ladi
    };
  }

  private async getToken(): Promise<string> {
    if (!this.tokenData || Date.now() >= this.tokenData.expiresAt) {
      this.tokenData = await this.fetchToken();
    }
    return this.tokenData.token;
  }

  generateOtp(): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.debug(`Generated OTP: ${otp}`); // Log the generated OTP
    return otp;
  }

  async sendOtp(phone: string): Promise<string> {
    const otpCode = this.generateOtp();
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development'; // Get from config

    if (isDevelopment) {
      console.log(`[DEV MODE] OTP kodi: ${otpCode} -> ${phone}`);
      return otpCode;
    }

    // Fake sending logic:
    console.log(`Fake sending OTP ${otpCode} to ${phone}`); // Use logger
    // Simulate a delay (optional)
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.debug(`OTP sent (fake) to ${phone}: ${otpCode}`);
    return otpCode;
  }
}
