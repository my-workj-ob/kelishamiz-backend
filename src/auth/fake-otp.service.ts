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
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(phone: string): Promise<string> {
    const otpCode = this.generateOtp();
    const apiUrl = 'https://notify.eskiz.uz/api/message/sms/send';

    const payload = {
      mobile_phone: phone.replace('+', ''),
      message: `Kelishamiz.uz saytiga ro‘yxatdan o‘tish uchun tasdiqlash kodi: ${otpCode}`,
      from: '4546',
    };

    let token = await this.getToken();

    try {
      const response = await firstValueFrom(
        this.httpService.post(apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      console.log('Eskiz SMS yuborildi:', response.data);
      return otpCode;
    } catch (error) {
      if (error.response?.status === 401) {
        console.warn('Token eskiribdi (lekin kutilmagan), yangilayapman...');

        // Tokenni refresh qilamiz va yana bir marta yuboramiz
        this.tokenData = await this.fetchToken();
        token = this.tokenData.token;

        const retryResponse = await firstValueFrom(
          this.httpService.post(apiUrl, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        );

        console.log(
          'Eskiz SMS yuborildi (ikkinchi urinish):',
          retryResponse.data,
        );
        return otpCode;
      }

      console.error(
        `SMS yuborishda xatolik: ${
          error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message
        }`,
      );
      throw new Error('SMS yuborishda xatolik yuz berdi');
    }
  }
}
